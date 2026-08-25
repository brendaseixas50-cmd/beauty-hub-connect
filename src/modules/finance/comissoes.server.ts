import type { createSupabaseServerClient } from "@/modules/supabase/server-client";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

/**
 * Sincroniza receita do serviço e comissão do profissional a partir do status
 * do agendamento.
 *
 * Regras:
 * - Atendimento concluído gera UMA receita (origin = service) e UMA comissão.
 *   As travas de unicidade no banco impedem dupla contabilização.
 * - Se o atendimento volta a agendado/confirmado, ou é cancelado / não
 *   compareceu, a receita automática e a comissão são desfeitas.
 * - commission_trigger = 'paid' só gera comissão quando a receita está
 *   confirmada (status paid).
 * - Falha aqui nunca derruba o salvamento do agendamento: o financeiro é
 *   reconciliado na próxima alteração de status.
 */
export async function syncAppointmentFinancials(input: {
  supabase: SupabaseServerClient;
  tenantId: string;
  appointmentId: string;
  createdBy?: string | null;
}): Promise<void> {
  const { supabase, tenantId, appointmentId } = input;
  try {
    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, status, price_cents, starts_at, professional_id, client_id, services(name)")
      .eq("id", appointmentId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!appointment) return;

    const competence = appointment.starts_at.slice(0, 10);
    const concluded = appointment.status === "completed";

    if (!concluded) {
      await supabase
        .from("professional_ledger_entries")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("appointment_id", appointmentId)
        .eq("kind", "commission");
      await supabase
        .from("financial_entries")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("appointment_id", appointmentId)
        .eq("origin", "service");
      return;
    }

    const [{ data: tenant }, { data: professional }] = await Promise.all([
      supabase.from("tenants").select("commission_trigger").eq("id", tenantId).maybeSingle(),
      supabase
        .from("professionals")
        .select("id, name, commission_percent")
        .eq("id", appointment.professional_id)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    const serviceName = appointment.services?.name ?? "Atendimento";
    const { data: existingRevenue } = await supabase
      .from("financial_entries")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("appointment_id", appointmentId)
      .eq("origin", "service")
      .maybeSingle();

    let revenueId = existingRevenue?.id ?? null;
    let revenueStatus = existingRevenue?.status ?? null;
    if (!revenueId && appointment.price_cents > 0) {
      const { data: inserted } = await supabase
        .from("financial_entries")
        .insert({
          tenant_id: tenantId,
          entry_type: "income",
          origin: "service",
          description: `Atendimento — ${serviceName}`,
          category: "Serviços",
          amount_cents: appointment.price_cents,
          due_date: competence,
          competence_date: competence,
          status: "paid",
          paid_at: new Date().toISOString(),
          appointment_id: appointmentId,
          client_id: appointment.client_id,
          professional_id: appointment.professional_id,
        })
        .select("id, status")
        .maybeSingle();
      revenueId = inserted?.id ?? null;
      revenueStatus = inserted?.status ?? null;
    }

    const percent = Number(professional?.commission_percent ?? 0);
    if (!professional || percent <= 0) return;
    if ((tenant?.commission_trigger ?? "completed") === "paid" && revenueStatus !== "paid") return;

    const amountCents = Math.round((appointment.price_cents * percent) / 100);
    if (amountCents <= 0) return;

    const { data: existingCommission } = await supabase
      .from("professional_ledger_entries")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("appointment_id", appointmentId)
      .eq("kind", "commission")
      .maybeSingle();
    if (existingCommission) return;

    await supabase.from("professional_ledger_entries").insert({
      tenant_id: tenantId,
      professional_id: professional.id,
      appointment_id: appointmentId,
      financial_entry_id: revenueId,
      kind: "commission",
      amount_cents: amountCents,
      competence_date: competence,
      description: `${serviceName} — ${percent.toLocaleString("pt-BR")}% de comissão`,
      ...(input.createdBy ? { created_by: input.createdBy } : {}),
    });
  } catch {
    // Reconciliação silenciosa: nunca bloquear a agenda por erro financeiro.
  }
}
