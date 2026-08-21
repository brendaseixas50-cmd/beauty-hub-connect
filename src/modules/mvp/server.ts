import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { resolveOperationalContext } from "@/modules/auth/session.server";
import { resolveAddressWithGoogleMaps } from "@/modules/maps/google-maps.server";
import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import type { Json } from "@/modules/supabase/database.types";
import { parseWorkingHours, professionalSlotBlockReason } from "./agenda-disponibilidade";
import type {
  Appointment,
  Client,
  Company,
  FinancialEntry,
  InventoryMovement,
  MarketingAction,
  MarketingCampaign,
  MarketingClient,
  MarketingTemplate,
  Product,
  ProductWithUsage,
  Professional,
  ProfessionalWithServices,
  Service,
  ServiceWithUsage,
} from "./domain";

const idSchema = z.object({ id: z.string().uuid() });
const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => value || null);
const optionalShortText = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((value) => value || null);

async function tenantContext() {
  const supabase = createSupabaseServerClient();
  const context = await resolveOperationalContext(supabase);
  if (!context) throw new Error("Sua conta não possui uma empresa ativa.");

  return {
    supabase,
    user: { id: context.userId },
    tenantId: context.tenantId,
    role: context.role,
  };
}

function databaseError(error: { code?: string; message: string } | null, fallback: string): never {
  if (error?.code === "P0001" && error.message) throw new Error(error.message);
  if (error?.code === "23P01")
    throw new Error("Este profissional já possui um atendimento nesse horário.");
  if (error?.code === "23503")
    throw new Error("Este registro está sendo usado por outro módulo e não pode ser excluído.");
  if (error?.code === "23505") throw new Error("Já existe um registro com estes dados.");
  throw new Error(fallback);
}

function requireManager(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Você não possui permissão para realizar esta alteração.");
  }
}

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

/** Planos comerciais: Solo = 1 profissional, Equipe = 8 profissionais. */
const planLimits: Record<string, { name: string; limit: number }> = {
  solo: { name: "Solo", limit: 1 },
  team: { name: "Equipe", limit: 8 },
};

async function planCapacity(
  supabase: SupabaseServerClient,
  tenantId: string,
): Promise<{ name: string; limit: number }> {
  const { data } = await supabase
    .from("tenant_subscriptions")
    .select("status, plan:subscription_plans(code, name)")
    .eq("tenant_id", tenantId)
    .in("status", ["beta", "trial", "active"])
    .limit(1)
    .maybeSingle();
  const code = data?.plan?.code ?? "solo";
  // Qualquer plano legado/desconhecido cai no Solo para nunca exibir limites inválidos.
  return planLimits[code] ?? planLimits["solo"]!;
}

export async function professionalAvailabilityIssue({
  supabase,
  tenantId,
  professionalId,
  startsAt,
  endsAt,
  ignoreAppointmentId,
}: {
  supabase: SupabaseServerClient;
  tenantId: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  ignoreAppointmentId?: string | undefined;
}): Promise<string | null> {
  const conflictQuery = supabase
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("professional_id", professionalId)
    .in("status", ["scheduled", "confirmed"])
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt)
    .limit(1);
  const [professional, tenant, unavailability, conflicts] = await Promise.all([
    supabase
      .from("professionals")
      .select("working_hours")
      .eq("id", professionalId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("tenants").select("timezone").eq("id", tenantId).maybeSingle(),
    supabase
      .from("professional_unavailability")
      .select("starts_at, ends_at")
      .eq("tenant_id", tenantId)
      .eq("professional_id", professionalId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt),
    ignoreAppointmentId ? conflictQuery.neq("id", ignoreAppointmentId) : conflictQuery,
  ]);
  if (!professional.data) return "Profissional indisponível.";
  if ((conflicts.data ?? []).length > 0)
    return "Este profissional já possui um atendimento nesse horário.";
  return professionalSlotBlockReason({
    workingHours: parseWorkingHours(professional.data.working_hours),
    timeZone: tenant.data?.timezone ?? "America/Sao_Paulo",
    startsAt,
    endsAt,
    unavailability: unavailability.data ?? [],
  });
}

type CompanyUpdateResult = { company: Company; locationWarning: string | null };

