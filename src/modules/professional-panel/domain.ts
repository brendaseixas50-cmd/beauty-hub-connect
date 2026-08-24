import type { DaySchedule, WorkingHours } from "@/modules/mvp/agenda-disponibilidade";

export type ProfessionalIdentity = {
  professionalId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string | null;
  productType: "beauty" | "barber";
  timezone: string;
  name: string;
  specialty: string | null;
  photoUrl: string | null;
  active: boolean;
  role: string;
  workingHours: WorkingHours;
};

export type ProfessionalAppointmentService = {
  serviceId: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  position: number;
};

export type ProfessionalAppointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  priceCents: number;
  notes: string | null;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  items: ProfessionalAppointmentService[];
};

export type ProfessionalBlock = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

export type ProfessionalPanelData = {
  identity: ProfessionalIdentity;
  appointments: ProfessionalAppointment[];
  blocks: ProfessionalBlock[];
  services: { id: string; name: string; durationMinutes: number; priceCents: number }[];
  clients: { id: string; name: string; phone: string | null }[];
};

export type ProfessionalPanelResult =
  | { status: "ok"; data: ProfessionalPanelData }
  | { status: "unauthenticated" }
  | { status: "not_professional" }
  | { status: "disabled"; name: string; tenantName: string; productType: "beauty" | "barber" };

export const appointmentStatusLabels: Record<ProfessionalAppointment["status"], string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

/** Chave local (YYYY-MM-DD) de uma data ISO no fuso da empresa. */
export function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function hourLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function longDateLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDayKey(startKey, index));
}

export function scheduleForDay(hours: WorkingHours, weekday: number): DaySchedule | undefined {
  return hours[String(weekday)];
}
