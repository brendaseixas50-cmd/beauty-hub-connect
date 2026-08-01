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
export type Product = Tables<"products">;
export type Professional = Tables<"professionals">;
export type Service = Tables<"services">;

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
