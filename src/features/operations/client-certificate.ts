import { addMonths, validDate } from "@/lib/domain/validity";
export function clientExpiry(start: string, months: unknown, days: unknown) {
  if (!validDate(start)) return null;
  const m = Number(months || 0), d = Number(days || 0);
  if (m && d) return null;
  if (Number.isInteger(d) && d > 0 && d <= 36500) {
    const end = new Date(start + "T00:00:00Z");
    end.setUTCDate(end.getUTCDate() + d);
    return end.toISOString().slice(0, 10);
  }
  return Number.isInteger(m) && m > 0 && m <= 600 ? addMonths(start, m) : null;
}
