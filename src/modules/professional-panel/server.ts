import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { parseWorkingHours } from "@/modules/mvp/agenda-disponibilidade";
import { professionalAvailabilityIssue } from "@/modules/mvp/server";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import type { Json } from "@/modules/supabase/database.types";
import { disabledAccessMessage } from "./domain";
import type {
  ProfessionalAppointment,
  ProfessionalIdentity,
  ProfessionalPanelResult,
} from "./domain";


type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

function databaseError(error: { code?: string; message: string } | null, fallback: string): never {
  if ((error?.code === "P0001" || error?.code === "42501" || error?.code === "22023") && error.message)
    throw new Error(error.message);
  if (error?.code === "23P01") throw new Error("Você já possui um atendimento nesse horário.");
  throw new Error(fallback);
}

type RawIdentity = Omit<ProfessionalIdentity, "workingHours"> & { workingHours: unknown };

async function readIdentity(
  supabase: SupabaseServerClient,
): Promise<ProfessionalIdentity | null> {
  const { data, error } = await supabase.rpc("get_my_professional_context");
  if (error || !data) return null;
  const raw = data as unknown as RawIdentity | null;
  if (!raw || !raw.professionalId) return null;
  return {
    ...raw,
    productType: raw.productType === "barber" ? "barber" : "beauty",
    workingHours: parseWorkingHours(raw.workingHours),
  };
}

/**
 * Reivindica o acesso profissional a partir do e-mail previamente autorizado
 * pelo proprietário. Autenticar (Google ou e-mail/senha) não basta: o e-mail
 * precisa estar cadastrado em um profissional ativo da empresa.
 */
async function claimAccess(
  supabase: SupabaseServerClient,
): Promise<"ok" | "disabled" | "not_authorized" | "unauthenticated"> {
  const { data } = await supabase.rpc("claim_professional_access");
  const status = (data as { status?: string } | null)?.status;
  return status === "ok" || status === "disabled" || status === "unauthenticated"
    ? status
    : "not_authorized";
}

/** Contexto obrigatório para qualquer ação do Painel Profissional. */
async function professionalContext() {
  const supabase = createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Faça login novamente para continuar.");
  const claim = await claimAccess(supabase);
  if (claim === "not_authorized")
    throw new Error("Seu e-mail não está autorizado no Painel Profissional desta empresa.");
  if (claim === "disabled") throw new Error(disabledAccessMessage);
  const identity = await readIdentity(supabase);
  if (!identity) throw new Error("Sua conta não está vinculada a um profissional ativo.");
  if (!identity.active) throw new Error(disabledAccessMessage);
  return { supabase, identity };
}

export const getProfessionalPanel = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProfessionalPanelResult> => {
    const supabase = createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { status: "unauthenticated" };
    const claim = await claimAccess(supabase);
    if (claim === "unauthenticated") return { status: "unauthenticated" };
    if (claim === "not_authorized")
      return { status: "not_authorized", email: auth.user.email ?? null };
    const identity = await readIdentity(supabase);
    if (!identity) return { status: "not_professional" };
    if (!identity.active) {
      return {
        status: "disabled",
        name: identity.name,
        tenantName: identity.tenantName,
        productType: identity.productType,
      };
    }


    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() + 90);

    const [appointmentsResult, blocksResult, linkResult, clientsResult, servicesResult] =
      await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, starts_at, ends_at, status, price_cents, notes, clients(name, phone), services(name)",
          )
          .eq("professional_id", identity.professionalId)
          .gte("starts_at", from.toISOString())
          .lt("starts_at", to.toISOString())
          .order("starts_at"),
        supabase
          .from("professional_unavailability")
          .select("id, starts_at, ends_at, reason")
          .eq("professional_id", identity.professionalId)
          .gte("ends_at", from.toISOString())
          .order("starts_at"),
        supabase
          .from("professional_services")
          .select("service_id")
          .eq("professional_id", identity.professionalId),
        supabase.from("clients").select("id, name, phone").eq("active", true).order("name"),
        supabase
          .from("services")
          .select("id, name, duration_minutes, price_cents, active")
          .eq("tenant_id", identity.tenantId),
      ]);

    const appointmentRows = appointmentsResult.data ?? [];
    const serviceRows = servicesResult.data ?? [];
    const serviceNames = new Map(serviceRows.map((service) => [service.id, service.name]));

    const itemsByAppointment = new Map<string, ProfessionalAppointment["items"]>();
    if (appointmentRows.length > 0) {
      const { data: itemRows } = await supabase
        .from("appointment_services")
        .select("appointment_id, service_id, position, duration_minutes, price_cents")
        .in(
          "appointment_id",
          appointmentRows.map((row) => row.id),
        );
      for (const item of itemRows ?? []) {
        const list = itemsByAppointment.get(item.appointment_id) ?? [];
        list.push({
          serviceId: item.service_id,
          name: serviceNames.get(item.service_id) ?? "Serviço",
          durationMinutes: item.duration_minutes,
          priceCents: item.price_cents,
          position: item.position,
        });
        itemsByAppointment.set(item.appointment_id, list);
      }
    }

    const appointments: ProfessionalAppointment[] = appointmentRows.map((row) => ({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status as ProfessionalAppointment["status"],
      priceCents: row.price_cents,
      notes: row.notes,
      clientName: row.clients?.name ?? "Cliente",
      clientPhone: row.clients?.phone ?? null,
      serviceName: row.services?.name ?? "Serviço",
      items: (itemsByAppointment.get(row.id) ?? []).sort((a, b) => a.position - b.position),
    }));

    const allowedServiceIds = new Set((linkResult.data ?? []).map((row) => row.service_id));
    const services = serviceRows
      .filter((service) => service.active && allowedServiceIds.has(service.id))
      .map((service) => ({
        id: service.id,
        name: service.name,
        durationMinutes: service.duration_minutes,
        priceCents: service.price_cents,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));


    return {
      status: "ok",
      data: {
        identity,
        appointments,
        blocks: (blocksResult.data ?? []).map((row) => ({
          id: row.id,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          reason: row.reason,
        })),
        services,
        clients: clientsResult.data ?? [],
      },
    };
  },
);

