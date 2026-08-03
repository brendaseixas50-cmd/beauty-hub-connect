import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import {
  availabilitySchema,
  bookingResultSchema,
  publicPageSchema,
  type Availability,
  type BookingResult,
  type PublicPage,
} from "./domain";

const slugSchema = z.object({ slug: z.string().trim().toLowerCase().min(3).max(80) });

export const getPublicCompanyPage = createServerFn({ method: "GET" })
  .validator(slugSchema)
  .handler(async ({ data }): Promise<PublicPage | null> => {
    const supabase = createSupabaseServerClient();
    const { data: page, error } = await supabase.rpc("get_public_company_page", {
      p_slug: data.slug,
    });
    if (error) throw new Error("Não foi possível carregar esta página agora.");
    if (!page) return null;
    return publicPageSchema.parse(page);
  });

const availabilityInput = slugSchema.extend({
  date: z.string().date(),
  serviceId: z.string().uuid(),
  professionalId: z.string().uuid().nullable(),
});

export const getPublicAvailability = createServerFn({ method: "GET" })
  .validator(availabilityInput)
  .handler(async ({ data }): Promise<Availability> => {
    const supabase = createSupabaseServerClient();
    const args = data.professionalId
      ? {
          p_slug: data.slug,
          p_date: data.date,
          p_service_id: data.serviceId,
          p_professional_id: data.professionalId,
        }
      : { p_slug: data.slug, p_date: data.date, p_service_id: data.serviceId };
    const { data: availability, error } = await supabase.rpc(
      "get_public_booking_availability",
      args,
    );
    if (error) throw new Error("Não foi possível consultar os horários.");
    return availabilitySchema.parse(availability ?? { date: data.date, slots: [] });
  });

const bookingInput = availabilityInput.omit({ date: true, professionalId: true }).extend({
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(30),
  customerEmail: z.string().trim().email().max(254).or(z.literal("")),
  notes: z.string().trim().max(500),
  requestId: z.string().uuid(),
  fingerprint: z.string().min(8).max(100),
  website: z.string().max(0),
});

export const createPublicBooking = createServerFn({ method: "POST" })
  .validator(bookingInput)
  .handler(async ({ data }): Promise<BookingResult> => {
    const supabase = createSupabaseServerClient();
    const { data: result, error } = await supabase.rpc("create_public_booking", {
      p_slug: data.slug,
      p_service_id: data.serviceId,
      p_professional_id: data.professionalId,
      p_starts_at: data.startsAt,
      p_customer_name: data.customerName,
      p_customer_phone: data.customerPhone,
      p_customer_email: data.customerEmail,
      p_notes: data.notes,
      p_request_id: data.requestId,
      p_fingerprint: data.fingerprint,
      p_honeypot: data.website,
    });
    if (error) throw new Error("Não foi possível enviar o agendamento.");
    return bookingResultSchema.parse(result);
  });