type CompanyLocation = {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

async function geocodingValues(
  current: Company,
  location: CompanyLocation,
): Promise<{ latitude?: number | null; longitude?: number | null; warning: string | null }> {
  const addressChanged =
    current.address_line !== location.addressLine ||
    current.city !== location.city ||
    current.state !== location.state ||
    current.postal_code !== location.postalCode;
  const hasCoordinates = current.latitude !== null && current.longitude !== null;

  if (!location.addressLine) return { latitude: null, longitude: null, warning: null };
  if (!addressChanged && hasCoordinates) return { warning: null };

  const address = [
    location.addressLine,
    location.city,
    location.state,
    location.postalCode,
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
  try {
    const coordinates = await resolveAddressWithGoogleMaps(address);
    if (coordinates) {
      return {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        warning: null,
      };
    }
  } catch {
    // Address and all other settings must still be saved when the provider is unavailable.
  }
  return {
    latitude: null,
    longitude: null,
    warning:
      "As configurações foram salvas, mas não conseguimos localizar esse endereço. Confira rua, número, cidade, UF e CEP.",
  };
}

const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  productType: z.enum(["beauty", "barber"]),
  document: optionalShortText,
  email: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .transform((value) => value || null),
  phone: optionalShortText,
  whatsapp: optionalShortText,
  whatsappInitialMessage: optionalText,
  whatsappNotificationPhone: optionalShortText,
  whatsappIntegrationMode: z.enum(["development", "cloud_api"]),
  metaPhoneNumberId: optionalShortText,
  metaWabaId: optionalShortText,
  instagram: optionalShortText,
  facebook: optionalShortText,
  description: optionalText,
  addressLine: optionalShortText,
  city: optionalShortText,
  state: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .or(z.literal(""))
    .transform((value) => value || null),
  postalCode: optionalShortText,
  mapUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .or(z.literal(""))
    .transform((value) => value || null),
  businessHours: z.record(z.string(), z.string().max(40)),
  bookingPolicy: z
    .object({
      cancellationPolicyEnabled: z.boolean(),
      cancellationPolicy: optionalText,
      depositEnabled: z.boolean(),
      depositType: z.enum(["none", "percent_30", "percent_50", "fixed"]),
      depositValueCents: z.number().int().min(0),
      paymentMethods: z.object({
        pix: z.boolean(),
        card: z.boolean(),
        local: z.boolean(),
        mercadoPago: z.boolean(),
      }),
      publicStoreEnabled: z.boolean(),
    })
    .optional(),
  publicPage: z
    .object({
      publicName: optionalShortText,
      logoUrl: z
        .string()
        .url()
        .max(1000)
        .or(z.literal(""))
        .transform((value) => value || null),
      bannerUrl: z
        .string()
        .url()
        .max(1000)
        .or(z.literal(""))
        .transform((value) => value || null),
      photoUrl: z
        .string()
        .url()
        .max(1000)
        .or(z.literal(""))
        .transform((value) => value || null),
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      cardColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      menuColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      titleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      welcomeMessage: optionalText,
      cancellationPolicy: optionalText,
      publicInformation: z
        .string()
        .trim()
        .max(1500)
        .optional()
        .transform((value) => value || null),
      status: z.enum(["draft", "published", "disabled"]),
      bookingIntervalMinutes: z.union([
        z.literal(10),
        z.literal(15),
        z.literal(20),
        z.literal(30),
        z.literal(45),
        z.literal(60),
      ]),
    })
    .optional(),
});

export const getCompany = createServerFn({ method: "GET" }).handler(async (): Promise<Company> => {
  const { supabase, tenantId } = await tenantContext();
  const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
  if (error || !data) databaseError(error, "Não foi possível carregar os dados da empresa.");
  return data;
});

export const updateCompany = createServerFn({ method: "POST" })
  .validator(companySchema)
  .handler(async ({ data }): Promise<CompanyUpdateResult> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { data: current, error: currentError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();
    if (currentError || !current)
      databaseError(currentError, "Não foi possível carregar os dados da empresa.");
    const geocoding = await geocodingValues(current, {
      addressLine: data.addressLine,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
    });
    if (data.publicPage?.status === "published") {
      const [{ count: services }, { count: professionals }] = await Promise.all([
        supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("active", true),
        supabase
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("active", true),
      ]);
      if (!services)
        throw new Error("Cadastre ao menos um serviço ativo antes de publicar a página.");
      if (!professionals)
        throw new Error("Cadastre ao menos um profissional ativo antes de publicar a página.");
      if (
        !Object.values(data.businessHours).some((hours) => {
          const texto = (hours ?? "").trim().toLowerCase();
          return texto && texto !== "closed" && texto !== "fechado";
        })
      ) {
        throw new Error("Configure ao menos um dia de funcionamento antes de publicar a página.");
      }
    }
    const publicValues = data.publicPage
      ? {
          public_name: data.publicPage.publicName,
          logo_url: data.publicPage.logoUrl,
          banner_url: data.publicPage.bannerUrl,
          photo_url: data.publicPage.photoUrl,
          primary_color: data.publicPage.primaryColor,
          secondary_color: data.publicPage.secondaryColor,
          accent_color: data.publicPage.accentColor,
          button_color: data.publicPage.buttonColor,
          card_color: data.publicPage.cardColor,
          menu_color: data.publicPage.menuColor,
          background_color: data.publicPage.backgroundColor,
          title_color: data.publicPage.titleColor,
          text_color: data.publicPage.textColor,
          welcome_message: data.publicPage.welcomeMessage,
          cancellation_policy: data.publicPage.cancellationPolicy,
          public_information: data.publicPage.publicInformation,
          public_page_status: data.publicPage.status,
          booking_interval_minutes: data.publicPage.bookingIntervalMinutes,
        }
      : {};
    const { data: updated, error } = await supabase
      .from("tenants")
      .update({
        name: data.name,
        document: data.document,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp,
        whatsapp_initial_message: data.whatsappInitialMessage,
        whatsapp_notification_phone: data.whatsappNotificationPhone,
        whatsapp_integration_mode: data.whatsappIntegrationMode,
        meta_phone_number_id: data.metaPhoneNumberId,
        meta_waba_id: data.metaWabaId,
        instagram: data.instagram,
        facebook: data.facebook,
        description: data.description,
        address_line: data.addressLine,
        city: data.city,
        state: data.state,
        postal_code: data.postalCode,
        ...(geocoding.latitude !== undefined
          ? { latitude: geocoding.latitude, longitude: geocoding.longitude }
          : {}),
        map_url: data.mapUrl,
        business_hours: data.businessHours,
        ...(data.bookingPolicy
          ? {
              cancellation_policy_enabled: data.bookingPolicy.cancellationPolicyEnabled,
              cancellation_policy: data.bookingPolicy.cancellationPolicy,
              deposit_enabled: data.bookingPolicy.depositEnabled,
              deposit_type: data.bookingPolicy.depositType,
              deposit_value_cents: data.bookingPolicy.depositValueCents,
              payment_methods: data.bookingPolicy.paymentMethods,
              public_store_enabled: data.bookingPolicy.publicStoreEnabled,
            }
          : {}),
        ...publicValues,
      })
      .eq("id", tenantId)
      .select()
      .single();
    if (error || !updated) databaseError(error, "Não foi possível salvar a empresa.");
    return { company: updated, locationWarning: geocoding.warning };
  });

