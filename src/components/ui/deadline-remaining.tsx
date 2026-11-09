import { remainingDays } from "@/lib/domain/validity";

export function DeadlineRemaining({value, lifetime = false}: {value: unknown; lifetime?: boolean}) {
  const days = !lifetime && typeof value === "string" ? remainingDays(value) : null;
  if (days === null) return null;
  return <span className={`block text-[10px] ${days < 0 ? "font-medium text-red-700" : days <= 90 ? "font-medium text-amber-800" : "text-muted-foreground"}`}>
    {days < 0 ? `${Math.abs(days)} hari lewat` : days === 0 ? "Hari ini" : `${days} hari lagi`}
  </span>;
}
