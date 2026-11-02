const TIME_ZONE = "Europe/Stockholm";
const BOOKING_WINDOW_DAYS = 30;

export const SLOT_TIMES = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
];

function stockholmNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const part = (type: string) => parts.find((p) => p.type === type)?.value;

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);

  return result.toISOString().slice(0, 10);
}

export function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  // Rejects dates like 2026-02-31, which Date would roll over to March.
  const parsed = new Date(`${date}T00:00:00Z`);

  return !isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

export function isWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();

  return day >= 1 && day <= 5;
}

export function isInBookingWindow(date: string, now: Date) {
  const today = stockholmNow(now).date;

  return date >= today && date <= addDays(today, BOOKING_WINDOW_DAYS);
}

export function isSlotTime(time: string) {
  return SLOT_TIMES.includes(time);
}

export function isSlotInPast(date: string, time: string, now: Date) {
  const current = stockholmNow(now);

  return date < current.date || (date === current.date && time <= current.time);
}