const publicSettingsSchema = z.object({
  logoUrl: z
    .string()
    .url()
    .max(1000)
    .or(z.literal(""))
    .transform((value) => value || null),
  bannerUrl: z
    .string()
    .url()
    .max(1000)
    .or(z.literal(""))
    .transform((value) => value || null),
  description: optionalText,
  addressLine: optionalShortText,
  city: optionalShortText,
  state: z
    .string()
    .trim()
    .max(2)
    .transform((value) => value.toUpperCase() || null),
  postalCode: optionalShortText,
  mapUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .or(z.literal(""))
    .transform((value) => value || null),
  showPublicLocation: z.boolean(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  pageEnabled: z.boolean(),
  cancellationPolicyEnabled: z.boolean(),
  cancellationPolicy: optionalText,
  depositEnabled: z.boolean(),
  depositType: z.enum(["none", "percent_30", "percent_50", "fixed"]),
  depositValueCents: z.number().int().min(0),
  paymentMethods: z.object({
    pix: z.boolean(),
    card: z.boolean(),
    local: z.boolean(),
    mercadoPago: z.boolean(),
  }),
  publicStoreEnabled: z.boolean(),
});

export const updatePublicSettings = createServerFn({ method: "POST" })
  .validator(publicSettingsSchema)
  .handler(async ({ data }): Promise<CompanyUpdateResult> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { data: current, error: currentError } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();
    if (currentError || !current)
      databaseError(currentError, "Não foi possível carregar os dados da empresa.");
    const geocoding = await geocodingValues(current, {
      addressLine: data.addressLine,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
    });
    const secondary = data.secondaryColor || data.primaryColor;
    const { data: updated, error } = await supabase
      .from("tenants")
      .update({
        logo_url: data.logoUrl,
        banner_url: data.bannerUrl,
        description: data.description,
        address_line: data.addressLine,
        city: data.city,
        state: data.state,
        postal_code: data.postalCode,
        ...(geocoding.latitude !== undefined
          ? { latitude: geocoding.latitude, longitude: geocoding.longitude }
          : {}),
        map_url: data.mapUrl,
        show_public_location: data.showPublicLocation,
        primary_color: data.primaryColor,
        secondary_color: secondary,
        accent_color: secondary,
        button_color: data.primaryColor,
        card_color: "#ffffff",
        menu_color: secondary,
        background_color: "#ffffff",
        title_color: data.textColor,
        text_color: data.textColor,
        public_page_status: data.pageEnabled ? "published" : "disabled",
        cancellation_policy_enabled: data.cancellationPolicyEnabled,
        cancellation_policy: data.cancellationPolicy,
        deposit_enabled: data.depositEnabled,
        deposit_type: data.depositEnabled ? data.depositType : "none",
        deposit_value_cents: data.depositValueCents,
        payment_methods: data.paymentMethods,
        public_store_enabled: data.publicStoreEnabled,
      })
      .eq("id", tenantId)
      .select("*")
      .single();
    if (error || !updated) databaseError(error, "Não foi possível atualizar a página pública.");
    return { company: updated, locationWarning: geocoding.warning };
  });

const publicMediaSchema = z.object({
  kind: z.enum(["logo", "banner", "photo", "gallery"]),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().max(4_200_000),
  key: z.string().uuid().optional(),
});

export const uploadPublicMedia = createServerFn({ method: "POST" })
  .validator(publicMediaSchema)
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const bytes = Buffer.from(data.base64, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) {
      throw new Error("A imagem deve ter no máximo 3 MB.");
    }
    const extension =
      data.mimeType === "image/png" ? "png" : data.mimeType === "image/webp" ? "webp" : "jpg";
    const path =
      data.kind === "gallery"
        ? `${tenantId}/gallery/${data.key ?? crypto.randomUUID()}.${extension}`
        : `${tenantId}/${data.kind}.${extension}`;
    const { error } = await supabase.storage.from("public-page-media").upload(path, bytes, {
      contentType: data.mimeType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) throw new Error("Não foi possível enviar a imagem.");
    const { data: publicUrl } = supabase.storage.from("public-page-media").getPublicUrl(path);
    return { url: `${publicUrl.publicUrl}?v=${Date.now()}` };
  });

const gallerySchema = z.object({
  id: z.string().uuid().optional(),
  imageUrl: z.string().url().max(1000),
  altText: optionalShortText,
  sortOrder: z.number().int().min(0).max(10000),
  active: z.boolean(),
});
const reviewSchema = z.object({
  id: z.string().uuid().optional(),
  clientName: z.string().trim().min(2).max(120),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(2).max(1000),
  sortOrder: z.number().int().min(0).max(10000),
  active: z.boolean(),
});

export const getPublicPageContent = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId } = await tenantContext();
  const [gallery, reviews] = await Promise.all([
    supabase.from("public_gallery").select("*").eq("tenant_id", tenantId).order("sort_order"),
    supabase.from("public_reviews").select("*").eq("tenant_id", tenantId).order("sort_order"),
  ]);
  if (gallery.error || reviews.error)
    databaseError(gallery.error ?? reviews.error, "Não foi possível carregar o conteúdo público.");
  return { gallery: gallery.data ?? [], reviews: reviews.data ?? [] };
});

export const saveGalleryItem = createServerFn({ method: "POST" })
  .validator(gallerySchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      image_url: data.imageUrl,
      alt_text: data.altText,
      sort_order: data.sortOrder,
      active: data.active,
    };
    const query = data.id
      ? supabase.from("public_gallery").update(values).eq("id", data.id).eq("tenant_id", tenantId)
      : supabase.from("public_gallery").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar a foto.");
    return saved;
  });
export const deleteGalleryItem = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { error } = await supabase
      .from("public_gallery")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir a foto.");
    return { success: true } as const;
  });

