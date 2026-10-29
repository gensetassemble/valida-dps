import { formatBusinessDate } from "@/lib/format";
import { deadlineTone, remainingDays } from "@/lib/domain/validity";

export function DeadlineDate({ value }: { value: unknown }) {
  const date = typeof value === "string" ? value : "";
  const days = remainingDays(date);
  const tone = deadlineTone(date);
  return (
    <span
      className={
        tone === "expired"
          ? "inline-flex rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-700"
          : tone === "soon"
            ? "inline-flex rounded bg-yellow-50 px-1.5 py-0.5 font-semibold text-yellow-900"
            : ""
      }
      title={
        days === null
          ? undefined
          : days < 0
            ? `Expired · ${Math.abs(days)} hari lewat`
            : `${days} hari lagi`
      }
    >
      {formatBusinessDate(date || null)}
      {tone === "expired" && <span className="sr-only"> · Expired</span>}
      {tone === "soon" && <span className="sr-only"> · Mendekati expired</span>}
    </span>
  );
}
