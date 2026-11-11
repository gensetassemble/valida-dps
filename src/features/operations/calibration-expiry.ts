import { addMonths, validDate } from "@/lib/domain/validity";

export function calibrationExpiryReview(row: Record<string, unknown>) {
  const start = String(row.issue_date || row.calibration_date || "");
  const months = Number(row.interval_months);
  const calculated = validDate(start) && Number.isInteger(months) && months > 0 && months <= 600
    ? addMonths(start, months) : null;
  const due = String(row.due_date || "");
  const differs = !!calculated && validDate(due) && due !== calculated;
  const reviewed = String(row.resolution_note || "").trim().length >= 8 && row.reported_due_date === due;
  return { calculated, differs, needsReview: differs && !reviewed };
}
