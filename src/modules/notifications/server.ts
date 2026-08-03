import { createServerFn } from "@tanstack/react-start";

import { resolveSession } from "@/modules/auth/server";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const session = await resolveSession(supabase);
  if (!session) throw new Error("Sessão inválida.");
  const { data, error } = await supabase
    .from("notification_outbox")
    .select("*")
    .eq("tenant_id", session.user.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data;
});
