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
    let admin: Awaited<ReturnType<typeof import("@/modules/supabase/admin-client")["createSupabaseAdminClient"]>>;
    try {
      const { createSupabaseAdminClient } = await import("@/modules/supabase/admin-client");
      admin = createSupabaseAdminClient();
    } catch {
      return {
        tenants: [],
        warning:
          "A chave administrativa do servidor (SUPABASE_SECRET_KEY) não está configurada neste ambiente.",
      };
    }

    const base = admin
      .from("tenants")
      .select("id, name, slug, product_type, owner_id")
      .order("name")
      .limit(40);
    const { data: rows, error } = data.email
      ? await base.or(`name.ilike.%${data.email}%,slug.ilike.%${data.email}%`)
      : await base;
    if (error) {
      return { tenants: [], warning: `Não foi possível listar as empresas: ${error.message}` };
    }
    const tenants = rows ?? [];
    if (!tenants.length) return { tenants: [], warning: null as string | null };

    const ids = tenants.map((tenant) => tenant.id);
    const warnings: string[] = [];

    // Cada consulta complementar é isolada: um dado ausente nunca derruba a listagem.
    const planByTenant = new Map<string, string>();
    try {
      const { data: subscriptions, error: subscriptionError } = await admin
        .from("tenant_subscriptions")
        .select("tenant_id, status, plan:subscription_plans(code)")
        .in("tenant_id", ids)
        .in("status", ["beta", "trial", "active"]);
      if (subscriptionError) warnings.push("planos atuais");
      for (const item of subscriptions ?? []) {
        const plan = (Array.isArray(item.plan) ? item.plan[0] : item.plan) as
          | { code: string | null }
          | null
          | undefined;
        if (item.tenant_id && plan?.code) planByTenant.set(item.tenant_id, plan.code);
      }
    } catch {
      warnings.push("planos atuais");
    }

    const ownerEmailById = new Map<string, string>();
    try {
      const { data: authUsers, error: usersError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (usersError) throw usersError;
      const ownerIds = new Set(tenants.map((tenant) => tenant.owner_id));
      for (const user of authUsers?.users ?? []) {
        if (ownerIds.has(user.id) && user.email) ownerEmailById.set(user.id, user.email);
      }
    } catch {
      warnings.push("e-mails dos responsáveis");
    }

    const activeByTenant = new Map<string, number>();
    try {
      const { data: professionals, error: professionalsError } = await admin
        .from("professionals")
        .select("tenant_id")
        .in("tenant_id", ids)
        .eq("active", true);
      if (professionalsError) throw professionalsError;
      for (const professional of professionals ?? []) {
        activeByTenant.set(
          professional.tenant_id,
          (activeByTenant.get(professional.tenant_id) ?? 0) + 1,
        );
      }
    } catch {
      warnings.push("profissionais ativos");
    }

    return {
      warning: warnings.length ? `Não foi possível carregar: ${warnings.join(", ")}.` : null,
      tenants: tenants.map((tenant) => {
        const code = planByTenant.get(tenant.id) ?? "solo";
        const planCode: "solo" | "team" | "legacy" =
          code === "team" ? "team" : code === "solo" ? "solo" : "legacy";
        return {
          id: tenant.id,
          name: tenant.name ?? tenant.slug ?? "Empresa sem nome",
          slug: tenant.slug ?? "",
          productType: tenant.product_type,
          ownerEmail: ownerEmailById.get(tenant.owner_id) ?? "E-mail não disponível",
          activeProfessionals: activeByTenant.get(tenant.id) ?? 0,
          planCode,
          planName:
            planCode === "team"
              ? "Equipe (até 8)"
              : planCode === "solo"
                ? "Solo (1 profissional)"
                : "Plano antigo (sem limite comercial)",
        };
      }),
    };
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
    const { count } = await admin
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", data.tenantId)
      .eq("active", true);
    const limit = data.planCode === "team" ? 8 : 1;
    return {
      ok: true,
      planCode: data.planCode,
      limit,
      activeProfessionals: count ?? 0,
      overLimit: (count ?? 0) > limit,
    };
  });
