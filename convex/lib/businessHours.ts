/**
 * Shop business hours. When a shop sets them, the AI auto-replies only
 * inside them; messages that arrive outside are stored for staff. Unset
 * means the AI replies at any hour.
 *
 * Shared by the reply pipeline and the Shops settings UI, so no server
 * imports.
 */

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Opening hours for one day, as 24h "HH:MM" local times; open < close. */
export type DayHours = { open: string; close: string };

export type BusinessHours = {
  /** IANA time zone, e.g. "America/Port_of_Spain". */
  timezone: string;
  /** A missing day is closed. */
  days: Partial<Record<Weekday, DayHours>>;
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(time: string): number | null {
  const match = TIME.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Why `hours` can't be saved, or null when it's valid. Used on write; the
 * pipeline never throws on stored values (see isWithinBusinessHours).
 */
export function businessHoursError(hours: BusinessHours): string | null {
  if (!isValidTimeZone(hours.timezone)) {
    return `Unknown time zone "${hours.timezone}"`;
  }
  for (const [day, value] of Object.entries(hours.days)) {
    if (!WEEKDAYS.includes(day as Weekday)) {
      return `Unknown day "${day}"`;
    }
    if (!value) continue;
    const open = minutesOf(value.open);
    const close = minutesOf(value.close);
    if (open === null || close === null) {
      return `${day}: use 24h HH:MM times`;
    }
    if (open >= close) {
      return `${day}: closing time must be after opening time`;
    }
  }
  return null;
}

/** The weekday and minutes since midnight at `now` in `timezone`. */
function localTime(
  now: number,
  timezone: string,
): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  const day = part("weekday")?.toLowerCase().slice(0, 3) as Weekday;
  return {
    day,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/**
 * Whether the AI may reply at `now`. Stored settings are `v.any()`, so
 * anything unset or unparseable counts as "no restriction": a bad value
 * must never silence the shop.
 */
export function isWithinBusinessHours(hours: unknown, now: number): boolean {
  if (!hours || typeof hours !== "object") return true;
  const candidate = hours as BusinessHours;
  if (
    typeof candidate.timezone !== "string" ||
    !candidate.days ||
    typeof candidate.days !== "object" ||
    businessHoursError(candidate) !== null
  ) {
    return true;
  }
  try {
    const { day, minutes } = localTime(now, candidate.timezone);
    const today = candidate.days[day];
    if (!today) return false;
    const open = minutesOf(today.open) ?? 0;
    const close = minutesOf(today.close) ?? 0;
    return minutes >= open && minutes < close;
  } catch {
    return true;
  }
}
