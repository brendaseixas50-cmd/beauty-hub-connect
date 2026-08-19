import type { Tables } from "@/modules/supabase/database.types";

export type Appointment = Tables<"appointments"> & {
  clients: Pick<Tables<"clients">, "name" | "phone"> | null;
  services: Pick<Tables<"services">, "name" | "duration_minutes"> | null;
  professionals: Pick<Tables<"professionals">, "name"> | null;
};
export type Client = Tables<"clients">;
export type Company = Tables<"tenants">;
export type FinancialEntry = Tables<"financial_entries">;
export type InventoryMovement = Tables<"inventory_movements"> & {
  products: Pick<Tables<"products">, "name"> | null;
};
export type MarketingTemplate = Tables<"marketing_templates">;
export type MarketingCampaign = Tables<"marketing_campaigns">;
export type MarketingAction = Tables<"marketing_actions"> & {
  clients: Pick<Tables<"clients">, "name" | "phone"> | null;
};
export type MarketingClient = Client & {
  lastAppointmentAt: string | null;
  lastServiceName: string | null;
  lastProfessionalName: string | null;
};
export type Product = Tables<"products">;
export type Professional = Tables<"professionals">;
export type ProfessionalWithServices = Professional & { serviceIds: string[] };
export type Service = Tables<"services">;
/** Serviço com os vínculos que precisam ser preservados antes de excluir. */
export type ServiceWithUsage = Service & {
  appointments: number;
  futureAppointments: number;
  linkedToProfessionals: boolean;
  deletable: boolean;
};

export type ProductType = "beauty" | "barber";

export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export function centsFromInput(value: string): number {
  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  return Math.round(Number(normalized || 0) * 100);
}
