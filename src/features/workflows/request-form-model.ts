import { todayWita } from "@/lib/domain/validity";

/** Use the saved draft timestamp, never the time of preview or download. */
export function draftBusinessDate(createdAt: unknown): string | null {
  if (typeof createdAt !== "string" || !createdAt.trim()) return null;
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? null : todayWita(date);
}

export function draftSignatureDate(createdAt: unknown) {
  const date = draftBusinessDate(createdAt);
  return date ? date.split("-").reverse().join(" / ") : null;
}
