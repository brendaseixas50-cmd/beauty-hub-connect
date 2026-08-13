import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { resolveSession } from "@/modules/auth/session.server";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

const searchSchema = z.object({ email: z.string().trim().max(254).default("") });
const accessSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  productType: z.enum(["beauty", "barber"]),
  accessType: z.enum(["administrator", "courtesy", "beta_tester"]),
  status: z.enum(["active", "suspended", "revoked", "expired"]),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  notes: z.string().trim().max(1000),
});
const removeSchema = z.object({ id: z.string().uuid() });

async function requirePlatformAdministrator() {
  const supabase = createSupabaseServerClient();
  const session = await resolveSession(supabase);
  if (!session?.user.isPlatformAdministrator) throw new Error("Acesso administrativo necessário.");
  return supabase;
}

export const listPlatformAccess = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const supabase = await requirePlatformAdministrator();
    const { data: rows, error } = await supabase.rpc("admin_list_platform_access", {
      search_email: data.email,
    });
    if (error) throw new Error("Não foi possível consultar os acessos.");
    return (Array.isArray(rows) ? rows : []) as NonNullable<typeof rows>;
  });


export const savePlatformAccess = createServerFn({ method: "POST" })
  .validator(accessSchema)
  .handler(async ({ data }) => {
    const supabase = await requirePlatformAdministrator();
    const { error } = await supabase.rpc("admin_upsert_platform_access", {
      target_email: data.email,
      target_product: data.productType,
      target_access_type: data.accessType,
      target_status: data.status,
      target_expires_at: data.expiresAt,
      target_notes: data.notes || null,
    });
    if (error) throw new Error("Não foi possível salvar este acesso.");
    return { ok: true };
  });

export const removePlatformAccess = createServerFn({ method: "POST" })
  .validator(removeSchema)
  .handler(async ({ data }) => {
    const supabase = await requirePlatformAdministrator();
    const { error } = await supabase.rpc("admin_remove_platform_access", { target_id: data.id });
    if (error) throw new Error("Não foi possível remover este acesso.");
    return { ok: true };
  });

const planCodeSchema = z.enum(["solo", "team"]);
const tenantPlanSchema = z.object({ tenantId: z.string().uuid(), planCode: planCodeSchema });

/** Planos comerciais liberados no beta: Solo (1 profissional) e Equipe (8 profissionais). */
export const listTenantPlans = createServerFn({ method: "GET" })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    await requirePlatformAdministrator();
    const { createSupabaseAdminClient } = await import("@/modules/supabase/admin-client");
    const admin = createSupabaseAdminClient();
    const base = admin.from("tenants").select("id, name, slug, product_type").order("name").limit(40);
    const { data: rows, error } = data.email
      ? await base.or(`name.ilike.%${data.email}%,slug.ilike.%${data.email}%`)
      : await base;
    if (error) throw new Error("Não foi possível listar as empresas.");
    const tenants = rows ?? [];
    if (!tenants.length) return [];

    // Consulta separada: assim uma assinatura/plano legado ou ausente não derruba a listagem.
    const planByTenant = new Map<string, string>();
    const { data: subscriptions } = await admin
      .from("tenant_subscriptions")
      .select("tenant_id, status, plan:subscription_plans(code)")
      .in(
        "tenant_id",
        tenants.map((tenant) => tenant.id),
      )
      .in("status", ["beta", "trial", "active"]);
    for (const item of subscriptions ?? []) {
      const plan = (Array.isArray(item.plan) ? item.plan[0] : item.plan) as
        | { code: string | null }
        | null
        | undefined;
      if (item.tenant_id && plan?.code) planByTenant.set(item.tenant_id, plan.code);
    }

    return tenants.map((tenant) => {
      const code = planByTenant.get(tenant.id) === "team" ? "team" : "solo";
      return {
        id: tenant.id,
        name: tenant.name ?? tenant.slug ?? "Empresa sem nome",
        slug: tenant.slug ?? "",
        productType: tenant.product_type,
        planCode: code as "solo" | "team",
        planName: code === "team" ? "Equipe (até 8)" : "Solo (1 profissional)",
      };
    });
  });


export const setTenantPlan = createServerFn({ method: "POST" })
  .validator(tenantPlanSchema)
  .handler(async ({ data }) => {
    await requirePlatformAdministrator();
    const { createSupabaseAdminClient } = await import("@/modules/supabase/admin-client");
    const admin = createSupabaseAdminClient();
    const { data: plan } = await admin
      .from("subscription_plans")
      .select("id")
      .eq("code", data.planCode)
      .maybeSingle();
    if (!plan) throw new Error("Plano indisponível no banco de dados.");
    const { data: current } = await admin
      .from("tenant_subscriptions")
      .select("id")
      .eq("tenant_id", data.tenantId)
      .in("status", ["beta", "trial", "active"])
      .limit(1)
      .maybeSingle();
    const { error } = current
      ? await admin
          .from("tenant_subscriptions")
          .update({ plan_id: plan.id, status: "beta" })
          .eq("id", current.id)
      : await admin
          .from("tenant_subscriptions")
          .insert({
            tenant_id: data.tenantId,
            plan_id: plan.id,
            status: "beta",
            provider: "manual",
          });
    if (error) throw new Error("Não foi possível alterar o plano desta empresa.");
    return { ok: true };
  });