export const savePublicReview = createServerFn({ method: "POST" })
  .validator(reviewSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      client_name: data.clientName,
      rating: data.rating,
      comment: data.comment,
      sort_order: data.sortOrder,
      active: data.active,
    };
    const query = data.id
      ? supabase.from("public_reviews").update(values).eq("id", data.id).eq("tenant_id", tenantId)
      : supabase.from("public_reviews").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar a avaliação.");
    return saved;
  });
export const deletePublicReview = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { error } = await supabase
      .from("public_reviews")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir a avaliação.");
    return { success: true } as const;
  });

const professionalSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  specialty: optionalShortText,
  email: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .transform((value) => value || null),
  phone: optionalShortText,
  commissionPercent: z.number().min(0).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.boolean(),
  notes: optionalText,
  bio: optionalText,
  photoUrl: z
    .string()
    .url()
    .max(1000)
    .or(z.literal(""))
    .transform((value) => value || null),
  serviceIds: z.array(z.string().uuid()).max(100),
});

export const listProfessionals = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProfessionalWithServices[]> => {
    const { supabase, tenantId } = await tenantContext();
    const [professionals, links] = await Promise.all([
      supabase
        .from("professionals")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("active", { ascending: false })
        .order("name"),
      supabase
        .from("professional_services")
        .select("professional_id, service_id")
        .eq("tenant_id", tenantId),
    ]);
    if (professionals.error || links.error)
      databaseError(
        professionals.error ?? links.error,
        "Não foi possível carregar os profissionais.",
      );
    return (professionals.data ?? []).map((professional) => ({
      ...professional,
      serviceIds: (links.data ?? [])
        .filter((link) => link.professional_id === professional.id)
        .map((link) => link.service_id),
    }));
  },
);

export const saveProfessional = createServerFn({ method: "POST" })
  .validator(professionalSchema)
  .handler(async ({ data }): Promise<Professional> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    if (data.active) {
      const [plan, activeProfessionals] = await Promise.all([
        planCapacity(supabase, tenantId),
        supabase.from("professionals").select("id").eq("tenant_id", tenantId).eq("active", true),
      ]);
      const others = (activeProfessionals.data ?? []).filter(
        (professional) => professional.id !== data.id,
      ).length;
      if (others >= plan.limit) {
        throw new Error(
          `Seu plano ${plan.name} permite ${plan.limit} profissional${plan.limit > 1 ? "is" : ""} ativo${plan.limit > 1 ? "s" : ""}. Faça upgrade do plano para cadastrar mais.`,
        );
      }
    }
    const values = {
      tenant_id: tenantId,
      name: data.name,
      specialty: data.specialty,
      email: data.email,
      phone: data.phone,
      commission_percent: data.commissionPercent,
      color: data.color,
      active: data.active,
      notes: data.notes,
      bio: data.bio,
      photo_url: data.photoUrl,
    };
    const query = data.id
      ? supabase.from("professionals").update(values).eq("id", data.id).eq("tenant_id", tenantId)
      : supabase.from("professionals").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o profissional.");
    const { error: clearError } = await supabase
      .from("professional_services")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("professional_id", saved.id);
    if (clearError)
      databaseError(clearError, "Não foi possível atualizar os serviços do profissional.");
    if (data.serviceIds.length) {
      const { error: linkError } = await supabase.from("professional_services").insert(
        data.serviceIds.map((serviceId) => ({
          tenant_id: tenantId,
          professional_id: saved.id,
          service_id: serviceId,
        })),
      );
      if (linkError)
        databaseError(linkError, "Não foi possível atualizar os serviços do profissional.");
    }
    return saved;
  });

export const deleteProfessional = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role, user } = await tenantContext();
    requireManager(role);
    if (data.id === user.id)
      throw new Error("O profissional vinculado ao proprietário não pode ser excluído.");
    const { error } = await supabase
      .from("professionals")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir o profissional.");
    return { success: true } as const;
  });

const scheduleDaySchema = z.object({
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

export const saveProfessionalSchedule = createServerFn({ method: "POST" })
  .validator(
    z.object({
      professionalId: z.string().uuid(),
      followCompanyHours: z.boolean(),
      days: z.array(scheduleDaySchema).max(7),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
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
    const { error } = await supabase
      .from("professionals")
      .update({ working_hours: workingHours })
      .eq("id", data.professionalId)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível salvar a agenda do profissional.");
    return { success: true } as const;
  });

export const listProfessionalUnavailability = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabase, tenantId } = await tenantContext();
    const { data, error } = await supabase
      .from("professional_unavailability")
      .select("id, professional_id, starts_at, ends_at, reason")
      .eq("tenant_id", tenantId)
      .gte("ends_at", new Date(Date.now() - 86_400_000).toISOString())
      .order("starts_at");
    if (error) databaseError(error, "Não foi possível carregar os bloqueios.");
    return data ?? [];
  },
);

export const saveProfessionalUnavailability = createServerFn({ method: "POST" })
  .validator(
    z.object({
      professionalId: z.string().uuid(),
      startsAt: z.string().datetime({ offset: true }),
      endsAt: z.string().datetime({ offset: true }),
      reason: optionalShortText,
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, tenantId, role, user } = await tenantContext();
    requireManager(role);
    if (new Date(data.endsAt) <= new Date(data.startsAt))
      throw new Error("O fim do bloqueio deve ser depois do início.");
    const { error } = await supabase.from("professional_unavailability").insert({
      tenant_id: tenantId,
      professional_id: data.professionalId,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      reason: data.reason,
      created_by: user.id,
    });
    if (error) databaseError(error, "Não foi possível salvar o bloqueio.");
    return { success: true } as const;
  });

export const deleteProfessionalUnavailability = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { error } = await supabase
      .from("professional_unavailability")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível remover o bloqueio.");
    return { success: true } as const;
  });

