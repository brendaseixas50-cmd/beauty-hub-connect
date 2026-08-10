import { z } from "zod";

const companySchema = z.object({
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
  description: z.string().nullable(),
  productType: z.enum(["beauty", "barber"]),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  whatsappInitialMessage: z.string().nullable(),
  instagram: z.string().nullable(),
  facebook: z.string().nullable(),
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  mapUrl: z.string().nullable(),
  showPublicLocation: z.boolean().default(false),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  businessHours: z.record(z.string(), z.string()),
  timezone: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  accentColor: z.string(),
  buttonColor: z.string(),
  cardColor: z.string(),
  menuColor: z.string(),
  backgroundColor: z.string(),
  titleColor: z.string(),
  textColor: z.string(),
  welcomeMessage: z.string().nullable(),
  cancellationPolicy: z.string().nullable(),
  cancellationPolicyEnabled: z.boolean().default(false),
  depositEnabled: z.boolean().default(false),
  depositType: z.enum(["none", "percent_30", "percent_50", "fixed"]).default("none"),
  depositValueCents: z.number().int().nonnegative().default(0),
  paymentMethods: z
    .object({
      pix: z.boolean().default(false),
      card: z.boolean().default(false),
      local: z.boolean().default(true),
      mercadoPago: z.boolean().default(false),
    })
    .default({ pix: false, card: false, local: true, mercadoPago: false }),
  publicStoreEnabled: z.boolean().default(false),
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
  photoUrl: z.string().nullable(),
  bio: z.string().nullable(),
  serviceIds: z.array(z.string().uuid()),
});

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string().nullable().default(null),
  description: z.string().nullable(),
  priceCents: z.number(),
  stockQuantity: z.number().int().nonnegative().default(0),
  imageUrl: z.string().nullable(),
});

const gallerySchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string(),
  altText: z.string().nullable(),
});

const reviewSchema = z.object({
  id: z.string().uuid(),
  clientName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
});

export const publicPageSchema = z.object({
  company: companySchema,
  services: z.array(serviceSchema),
  professionals: z.array(professionalSchema),
  products: z.array(productSchema),
  gallery: z.array(gallerySchema),
  reviews: z.array(reviewSchema),
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
  appointmentId: z.string().uuid().optional(),
  services: z.array(z.string()).optional(),
  service: z.string().optional(),
  professional: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  company: z.string().optional(),
  whatsapp: z.string().nullable().optional(),
  totalPriceCents: z.number().optional(),
  notificationStatus: z.enum(["development", "pending", "sent"]).optional(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  depositCents: z.number().optional(),
  amountDueCents: z.number().optional(),
  remainingCents: z.number().optional(),
  checkoutUrl: z.string().url().optional(),
  paymentError: z.string().optional(),
});

export const storeOrderResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  orderId: z.string().uuid().optional(),
  code: z.string().optional(),
  totalCents: z.number().int().nonnegative().optional(),
  paymentMethod: z.string().optional(),
  paymentStatus: z.string().optional(),
  checkoutUrl: z.string().url().optional(),
  paymentError: z.string().optional(),
});

export type PublicPage = z.infer<typeof publicPageSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type BookingResult = z.infer<typeof bookingResultSchema>;
export type StoreOrderResult = z.infer<typeof storeOrderResultSchema>;

export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
