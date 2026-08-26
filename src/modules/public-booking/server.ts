import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createSupabaseServerClient } from "@/modules/supabase/server-client";
import { createMercadoPagoCheckout } from "@/modules/payments/mercado-pago.server";
import {
  availabilitySchema,
  bookingResultSchema,
  publicPageSchema,
  storeOrderResultSchema,
  type Availability,
  type BookingResult,
  type PublicPage,
  type StoreOrderResult,
} from "./domain";

const slugSchema = z.object({ slug: z.string().trim().toLowerCase().min(3).max(80) });

/**
 * As funções v3/v4 de agenda multiprofissional vivem no banco de produção e
 * ainda não estão no arquivo de tipos gerado, então a chamada é feita por aqui.
 */
type RpcCall = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export const getPublicCompanyPage = createServerFn({ method: "GET" })
  .validator(slugSchema)
  .handler(async ({ data }): Promise<PublicPage | null> => {
    const supabase = createSupabaseServerClient();
    const { data: page, error } = await supabase.rpc("get_public_company_page_v3", {
      p_slug: data.slug,
    });
    if (error) throw new Error("Não foi possível carregar esta página agora.");
    if (!page) return null;
    return publicPageSchema.parse(page);
  });

const availabilityInput = slugSchema.extend({
  date: z.string().date(),
  serviceIds: z.array(z.string().uuid()).min(1).max(8),
  professionalId: z.string().uuid().nullable(),
});

export const getPublicAvailability = createServerFn({ method: "GET" })
  .validator(availabilityInput)
  .handler(async ({ data }): Promise<Availability> => {
    const supabase = createSupabaseServerClient();
    const args = {
      p_slug: data.slug,
      p_date: data.date,
      p_service_ids: data.serviceIds,
      p_professional_id: data.professionalId,
    };
    const rpc: RpcCall = async (name, params) =>
      await (supabase as unknown as { rpc: RpcCall }).rpc(name, params);
    let { data: availability, error } = await rpc("get_public_booking_availability_v3", args);

    if (error) {
      // Fallback de continuidade: se a função por blocos ainda não estiver
      // disponível no banco, a agenda pública continua funcionando na v2.
      const legacy = await rpc("get_public_booking_availability_v2", args);
      if (legacy.error) throw new Error("Não foi possível consultar os horários.");
      availability = legacy.data;
    }

    try {
      availabilitySchema.parse(availability ?? { date: data.date, slots: [] });
    } catch (cause) {
      console.error("[debug availability]", JSON.stringify(availability)?.slice(0, 500), cause);
      throw cause;
    }
    const parsed = availabilitySchema.parse(availability ?? { date: data.date, slots: [] });


    const { filterSlotsByProfessionalAgenda } = await import("./disponibilidade.server");
    return { ...parsed, slots: await filterSlotsByProfessionalAgenda(data.slug, parsed.slots) };
  });

const bookingInput = availabilityInput.omit({ date: true, professionalId: true }).extend({
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(30),
  customerEmail: z.string().trim().email().max(254).or(z.literal("")),
  customerBirthDate: z.string().date().or(z.literal("")),
  notes: z.string().trim().max(500),
  requestId: z.string().uuid(),
  fingerprint: z.string().min(8).max(100),
  website: z.string().max(0),
});

const simpleBookingInput = availabilityInput.omit({ date: true, professionalId: true }).extend({
  professionalId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(30),
  requestId: z.string().uuid(),
  fingerprint: z.string().min(8).max(100),
  paymentMethod: z.enum(["pix", "card", "local", "mercado_pago"]),
  paymentOption: z.enum(["deposit", "full"]),
  website: z.string().max(0),
});

