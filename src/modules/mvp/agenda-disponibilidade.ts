export type DaySchedule = {
  dayOff: boolean;
  startsAt: string;
  endsAt: string;
  breakStartsAt: string | null;
  breakEndsAt: string | null;
};

/** Working days keyed by weekday number (0 = Sunday). An empty map follows the company hours. */
export type WorkingHours = Record<string, DaySchedule>;

export const weekdayLabels = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function emptyDaySchedule(): DaySchedule {
  return {
    dayOff: true,
    startsAt: "09:00",
    endsAt: "18:00",
    breakStartsAt: null,
    breakEndsAt: null,
  };
}

function normalizeTime(value: unknown, fallback: string): string {
  return typeof value === "string" && timePattern.test(value) ? value : fallback;
}

function normalizeOptionalTime(value: unknown): string | null {
  return typeof value === "string" && timePattern.test(value) ? value : null;
}

export function parseWorkingHours(value: unknown): WorkingHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const parsed: WorkingHours = {};
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const raw = source[String(weekday)];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const day = raw as Record<string, unknown>;
    const startsAt = normalizeTime(day["startsAt"], "09:00");
    const endsAt = normalizeTime(day["endsAt"], "18:00");
    const breakStartsAt = normalizeOptionalTime(day["breakStartsAt"]);
    const breakEndsAt = normalizeOptionalTime(day["breakEndsAt"]);
    const validBreak = breakStartsAt && breakEndsAt && breakEndsAt > breakStartsAt;
    parsed[String(weekday)] = {
      dayOff: day["dayOff"] === true || endsAt <= startsAt,
      startsAt,
      endsAt,
      breakStartsAt: validBreak ? breakStartsAt : null,
      breakEndsAt: validBreak ? breakEndsAt : null,
    };
  }
  return parsed;
}

export function hasCustomWorkingHours(hours: WorkingHours): boolean {
  return Object.keys(hours).length > 0;
}

export type LocalMoment = { weekday: number; minutes: number; dayKey: string };

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsCache.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  partsCache.set(timeZone, created);
  return created;
}

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function localMoment(isoDate: string, timeZone: string): LocalMoment {
  const parts = formatter(timeZone).formatToParts(new Date(isoDate));
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = Number(lookup("hour")) % 24;
  const minute = Number(lookup("minute"));
  return {
    weekday: weekdayIndex[lookup("weekday")] ?? 0,
    minutes: hour * 60 + minute,
    dayKey: `${lookup("year")}-${lookup("month")}-${lookup("day")}`,
  };
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":");
  return Number(hour) * 60 + Number(minute);
}

export type UnavailabilityWindow = { starts_at: string; ends_at: string };

export type AvailabilityCheck = {
  workingHours: WorkingHours;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  unavailability?: UnavailabilityWindow[];
};

/** Returns null when the professional can take the slot, or the reason why not. */
export function professionalSlotBlockReason({
  workingHours,
  timeZone,
  startsAt,
  endsAt,
  unavailability = [],
}: AvailabilityCheck): string | null {
  const start = localMoment(startsAt, timeZone);
  const end = localMoment(endsAt, timeZone);

  if (hasCustomWorkingHours(workingHours)) {
    const day = workingHours[String(start.weekday)];
    if (!day || day.dayOff) return "Este profissional não atende nesse dia.";
    const endMinutes = end.dayKey === start.dayKey ? end.minutes : 24 * 60 + end.minutes;
    if (start.minutes < toMinutes(day.startsAt) || endMinutes > toMinutes(day.endsAt)) {
      return "Este horário está fora da agenda do profissional.";
    }
    if (day.breakStartsAt && day.breakEndsAt) {
      const breakStart = toMinutes(day.breakStartsAt);
      const breakEnd = toMinutes(day.breakEndsAt);
      if (start.minutes < breakEnd && endMinutes > breakStart) {
        return "Este horário está no intervalo do profissional.";
      }
    }
  }

  const slotStart = new Date(startsAt).getTime();
  const slotEnd = new Date(endsAt).getTime();
  const blocked = unavailability.some(
    (window) =>
      new Date(window.starts_at).getTime() < slotEnd &&
      new Date(window.ends_at).getTime() > slotStart,
  );
  return blocked ? "Este profissional está indisponível nesse período." : null;
}
