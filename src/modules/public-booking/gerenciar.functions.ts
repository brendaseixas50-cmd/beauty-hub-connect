import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Área pública "Gerenciar meus agendamentos".
 *
 * Não existe cadastro tradicional: o acesso é feito pelo link seguro enviado no
 * fim do agendamento, que carrega o token opaco (appointments.manage_token).
 * Todas as leituras/escritas usam o cliente administrativo porque o visitante
 * não tem sessão — por isso cada consulta é sempre filtrada pelo token.
 */
const tokenSchema = z.object({ token: z.string().trim().min(20).max(120) });

export type ManagedBooking = {
  ok: true;
  code: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  clientName: string | null;
  professionalId: string;
  professionalName: string | null;
  serviceId: string;
  serviceName: string | null;
  company: {
    slug: string;
    name: string;
    productType: "beauty" | "barber";
    timezone: string;
    whatsapp: string | null;
    cancellationPolicy: string | null;
  };
  rules: {
    horizonDays: number;
    deadlineEnabled: boolean;
    deadlineHours: number;
  };
  canCancel: boolean;
  canReschedule: boolean;
  blockedReason: string | null;
};

export type ManagedBookingResult = ManagedBooking | { ok: false; error: string };

const finalStatuses = new Set(["cancelled", "completed", "no_show"]);

function deadlineState(
  startsAt: string,
  rules: { deadlineEnabled: boolean; deadlineHours: number },
): string | null {
  const start = new Date(startsAt).getTime();
  if (start <= Date.now()) return "Este horário já passou. Fale com a empresa pelo WhatsApp.";
  if (!rules.deadlineEnabled) return null;
  const limit = start - rules.deadlineHours * 3_600_000;
  if (Date.now() > limit) {
    return `Cancelamentos e remarcações online são aceitos com até ${rules.deadlineHours} h de antecedência. Fale com a empresa pelo WhatsApp.`;
  }
  return null;
}