export const getProfessionalCapacity = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId } = await tenantContext();
  const [plan, professionals] = await Promise.all([
    planCapacity(supabase, tenantId),
    supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("active", true),
  ]);
  const used = professionals.count ?? 0;
  return {
    planName: plan.name,
    limit: plan.limit,
    used,
    remaining: Math.max(plan.limit - used, 0),
    canAddMore: used < plan.limit,
  };
});

const clientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  phone: optionalShortText,
  email: z
    .string()
    .trim()
    .email()
    .or(z.literal(""))
    .transform((value) => value || null),
  birthDate: z
    .string()
    .date()
    .or(z.literal(""))
    .transform((value) => value || null),
  address: optionalShortText,
  notes: optionalText,
  contactAllowed: z.boolean(),
  contactPreference: z.enum(["whatsapp", "phone", "email", "none"]),
  active: z.boolean(),
});

export const listClients = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketingClient[]> => {
    const { supabase, tenantId } = await tenantContext();
    const [clientsResult, appointmentsResult] = await Promise.all([
      supabase
        .from("clients")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("active", { ascending: false })
        .order("name"),
      supabase
        .from("appointments")
        .select("client_id, starts_at, services(name), professionals(name)")
        .eq("tenant_id", tenantId)
        .in("status", ["completed", "confirmed"])
        .order("starts_at", { ascending: false }),
    ]);
    if (clientsResult.error || appointmentsResult.error)
      databaseError(
        clientsResult.error ?? appointmentsResult.error,
        "Não foi possível carregar os clientes.",
      );
    const latest = new Map<string, NonNullable<typeof appointmentsResult.data>[number]>();
    for (const appointment of appointmentsResult.data ?? []) {
      if (!latest.has(appointment.client_id)) latest.set(appointment.client_id, appointment);
    }
    return (clientsResult.data ?? []).map((client) => {
      const appointment = latest.get(client.id);
      return {
        ...client,
        lastAppointmentAt: appointment?.starts_at ?? null,
        lastServiceName: appointment?.services?.name ?? null,
        lastProfessionalName: appointment?.professionals?.name ?? null,
      };
    });
  },
);

export const saveClient = createServerFn({ method: "POST" })
  .validator(clientSchema)
  .handler(async ({ data }): Promise<Client> => {
    const { supabase, tenantId } = await tenantContext();
    const values = {
      tenant_id: tenantId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      birth_date: data.birthDate,
      address: data.address,
      notes: data.notes,
      contact_allowed: data.contactAllowed,
      contact_preference: data.contactPreference,
      active: data.active,
    };
    const query = data.id
      ? supabase.from("clients").update(values).eq("id", data.id).eq("tenant_id", tenantId)
      : supabase.from("clients").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o cliente.");
    return saved;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId } = await tenantContext();
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir o cliente.");
    return { success: true } as const;
  });

const campaignType = z.enum([
  "post_service",
  "birthday",
  "promotion",
  "win_back",
  "return_reminder",
  "custom",
]);

export const getMarketing = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId } = await tenantContext();
  const [
    clientsResult,
    appointmentsResult,
    templatesResult,
    campaignsResult,
    actionsResult,
    companyResult,
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("tenant_id", tenantId).eq("active", true).order("name"),
    supabase
      .from("appointments")
      .select("client_id, starts_at, status, services(name), professionals(name)")
      .eq("tenant_id", tenantId)
      .in("status", ["completed", "confirmed"])
      .order("starts_at", { ascending: false }),
    supabase.from("marketing_templates").select("*").eq("tenant_id", tenantId).order("name"),
    supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("marketing_actions")
      .select("*, clients(name, phone)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("tenants").select("name, slug, product_type").eq("id", tenantId).single(),
  ]);
  const error =
    clientsResult.error ??
    appointmentsResult.error ??
    templatesResult.error ??
    campaignsResult.error ??
    actionsResult.error ??
    companyResult.error;
  if (error) databaseError(error, "Não foi possível carregar o Marketing.");

  const latest = new Map<string, NonNullable<typeof appointmentsResult.data>[number]>();
  for (const appointment of appointmentsResult.data ?? []) {
    if (!latest.has(appointment.client_id)) latest.set(appointment.client_id, appointment);
  }
  const clients: MarketingClient[] = (clientsResult.data ?? []).map((client) => {
    const appointment = latest.get(client.id);
    return {
      ...client,
      lastAppointmentAt: appointment?.starts_at ?? null,
      lastServiceName: appointment?.services?.name ?? null,
      lastProfessionalName: appointment?.professionals?.name ?? null,
    };
  });
  return {
    clients,
    templates: (templatesResult.data ?? []) as MarketingTemplate[],
    campaigns: (campaignsResult.data ?? []) as MarketingCampaign[],
    actions: (actionsResult.data ?? []) as MarketingAction[],
    company: companyResult.data!,
  };
});

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  campaignType,
  body: z.string().trim().min(2).max(2000),
  active: z.boolean(),
});
export const saveMarketingTemplate = createServerFn({ method: "POST" })
  .validator(templateSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      name: data.name,
      campaign_type: data.campaignType,
      body: data.body,
      active: data.active,
    };
    const query = data.id
      ? supabase
          .from("marketing_templates")
          .update(values)
          .eq("id", data.id)
          .eq("tenant_id", tenantId)
      : supabase.from("marketing_templates").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o modelo.");
    return saved;
  });

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  templateId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  campaignType,
  message: z.string().trim().min(2).max(2000),
  status: z.enum(["draft", "active", "completed"]),
});
export const saveMarketingCampaign = createServerFn({ method: "POST" })
  .validator(campaignSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      template_id: data.templateId ?? null,
      name: data.name,
      campaign_type: data.campaignType,
      message: data.message,
      status: data.status,
    };
    const query = data.id
      ? supabase
          .from("marketing_campaigns")
          .update(values)
          .eq("id", data.id)
          .eq("tenant_id", tenantId)
      : supabase.from("marketing_campaigns").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar a campanha.");
    return saved;
  });