/** Indica se a conta logada também possui um cadastro profissional ativo. */
export const hasProfessionalPanel = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const supabase = createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;
    const identity = await readIdentity(supabase);
    return Boolean(identity?.active);
  },
);

export const professionalSaveAppointment = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      serviceId: z.string().uuid(),
      startsAt: z.string().datetime({ offset: true }),
      status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]),
      notes: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((value) => value || null),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, identity } = await professionalContext();
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration_minutes, price_cents, active")
      .eq("id", data.serviceId)
      .single();
    if (serviceError || !service) databaseError(serviceError, "Serviço inválido.");
    if (!service.active && !data.id)
      throw new Error("Este serviço está inativo e não pode ser usado em novos agendamentos.");
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);
    if (data.status === "scheduled" || data.status === "confirmed") {
      const blocked = await professionalAvailabilityIssue({
        supabase,
        tenantId: identity.tenantId,
        professionalId: identity.professionalId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        ignoreAppointmentId: data.id,
      });
      if (blocked) throw new Error(blocked);
    }
    const values = {
      tenant_id: identity.tenantId,
      client_id: data.clientId,
      service_id: data.serviceId,
      professional_id: identity.professionalId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: service.price_cents,
      status: data.status,
      notes: data.notes,
    };
    const query = data.id
      ? supabase
          .from("appointments")
          .update(values)
          .eq("id", data.id)
          .eq("professional_id", identity.professionalId)
      : supabase.from("appointments").insert(values);
    const { error } = await query;
    if (error) databaseError(error, "Não foi possível salvar o atendimento.");
    return { success: true } as const;
  });

export const professionalSetAppointmentStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, identity } = await professionalContext();
    const { error } = await supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("professional_id", identity.professionalId);
    if (error) databaseError(error, "Não foi possível atualizar o atendimento.");
    return { success: true } as const;
  });

export const professionalCreateClient = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().max(160).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase } = await professionalContext();
    const { data: id, error } = await supabase.rpc("professional_create_client", {
      p_name: data.name,
      p_phone: data.phone ?? null,
      p_email: data.email ?? null,
    });
    if (error || !id) databaseError(error, "Não foi possível cadastrar o cliente.");
    return { id } as const;
  });

const dayScheduleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  dayOff: z.boolean(),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  breakStartsAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .or(z.literal(""))
    .transform((value) => value || null),
  breakEndsAt: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .or(z.literal(""))
    .transform((value) => value || null),
});

export const professionalSaveWorkingHours = createServerFn({ method: "POST" })
  .validator(
    z.object({ followCompanyHours: z.boolean(), days: z.array(dayScheduleSchema).max(7) }),
  )
  .handler(async ({ data }) => {
    const { supabase } = await professionalContext();
    const workingHours: Record<string, Json> = {};
    if (!data.followCompanyHours) {
      for (const day of data.days) {
        if (!day.dayOff && day.endsAt <= day.startsAt)
          throw new Error("O horário final deve ser maior que o inicial.");
        if (day.breakStartsAt && day.breakEndsAt && day.breakEndsAt <= day.breakStartsAt)
          throw new Error("O intervalo informado é inválido.");
        workingHours[String(day.weekday)] = {
          dayOff: day.dayOff,
          startsAt: day.startsAt,
          endsAt: day.endsAt,
          breakStartsAt: day.breakStartsAt,
          breakEndsAt: day.breakEndsAt,
        };
      }
    }
    const { error } = await supabase.rpc("professional_update_working_hours", {
      p_working_hours: workingHours as Json,
    });
    if (error) databaseError(error, "Não foi possível salvar seus horários.");
    return { success: true } as const;
  });

export const professionalSaveBlock = createServerFn({ method: "POST" })
  .validator(
    z.object({
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      reason: z
        .string()
        .trim()
        .max(160)
        .optional()
        .transform((value) => value || null),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, identity } = await professionalContext();
    if (new Date(data.endsAt) <= new Date(data.startsAt))
      throw new Error("O fim do bloqueio deve ser depois do início.");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("professional_unavailability").insert({
      tenant_id: identity.tenantId,
      professional_id: identity.professionalId,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      reason: data.reason,
      ...(auth.user ? { created_by: auth.user.id } : {}),
    });
    if (error) databaseError(error, "Não foi possível salvar o bloqueio.");
    return { success: true } as const;
  });

export const professionalDeleteBlock = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabase, identity } = await professionalContext();
    const { error } = await supabase
      .from("professional_unavailability")
      .delete()
      .eq("id", data.id)
      .eq("professional_id", identity.professionalId);
    if (error) databaseError(error, "Não foi possível remover o bloqueio.");
    return { success: true } as const;
  });