async function loadByToken(token: string) {
  const { createSupabaseAdminClient } = await import("@/modules/supabase/admin-client");
  const supabase = createSupabaseAdminClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      "id, tenant_id, public_code, status, starts_at, ends_at, price_cents, professional_id, service_id, client_id",
    )
    .eq("manage_token", token)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar este agendamento agora.");
  if (!appointment) return null;
  const [tenant, professional, service, client] = await Promise.all([
    supabase
      .from("tenants")
      .select(
        "slug, name, public_name, product_type, timezone, whatsapp, cancellation_policy, cancellation_policy_enabled, booking_horizon_days, reschedule_deadline_enabled, reschedule_deadline_hours",
      )
      .eq("id", appointment.tenant_id)
      .maybeSingle(),
    appointment.professional_id
      ? supabase
          .from("professionals")
          .select("name")
          .eq("id", appointment.professional_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    appointment.service_id
      ? supabase.from("services").select("name").eq("id", appointment.service_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    appointment.client_id
      ? supabase.from("clients").select("name").eq("id", appointment.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (!tenant.data) throw new Error("Empresa indisponível.");
  return {
    supabase,
    appointment,
    tenant: tenant.data,
    professionalName: professional.data?.name ?? null,
    serviceName: service.data?.name ?? null,
    clientName: client.data?.name ?? null,
  };
}

export const getManagedBooking = createServerFn({ method: "GET" })
  .validator(tokenSchema)
  .handler(async ({ data }): Promise<ManagedBookingResult> => {
    const loaded = await loadByToken(data.token);
    if (!loaded) return { ok: false, error: "Link inválido ou expirado." };
    const { appointment, tenant } = loaded;
    const rules = {
      horizonDays: tenant.booking_horizon_days ?? 60,
      deadlineEnabled: tenant.reschedule_deadline_enabled === true,
      deadlineHours: tenant.reschedule_deadline_hours ?? 24,
    };
    const closed = finalStatuses.has(appointment.status);
    const blocked = closed
      ? "Este agendamento já foi encerrado."
      : deadlineState(appointment.starts_at, rules);
    return {
      ok: true,
      code: appointment.public_code ?? null,
      status: appointment.status,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      priceCents: appointment.price_cents ?? 0,
      clientName: loaded.clientName,
      professionalId: appointment.professional_id,
      professionalName: loaded.professionalName,
      serviceId: appointment.service_id,
      serviceName: loaded.serviceName,
      company: {
        slug: tenant.slug,
        name: tenant.public_name ?? tenant.name,
        productType: tenant.product_type === "barber" ? "barber" : "beauty",
        timezone: tenant.timezone,
        whatsapp: tenant.whatsapp,
        cancellationPolicy: tenant.cancellation_policy_enabled
          ? tenant.cancellation_policy
          : null,
      },
      rules,
      canCancel: !closed && !blocked,
      canReschedule: !closed && !blocked,
      blockedReason: blocked,
    };
  });

export const cancelManagedBooking = createServerFn({ method: "POST" })
  .validator(tokenSchema)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const loaded = await loadByToken(data.token);
    if (!loaded) return { ok: false, error: "Link inválido ou expirado." };
    const { supabase, appointment, tenant } = loaded;
    if (finalStatuses.has(appointment.status))
      return { ok: false, error: "Este agendamento já foi encerrado." };
    const blocked = deadlineState(appointment.starts_at, {
      deadlineEnabled: tenant.reschedule_deadline_enabled === true,
      deadlineHours: tenant.reschedule_deadline_hours ?? 24,
    });
    if (blocked) return { ok: false, error: blocked };
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id);
    if (error) return { ok: false, error: "Não foi possível cancelar agora. Tente novamente." };
    const { syncAppointmentFinancials } = await import("@/modules/finance/comissoes.server");
    await syncAppointmentFinancials({
      tenantId: appointment.tenant_id,
      appointmentId: appointment.id,
    });
    return { ok: true };
  });

export const rescheduleManagedBooking = createServerFn({ method: "POST" })
  .validator(tokenSchema.extend({ startsAt: z.string().datetime({ offset: true }) }))
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string }> => {
    const loaded = await loadByToken(data.token);
    if (!loaded) return { ok: false, error: "Link inválido ou expirado." };
    const { supabase, appointment, tenant } = loaded;
    if (finalStatuses.has(appointment.status))
      return { ok: false, error: "Este agendamento já foi encerrado." };
    const blocked = deadlineState(appointment.starts_at, {
      deadlineEnabled: tenant.reschedule_deadline_enabled === true,
      deadlineHours: tenant.reschedule_deadline_hours ?? 24,
    });
    if (blocked) return { ok: false, error: blocked };

    const horizonDays = tenant.booking_horizon_days ?? 60;
    const target = new Date(data.startsAt).getTime();
    if (target <= Date.now()) return { ok: false, error: "Escolha um horário futuro." };
    if (target > Date.now() + horizonDays * 86_400_000) {
      return { ok: false, error: `Esta empresa abre a agenda com até ${horizonDays} dias.` };
    }

    const durationMinutes = Math.max(
      10,
      Math.round(
        (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) /
          60_000,
      ),
    );
    const endsAt = new Date(target + durationMinutes * 60_000).toISOString();

    const { professionalSlotBlockReason, parseWorkingHours } = await import(
      "@/modules/mvp/agenda-disponibilidade"
    );
    if (appointment.professional_id) {
      const [professional, blocks, conflicts] = await Promise.all([
        supabase
          .from("professionals")
          .select("working_hours")
          .eq("id", appointment.professional_id)
          .maybeSingle(),
        supabase
          .from("professional_unavailability")
          .select("starts_at, ends_at")
          .eq("tenant_id", appointment.tenant_id)
          .eq("professional_id", appointment.professional_id)
          .lt("starts_at", endsAt)
          .gt("ends_at", data.startsAt),
        supabase
          .from("appointments")
          .select("id")
          .eq("tenant_id", appointment.tenant_id)
          .eq("professional_id", appointment.professional_id)
          .in("status", ["scheduled", "confirmed"])
          .neq("id", appointment.id)
          .lt("starts_at", endsAt)
          .gt("ends_at", data.startsAt)
          .limit(1),
      ]);
      if (professional.error || blocks.error || conflicts.error) {
        return { ok: false, error: "Não foi possível confirmar o horário agora. Tente novamente." };
      }
      if ((conflicts.data ?? []).length > 0) {
        return { ok: false, error: "Este horário acabou de ser reservado. Escolha outro." };
      }
      const reason = professionalSlotBlockReason({
        workingHours: parseWorkingHours(professional.data?.working_hours),
        timeZone: tenant.timezone,
        startsAt: data.startsAt,
        endsAt,
        unavailability: blocks.data ?? [],
      });
      if (reason) return { ok: false, error: reason };
    }

    const { error } = await supabase
      .from("appointments")
      .update({ starts_at: data.startsAt, ends_at: endsAt, status: "scheduled" })
      .eq("id", appointment.id);
    if (error) return { ok: false, error: "Não foi possível remarcar agora. Tente novamente." };
    const { syncAppointmentFinancials } = await import("@/modules/finance/comissoes.server");
    await syncAppointmentFinancials({
      tenantId: appointment.tenant_id,
      appointmentId: appointment.id,
    });
    return { ok: true };
  });