const actionSchema = z.object({
  id: z.string().uuid().optional(),
  campaignId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid(),
  message: z.string().trim().min(2).max(2000),
  status: z.enum(["queued", "initiated", "sent", "responded", "converted"]),
});
export const saveMarketingAction = createServerFn({ method: "POST" })
  .validator(actionSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId } = await tenantContext();
    if (data.status === "initiated") {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("contact_allowed, phone_normalized")
        .eq("id", data.clientId)
        .eq("tenant_id", tenantId)
        .single();
      if (clientError || !client?.contact_allowed || !client.phone_normalized) {
        throw new Error("Este cliente não possui WhatsApp e autorização de contato válidos.");
      }
    }
    const now = new Date().toISOString();
    const values = {
      tenant_id: tenantId,
      campaign_id: data.campaignId ?? null,
      client_id: data.clientId,
      message_snapshot: data.message,
      status: data.status,
      initiated_at: data.status === "initiated" ? now : null,
      sent_at: data.status === "sent" ? now : null,
      responded_at: data.status === "responded" ? now : null,
      converted_at: data.status === "converted" ? now : null,
    };
    const query = data.id
      ? supabase
          .from("marketing_actions")
          .update(values)
          .eq("id", data.id)
          .eq("tenant_id", tenantId)
      : supabase.from("marketing_actions").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível registrar a ação.");
    return saved;
  });

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  category: optionalShortText,
  description: optionalText,
  durationMinutes: z.number().int().min(5).max(1440),
  priceCents: z.number().int().min(0).max(100_000_000),
  active: z.boolean(),
});

export const listServices = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServiceWithUsage[]> => {
    const { supabase, tenantId } = await tenantContext();
    const [servicesResult, appointmentsResult, linksResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("active", { ascending: false })
        .order("name"),
      supabase.from("appointments").select("service_id, starts_at").eq("tenant_id", tenantId),
      supabase.from("professional_services").select("service_id").eq("tenant_id", tenantId),
    ]);
    if (servicesResult.error)
      databaseError(servicesResult.error, "Não foi possível carregar os serviços.");
    const now = Date.now();
    const history = new Map<string, number>();
    const upcoming = new Map<string, number>();
    for (const appointment of appointmentsResult.data ?? []) {
      if (!appointment.service_id) continue;
      history.set(appointment.service_id, (history.get(appointment.service_id) ?? 0) + 1);
      if (new Date(appointment.starts_at).getTime() > now)
        upcoming.set(appointment.service_id, (upcoming.get(appointment.service_id) ?? 0) + 1);
    }
    const linked = new Set((linksResult.data ?? []).map((link) => link.service_id));
    return servicesResult.data.map((service) => {
      const appointments = history.get(service.id) ?? 0;
      const futureAppointments = upcoming.get(service.id) ?? 0;
      return {
        ...service,
        appointments,
        futureAppointments,
        linkedToProfessionals: linked.has(service.id),
        deletable: appointments === 0 && futureAppointments === 0,
      };
    });
  },
);

/** Inativa ou reativa um serviço preservando todo o histórico vinculado. */
export const setServiceActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data }): Promise<Service> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { data: saved, error } = await supabase
      .from("services")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();
    if (error || !saved)
      databaseError(
        error,
        data.active ? "Não foi possível reativar o serviço." : "Não foi possível inativar o serviço.",
      );
    return saved;
  });

export const saveService = createServerFn({ method: "POST" })
  .validator(serviceSchema)
  .handler(async ({ data }): Promise<Service> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      name: data.name,
      category: data.category,
      description: data.description,
      duration_minutes: data.durationMinutes,
      price_cents: data.priceCents,
      active: data.active,
    };
    const query = data.id
      ? supabase.from("services").update(values).eq("id", data.id).eq("tenant_id", tenantId)
      : supabase.from("services").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o serviço.");
    return saved;
  });

/** Exclui apenas quando é seguro: sem histórico e sem agendamentos futuros. */
export const deleteService = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { count, error: usageError } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("service_id", data.id);
    if (usageError) databaseError(usageError, "Não foi possível verificar os vínculos do serviço.");
    if ((count ?? 0) > 0)
      throw new Error(
        "Este serviço possui histórico de agendamentos e não pode ser excluído. Use “Inativar serviço” para removê-lo da página pública sem perder o histórico.",
      );
    await supabase
      .from("professional_services")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("service_id", data.id);
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir o serviço.");
    return { success: true } as const;
  });

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  sku: optionalShortText,
  category: optionalShortText,
  description: optionalText,
  costCents: z.number().int().min(0),
  salePriceCents: z.number().int().min(0),
  initialStock: z.number().int().min(0),
  minimumStock: z.number().int().min(0),
  unit: z.string().trim().min(1).max(12),
  active: z.boolean(),
  imageUrl: z
    .string()
    .url()
    .max(1000)
    .or(z.literal(""))
    .transform((value) => value || null),
  publicVisible: z.boolean(),
});

export const listProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProductWithUsage[]> => {
    const { supabase, tenantId } = await tenantContext();
    const [productsResult, movementsResult] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("active", { ascending: false })
        .order("name"),
      supabase
        .from("inventory_movements")
        .select("product_id, reason")
        .eq("tenant_id", tenantId),
    ]);
    if (productsResult.error)
      databaseError(productsResult.error, "Não foi possível carregar os produtos.");
    // Só o saldo inicial não conta como histórico: ele nasce junto com o cadastro.
    const movements = new Map<string, number>();
    for (const movement of movementsResult.data ?? []) {
      if (!movement.product_id || movement.reason === "initial") continue;
      movements.set(movement.product_id, (movements.get(movement.product_id) ?? 0) + 1);
    }
    return productsResult.data.map((product) => {
      const used = movements.get(product.id) ?? 0;
      return { ...product, movements: used, deletable: used === 0 };
    });
  },
);

