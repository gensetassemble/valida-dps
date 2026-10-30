import { z } from "zod";
import { todayWita } from "@/lib/domain/validity";

export const EMPLOYEE_STATUS_REASONS = {
  resigned: "Resign",
  transferred: "Pindah cabang / unit",
  other: "Lainnya",
  reactivated: "Aktif kembali / konfirmasi aktif",
} as const;
export const employeeStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
  reason: z.enum(["resigned", "transferred", "other", "reactivated"]),
  effective_on: z.iso.date().refine((d) => d <= todayWita(), "Tanggal efektif tidak boleh melewati hari ini (WITA)."),
  notes: z.string().trim().min(8).max(2000),
}).strict().superRefine((v, c) => {
  if ((v.status === "active") !== (v.reason === "reactivated"))
    c.addIssue({ code: "custom", path: ["reason"], message: "Pilih alasan sesuai status personil." });
});