export const createSimplePublicBooking = createServerFn({ method: "POST" })
  .validator(simpleBookingInput)
  .handler(async ({ data }): Promise<BookingResult> => {
    const supabase = createSupabaseServerClient();
    const { publicBookingBlockReason } = await import("./disponibilidade.server");
    const blocked = await publicBookingBlockReason({
      slug: data.slug,
      professionalId: data.professionalId,
      serviceIds: data.serviceIds,
      startsAt: data.startsAt,
    });
    if (blocked) return { ok: false, error: blocked };
    const { data: result, error } = await (supabase.rpc as unknown as RpcCall)("create_public_booking_v4", {
      p_slug: data.slug,
      p_service_ids: data.serviceIds,
      p_professional_id: data.professionalId,
      p_starts_at: data.startsAt,
      p_customer_name: data.customerName,
      p_customer_phone: data.customerPhone,
      p_request_id: data.requestId,
      p_fingerprint: data.fingerprint,
      p_payment_method: data.paymentMethod,
      p_payment_option: data.paymentOption,
      p_honeypot: data.website,
    });
    if (error) throw new Error("Não foi possível concluir o agendamento. Tente novamente.");
    const booking = bookingResultSchema.parse(result);
    if (booking.ok && data.paymentMethod === "mercado_pago" && booking.appointmentId) {
      try {
        const checkout = await createMercadoPagoCheckout({
          slug: data.slug,
          entityType: "appointment",
          entityId: booking.appointmentId,
          amountCents: booking.amountDueCents ?? booking.totalPriceCents ?? 0,
          title: `Agendamento ${booking.code ?? "online"}`,
          requestId: data.requestId,
        });
        return { ...booking, ...checkout };
      } catch (cause) {
        return {
          ...booking,
          paymentError:
            cause instanceof Error ? cause.message : "Não foi possível abrir o pagamento.",
        };
      }
    }
    return booking;
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .validator(bookingInput)
  .handler(async ({ data }): Promise<BookingResult> => {
    const supabase = createSupabaseServerClient();
    const { publicBookingBlockReason } = await import("./disponibilidade.server");
    const blocked = await publicBookingBlockReason({
      slug: data.slug,
      professionalId: data.professionalId,
      serviceIds: data.serviceIds,
      startsAt: data.startsAt,
    });
    if (blocked) return { ok: false, error: blocked };
    const { data: result, error } = await supabase.rpc("create_public_booking_v2", {
      p_slug: data.slug,
      p_service_ids: data.serviceIds,
      p_professional_id: data.professionalId,
      p_starts_at: data.startsAt,
      p_customer_name: data.customerName,
      p_customer_phone: data.customerPhone,
      p_customer_email: data.customerEmail,
      p_customer_birth_date: data.customerBirthDate || null,
      p_notes: data.notes,
      p_request_id: data.requestId,
      p_fingerprint: data.fingerprint,
      p_honeypot: data.website,
    });
    if (error) throw new Error("Não foi possível enviar o agendamento.");
    return bookingResultSchema.parse(result);
  });

const storeOrderInput = slugSchema.extend({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(10).max(30),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(30),
  paymentMethod: z.enum(["pix", "card", "local", "mercado_pago"]),
  requestId: z.string().uuid(),
  fingerprint: z.string().min(8).max(100),
  website: z.string().max(0),
});

export const createPublicStoreOrder = createServerFn({ method: "POST" })
  .validator(storeOrderInput)
  .handler(async ({ data }): Promise<StoreOrderResult> => {
    const supabase = createSupabaseServerClient();
    const { data: result, error } = await supabase.rpc("create_public_store_order", {
      p_slug: data.slug,
      p_customer_name: data.customerName,
      p_customer_phone: data.customerPhone,
      p_items: data.items,
      p_payment_method: data.paymentMethod,
      p_request_id: data.requestId,
      p_fingerprint: data.fingerprint,
      p_honeypot: data.website,
    });
    if (error) throw new Error("Não foi possível concluir o pedido. Tente novamente.");
    const order = storeOrderResultSchema.parse(result);
    if (order.ok && data.paymentMethod === "mercado_pago" && order.orderId) {
      try {
        const checkout = await createMercadoPagoCheckout({
          slug: data.slug,
          entityType: "store_order",
          entityId: order.orderId,
          amountCents: order.totalCents ?? 0,
          title: `Pedido ${order.code ?? "da loja"}`,
          requestId: data.requestId,
        });
        return { ...order, ...checkout };
      } catch (cause) {
        return {
          ...order,
          paymentError:
            cause instanceof Error ? cause.message : "Não foi possível abrir o pagamento.",
        };
      }
    }
    return order;
  });