/** Inativa ou reativa um produto preservando estoque e histórico de movimentações. */
export const setProductActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data }): Promise<Product> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { data: saved, error } = await supabase
      .from("products")
      .update({ active: data.active })
      .eq("id", data.id)
      .eq("tenant_id", tenantId)
      .select()
      .single();
    if (error || !saved)
      databaseError(
        error,
        data.active ? "Não foi possível reativar o produto." : "Não foi possível inativar o produto.",
      );
    return saved;
  });


export const saveProduct = createServerFn({ method: "POST" })
  .validator(productSchema)
  .handler(async ({ data }): Promise<Product> => {
    const { supabase, tenantId, role, user } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      name: data.name,
      sku: data.sku,
      category: data.category,
      description: data.description,
      cost_cents: data.costCents,
      sale_price_cents: data.salePriceCents,
      minimum_stock: data.minimumStock,
      unit: data.unit,
      active: data.active,
      image_url: data.imageUrl,
      public_visible: data.publicVisible,
    };
    if (data.id) {
      const { data: saved, error } = await supabase
        .from("products")
        .update(values)
        .eq("id", data.id)
        .eq("tenant_id", tenantId)
        .select()
        .single();
      if (error || !saved) databaseError(error, "Não foi possível salvar o produto.");
      return saved;
    }
    const { data: saved, error } = await supabase
      .from("products")
      .insert({ ...values, stock_quantity: 0 })
      .select()
      .single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o produto.");
    if (data.initialStock > 0) {
      const { error: stockError } = await supabase.from("inventory_movements").insert({
        tenant_id: tenantId,
        product_id: saved.id,
        quantity_delta: data.initialStock,
        reason: "initial",
        notes: "Saldo informado no cadastro do produto.",
        created_by: user.id,
      });
      if (stockError) {
        await supabase.from("products").delete().eq("id", saved.id).eq("tenant_id", tenantId);
        databaseError(stockError, "Não foi possível registrar o estoque inicial.");
      }
      return { ...saved, stock_quantity: data.initialStock };
    }
    return saved;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { count, error: usageError } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("product_id", data.id)
      .neq("reason", "initial");
    if (usageError) databaseError(usageError, "Não foi possível verificar o histórico do produto.");
    if ((count ?? 0) > 0)
      throw new Error(
        "Este produto tem movimentações registradas. Inative-o para preservar o histórico.",
      );
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir o produto.");
    return { success: true } as const;
  });

const stockSchema = z.object({
  productId: z.string().uuid(),
  quantityDelta: z
    .number()
    .int()
    .refine((value) => value !== 0),
  reason: z.enum(["purchase", "sale", "use", "loss", "adjustment"]),
  notes: optionalText,
});

export const getInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId } = await tenantContext();
  const [{ data: products, error: productError }, { data: movements, error: movementError }] =
    await Promise.all([
      supabase.from("products").select("*").eq("tenant_id", tenantId).order("name"),
      supabase
        .from("inventory_movements")
        .select("*, products(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
  if (productError || movementError)
    databaseError(productError ?? movementError, "Não foi possível carregar o estoque.");
  return { products: products ?? [], movements: (movements ?? []) as InventoryMovement[] };
});

export const adjustStock = createServerFn({ method: "POST" })
  .validator(stockSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role, user } = await tenantContext();
    requireManager(role);
    const { error } = await supabase.from("inventory_movements").insert({
      tenant_id: tenantId,
      product_id: data.productId,
      quantity_delta: data.quantityDelta,
      reason: data.reason,
      notes: data.notes,
      created_by: user.id,
    });
    if (error) databaseError(error, "Não foi possível movimentar o estoque.");
    return { success: true } as const;
  });

const appointmentSchema = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]),
  notes: optionalText,
});

export const getAgenda = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId } = await tenantContext();
  const start = new Date();
  start.setMonth(start.getMonth() - 2, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setMonth(end.getMonth() + 4, 1);
  const [appointmentsResult, clientsResult, servicesResult, professionalsResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(name, phone), services(name, duration_minutes), professionals(name)")
        .eq("tenant_id", tenantId)
        .gte("starts_at", start.toISOString())
        .lt("starts_at", end.toISOString())
        .order("starts_at"),
      supabase
        .from("clients")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("services")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("professionals")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("name"),
    ]);
  const error =
    appointmentsResult.error ??
    clientsResult.error ??
    servicesResult.error ??
    professionalsResult.error;
  if (error) databaseError(error, "Não foi possível carregar a agenda.");
  return {
    appointments: appointmentsResult.data as Appointment[],
    clients: clientsResult.data ?? [],
    services: servicesResult.data ?? [],
    professionals: professionalsResult.data ?? [],
  };
});

export const saveAppointment = createServerFn({ method: "POST" })
  .validator(appointmentSchema)
  .handler(async ({ data }): Promise<Appointment> => {
    const { supabase, tenantId } = await tenantContext();
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration_minutes, price_cents, active")
      .eq("id", data.serviceId)
      .eq("tenant_id", tenantId)
      .single();
    if (serviceError || !service) databaseError(serviceError, "Serviço inválido.");
    if (!service.active && !data.id)
      throw new Error("Este serviço está inativo e não pode ser usado em novos agendamentos.");
    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);
    if (data.status === "scheduled" || data.status === "confirmed") {
      const blocked = await professionalAvailabilityIssue({
        supabase,
        tenantId,
        professionalId: data.professionalId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        ignoreAppointmentId: data.id,
      });

      if (blocked) throw new Error(blocked);
    }
    const values = {
      tenant_id: tenantId,
      client_id: data.clientId,
      service_id: data.serviceId,
      professional_id: data.professionalId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_cents: service.price_cents,
      status: data.status,
      notes: data.notes,
    };
    const query = data.id
      ? supabase.from("appointments").update(values).eq("id", data.id).eq("tenant_id", tenantId)
      : supabase.from("appointments").insert(values);
    const { data: saved, error } = await query
      .select("*, clients(name, phone), services(name, duration_minutes), professionals(name)")
      .single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o agendamento.");
    return saved as Appointment;
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId } = await tenantContext();
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir o agendamento.");
    return { success: true } as const;
  });

