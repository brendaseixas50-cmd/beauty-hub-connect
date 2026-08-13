import {
  parseWorkingHours,
  professionalSlotBlockReason,
  type WorkingHours,
} from "@/modules/mvp/agenda-disponibilidade";
import { createSupabaseAdminClient } from "@/modules/supabase/admin-client";

type Slot = { startsAt: string; endsAt: string; professionals: { id: string; name: string }[] };

type TenantAgenda = {
  tenantId: string;
  timeZone: string;
  workingHours: Map<string, WorkingHours>;
  unavailability: Map<string, { starts_at: string; ends_at: string }[]>;
};

async function loadTenantAgenda(slug: string, from: string, to: string): Promise<TenantAgenda | null> {
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, timezone")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (!tenant) return null;
  const [professionals, blocks] = await Promise.all([
    supabase.from("professionals").select("id, working_hours").eq("tenant_id", tenant.id),
    supabase
      .from("professional_unavailability")
      .select("professional_id, starts_at, ends_at")
      .eq("tenant_id", tenant.id)
      .lt("starts_at", to)
      .gt("ends_at", from),
  ]);
  const workingHours = new Map<string, WorkingHours>();
  for (const professional of professionals.data ?? []) {
    workingHours.set(professional.id, parseWorkingHours(professional.working_hours));
  }
  const unavailability = new Map<string, { starts_at: string; ends_at: string }[]>();
  for (const block of blocks.data ?? []) {
    const current = unavailability.get(block.professional_id) ?? [];
    current.push({ starts_at: block.starts_at, ends_at: block.ends_at });
    unavailability.set(block.professional_id, current);
  }
  return { tenantId: tenant.id, timeZone: tenant.timezone, workingHours, unavailability };
}

/** Keeps only the slots each professional can actually take, individually. */
export async function filterSlotsByProfessionalAgenda(slug: string, slots: Slot[]): Promise<Slot[]> {
  if (slots.length === 0) return slots;
  const from = slots[0]!.startsAt;
  const to = slots[slots.length - 1]!.endsAt;
  const agenda = await loadTenantAgenda(slug, from, to);
  if (!agenda) return slots;
  return slots
    .map((slot) => ({
      ...slot,
      professionals: slot.professionals.filter(
        (professional) =>
          professionalSlotBlockReason({
            workingHours: agenda.workingHours.get(professional.id) ?? {},
            timeZone: agenda.timeZone,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            unavailability: agenda.unavailability.get(professional.id) ?? [],
          }) === null,
      ),
    }))
    .filter((slot) => slot.professionals.length > 0);
}

/** Blocks a public booking when the chosen professional is off, on a break or blocked. */
export async function publicBookingBlockReason({
  slug,
  professionalId,
  serviceIds,
  startsAt,
}: {
  slug: string;
  professionalId: string;
  serviceIds: string[];
  startsAt: string;
}): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, timezone")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (!tenant) return null;
  const { data: services } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("tenant_id", tenant.id)
    .in("id", serviceIds);
  const totalMinutes = (services ?? []).reduce(
    (total, service) => total + service.duration_minutes,
    0,
  );
  if (!totalMinutes) return null;
  const endsAt = new Date(new Date(startsAt).getTime() + totalMinutes * 60_000).toISOString();
  const [professional, blocks] = await Promise.all([
    supabase
      .from("professionals")
      .select("working_hours")
      .eq("tenant_id", tenant.id)
      .eq("id", professionalId)
      .maybeSingle(),
    supabase
      .from("professional_unavailability")
      .select("starts_at, ends_at")
      .eq("tenant_id", tenant.id)
      .eq("professional_id", professionalId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt),
  ]);
  if (!professional.data) return "Profissional indisponível.";
  return professionalSlotBlockReason({
    workingHours: parseWorkingHours(professional.data.working_hours),
    timeZone: tenant.timezone,
    startsAt,
    endsAt,
    unavailability: blocks.data ?? [],
  });
}
