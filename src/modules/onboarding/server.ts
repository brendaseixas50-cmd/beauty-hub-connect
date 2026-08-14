import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireApprovedSession } from "@/modules/auth/session.server";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";

export interface SpecialtyOption {
  id: string;
  name: string;
  productType: "beauty" | "barber";
}

export interface ServiceSuggestion {
  key: string;
  specialtyId: string;
  name: string;
  category: string | null;
  durationMinutes: number;
  priceCents: number;
}

export interface OnboardingData {
  tenantId: string;
  productType: "beauty" | "barber";
  completed: boolean;
  specialties: SpecialtyOption[];
  suggestions: ServiceSuggestion[];
  selectedIds: string[];
  primaryId: string | null;
}

async function context() {
  const supabase = createSupabaseServerClient();
  const session = await requireApprovedSession(supabase);
  if (session.user.role !== "owner" && session.user.role !== "admin") {
    throw new Error("Você não possui permissão para alterar estas configurações.");
  }
  return { supabase, session, tenantId: session.user.tenantId };
}

export const getOnboardingData = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnboardingData> => {
    const { supabase, session, tenantId } = await context();
    const productType = session.user.productType;
    const db = supabase;
    const [catalogResult, suggestionsResult, selectedResult, tenantResult] = await Promise.all([
      db
        .from("specialty_catalog")
        .select("id,name,product_type")
        .eq("product_type", productType)
        .eq("active", true)
        .order("sort_order"),
      db
        .from("specialty_service_suggestions")
        .select("service_key,specialty_id,name,category,duration_minutes,price_cents")
        .eq("active", true)
        .order("sort_order"),
      db.from("tenant_specialties").select("specialty_id,is_primary").eq("tenant_id", tenantId),
      db.from("tenants").select("onboarding_completed_at").eq("id", tenantId).single(),
    ]);
    if (
      catalogResult.error ||
      suggestionsResult.error ||
      selectedResult.error ||
      tenantResult.error
    ) {
      throw new Error("Não foi possível carregar as opções iniciais.");
    }
    const specialtyIds = new Set(catalogResult.data.map((item) => item.id));
    return {
      tenantId,
      productType,
      completed: Boolean(tenantResult.data.onboarding_completed_at),
      specialties: catalogResult.data.map((item) => ({
        id: item.id,
        name: item.name,
        productType: item.product_type === "barber" ? "barber" : "beauty",
      })),
      suggestions: suggestionsResult.data
        .filter((item) => specialtyIds.has(item.specialty_id))
        .map((item) => ({
          key: item.service_key,
          specialtyId: item.specialty_id,
          name: item.name,
          category: item.category,
          durationMinutes: item.duration_minutes,
          priceCents: item.price_cents,
        })),
      selectedIds: selectedResult.data.map((item) => item.specialty_id),
      primaryId: selectedResult.data.find((item) => item.is_primary)?.specialty_id ?? null,
    };
  },
);

const serviceInput = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().max(120).nullable(),
  durationMinutes: z.number().int().min(5).max(720),
  priceCents: z.number().int().min(0).max(100_000_000),
});

const saveSchema = z.object({
  selectedIds: z.array(z.string().min(1).max(80)).max(30),
  primaryId: z.string().min(1).max(80).nullable(),
  services: z.array(serviceInput).max(100),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .validator(saveSchema)
  .handler(async ({ data }) => {
    const { supabase, session, tenantId } = await context();
    const db = supabase;
    const selectedIds = [...new Set(data.selectedIds)];
    if (
      session.user.productType === "beauty" &&
      (!data.primaryId || !selectedIds.includes(data.primaryId))
    ) {
      throw new Error("Escolha uma área principal para continuar.");
    }

    const { data: allowed, error: allowedError } = await db
      .from("specialty_catalog")
      .select("id,name")
      .eq("product_type", session.user.productType)
      .eq("active", true)
      .in("id", selectedIds.length ? selectedIds : ["__none__"]);
    if (allowedError || allowed.length !== selectedIds.length)
      throw new Error("Uma das áreas selecionadas não é válida.");

    const { error: deleteError } = await db
      .from("tenant_specialties")
      .delete()
      .eq("tenant_id", tenantId);
    if (deleteError) throw new Error("Não foi possível atualizar as áreas de atuação.");
    if (selectedIds.length) {
      const { error: insertError } = await db.from("tenant_specialties").insert(
        selectedIds.map((specialtyId) => ({
          tenant_id: tenantId,
          specialty_id: specialtyId,
          is_primary: specialtyId === data.primaryId,
        })),
      );
      if (insertError) throw new Error("Não foi possível salvar as áreas de atuação.");
    }

    const primaryName =
      allowed.find((item) => item.id === data.primaryId)?.name ??
      (session.user.productType === "barber" ? "Barbeiro" : null);
    if (primaryName) {
      await db
        .from("professionals")
        .update({ specialty: primaryName })
        .eq("tenant_id", tenantId)
        .eq("user_id", session.user.id);
    }

    const uniqueServices = [
      ...new Map(
        data.services.map((service) => [service.name.trim().toLocaleLowerCase("pt-BR"), service]),
      ).values(),
    ];
    const { data: existing, error: existingError } = await db
      .from("services")
      .select("name")
      .eq("tenant_id", tenantId);
    if (existingError) throw new Error("Não foi possível verificar os serviços existentes.");
    const existingNames = new Set(
      existing.map((item) => item.name.trim().toLocaleLowerCase("pt-BR")),
    );
    const newServices = uniqueServices.filter(
      (service) => !existingNames.has(service.name.trim().toLocaleLowerCase("pt-BR")),
    );
    if (newServices.length) {
      const { error: servicesError } = await db.from("services").insert(
        newServices.map((service) => ({
          tenant_id: tenantId,
          name: service.name,
          category: service.category,
          duration_minutes: service.durationMinutes,
          price_cents: service.priceCents,
          active: true,
        })),
      );
      if (servicesError)
        throw new Error("As áreas foram salvas, mas não foi possível adicionar os serviços.");
    }

    const { error: tenantError } = await db
      .from("tenants")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", tenantId);
    if (tenantError) throw new Error("Não foi possível concluir a configuração inicial.");
    return { success: true, servicesAdded: newServices.length } as const;
  });
