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
  planCode: z.enum(["solo", "team"]),
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
    if (error) throw new Error(`Não foi possível consultar os acessos: ${error.message}`);
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
      target_plan: data.planCode,
      target_expires_at: data.expiresAt,
      target_notes: data.notes || null,
    });
    if (error) throw new Error(`Não foi possível salvar este acesso: ${error.message}`);
    const limit = data.planCode === "team" ? 8 : 1;
    return { ok: true, planCode: data.planCode, limit };
  });

export const removePlatformAccess = createServerFn({ method: "POST" })
  .validator(removeSchema)
  .handler(async ({ data }) => {
    const supabase = await requirePlatformAdministrator();
    const { error } = await supabase.rpc("admin_remove_platform_access", { target_id: data.id });
    if (error) throw new Error("Não foi possível remover este acesso.");
    return { ok: true };
  });