const financeSchema = z.object({
  id: z.string().uuid().optional(),
  entryType: z.enum(["income", "expense"]),
  description: z.string().trim().min(2).max(160),
  category: optionalShortText,
  amountCents: z.number().int().positive(),
  dueDate: z.string().date(),
  status: z.enum(["pending", "paid", "cancelled"]),
  paymentMethod: optionalShortText,
  notes: optionalText,
});

export const listFinancialEntries = createServerFn({ method: "GET" }).handler(
  async (): Promise<FinancialEntry[]> => {
    const { supabase, tenantId, role } = await tenantContext();
    if (role === "professional" || role === "receptionist")
      throw new Error("Acesso financeiro não autorizado.");
    const { data, error } = await supabase
      .from("financial_entries")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("due_date", { ascending: false });
    if (error) databaseError(error, "Não foi possível carregar o financeiro.");
    return data;
  },
);

export const saveFinancialEntry = createServerFn({ method: "POST" })
  .validator(financeSchema)
  .handler(async ({ data }): Promise<FinancialEntry> => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const values = {
      tenant_id: tenantId,
      entry_type: data.entryType,
      description: data.description,
      category: data.category,
      amount_cents: data.amountCents,
      due_date: data.dueDate,
      status: data.status,
      paid_at: data.status === "paid" ? new Date().toISOString() : null,
      payment_method: data.paymentMethod,
      notes: data.notes,
    };
    const query = data.id
      ? supabase
          .from("financial_entries")
          .update(values)
          .eq("id", data.id)
          .eq("tenant_id", tenantId)
      : supabase.from("financial_entries").insert(values);
    const { data: saved, error } = await query.select().single();
    if (error || !saved) databaseError(error, "Não foi possível salvar o lançamento.");
    return saved;
  });

export const deleteFinancialEntry = createServerFn({ method: "POST" })
  .validator(idSchema)
  .handler(async ({ data }) => {
    const { supabase, tenantId, role } = await tenantContext();
    requireManager(role);
    const { error } = await supabase
      .from("financial_entries")
      .delete()
      .eq("id", data.id)
      .eq("tenant_id", tenantId);
    if (error) databaseError(error, "Não foi possível excluir o lançamento.");
    return { success: true } as const;
  });

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId } = await tenantContext();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [appointments, clients, professionals, services, finances, lowStock, notifications] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("*, clients(name, phone), services(name, duration_minutes), professionals(name)")
        .eq("tenant_id", tenantId)
        .gte("starts_at", todayStart.toISOString())
        .lt("starts_at", todayEnd.toISOString())
        .order("starts_at"),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("active", true),
      supabase
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("active", true),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("active", true),
      supabase
        .from("financial_entries")
        .select("entry_type, amount_cents")
        .eq("tenant_id", tenantId)
        .eq("status", "paid")
        .gte("due_date", monthStart.toISOString().slice(0, 10))
        .lt("due_date", monthEnd.toISOString().slice(0, 10)),
      supabase
        .from("products")
        .select("stock_quantity, minimum_stock")
        .eq("tenant_id", tenantId)
        .eq("active", true),
      supabase
        .from("notification_outbox")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "development", "failed"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  const error =
    appointments.error ??
    clients.error ??
    professionals.error ??
    services.error ??
    finances.error ??
    lowStock.error;
  // Notification errors must not make the operational dashboard unavailable during rollout.
  if (error) databaseError(error, "Não foi possível carregar o dashboard.");
  const revenue = (finances.data ?? []).reduce(
    (total, item) =>
      total + (item.entry_type === "income" ? item.amount_cents : -item.amount_cents),
    0,
  );
  return {
    appointments: (appointments.data ?? []) as Appointment[],
    clients: clients.count ?? 0,
    professionals: professionals.count ?? 0,
    services: services.count ?? 0,
    monthBalanceCents: revenue,
    lowStock: (lowStock.data ?? []).filter((item) => item.stock_quantity <= item.minimum_stock)
      .length,
    notifications: notifications.data ?? [],
  };
});

export const getReports = createServerFn({ method: "GET" }).handler(async () => {
  const { supabase, tenantId, role } = await tenantContext();
  if (role === "professional" || role === "receptionist")
    throw new Error("Acesso a relatórios não autorizado.");
  const from = new Date();
  from.setMonth(from.getMonth() - 5, 1);
  from.setHours(0, 0, 0, 0);
  const [appointments, finances, products] = await Promise.all([
    supabase
      .from("appointments")
      .select("status, starts_at, price_cents, services(name), professionals(name)")
      .eq("tenant_id", tenantId)
      .gte("starts_at", from.toISOString()),
    supabase
      .from("financial_entries")
      .select("entry_type, amount_cents, due_date, status")
      .eq("tenant_id", tenantId)
      .gte("due_date", from.toISOString().slice(0, 10)),
    supabase
      .from("products")
      .select("name, stock_quantity, minimum_stock, cost_cents")
      .eq("tenant_id", tenantId)
      .eq("active", true),
  ]);
  const error = appointments.error ?? finances.error ?? products.error;
  if (error) databaseError(error, "Não foi possível gerar os relatórios.");
  return {
    appointments: appointments.data ?? [],
    finances: finances.data ?? [],
    products: products.data ?? [],
  };
});
