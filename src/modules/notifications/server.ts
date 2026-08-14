import { createServerFn } from "@tanstack/react-start";

import { requireApprovedSession } from "@/modules/auth/session.server";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const session = await requireApprovedSession(supabase);
  const { data, error } = await supabase
    .from("notification_outbox")
    .select("*")
    .eq("tenant_id", session.user.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Não foi possível carregar as notificações.");
  return data;
});
