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
/** Produto com o histórico que impede a exclusão definitiva. */
export type ProductWithUsage = Product & { movements: number; deletable: boolean };
export type Professional = Tables<"professionals">;
export type ProfessionalWithServices = Professional & { serviceIds: string[] };
export type Service = Tables<"services">;
/** Como cada item de um combo é executado: por quem e junto ou depois. */
export type ComboItemConfig = {
  serviceId: string;
  professionalId: string | null;
  executionMode: "sequential" | "parallel";
};
/** Linha crua da composição do combo, com as colunas de execução. */
export type ComboItemRow = {
  combo_service_id: string;
  service_id: string;
  position: number;
  assigned_professional_id: string | null;
  execution_mode: string | null;
};
/** Linha crua do vínculo de adicional, com a configuração de executor. */
export type AddonLinkRow = {
  parent_service_id: string;
  addon_service_id: string;
  position: number;
  professional_mode: string | null;
  assigned_professional_id: string | null;
  preferred_fallback: string | null;
};

/** Serviço com os vínculos que precisam ser preservados antes de excluir. */
export type ServiceWithUsage = Service & {
  appointments: number;
  futureAppointments: number;
  linkedToProfessionals: boolean;
  deletable: boolean;
  comboServiceIds: string[];
  comboItems: ComboItemConfig[];
  /** Serviços/combos que oferecem este serviço na seção "Adicionar também". */
  addonForServiceIds: string[];
  /** Como o executor é escolhido quando este serviço é usado como adicional. */
  addonProfessionalMode: "any" | "preferred" | "client_choice";
  addonPreferredProfessionalId: string | null;
  addonPreferredFallback: "any" | "none";

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
