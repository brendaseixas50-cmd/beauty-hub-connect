import { z } from "zod";

const companySchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  description: z.string().nullable(),
  productType: z.enum(["beauty", "barber"]),
  whatsapp: z.string().nullable(),
  whatsappInitialMessage: z.string().nullable(),
  instagram: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  businessHours: z.record(z.string(), z.string()),
  timezone: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  welcomeMessage: z.string().nullable(),
  cancellationPolicy: z.string().nullable(),
  publicInformation: z.string().nullable(),
  bookingIntervalMinutes: z.number(),
});

const serviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  durationMinutes: z.number(),
  priceCents: z.number(),
});

const professionalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  specialty: z.string().nullable(),
  color: z.string(),
});

export const publicPageSchema = z.object({
  company: companySchema,
  services: z.array(serviceSchema),
  professionals: z.array(professionalSchema),
});

export const availabilitySchema = z.object({
  date: z.string().nullable(),
  slots: z.array(
    z.object({
      startsAt: z.string(),
      endsAt: z.string(),
      professionals: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
    }),
  ),
});

export const bookingResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  code: z.string().optional(),
  service: z.string().optional(),
  professional: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  company: z.string().optional(),
  whatsapp: z.string().nullable().optional(),
  status: z.string().optional(),
});

export type PublicPage = z.infer<typeof publicPageSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type BookingResult = z.infer<typeof bookingResultSchema>;

export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
