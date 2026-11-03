import { draftBusinessDate } from "./request-form-model";
export const UMA_APPROVER_TITLES: Record<string, string> = {
  "taufik talentino": "Kepala Bidang Inspeksi dan Pengujian",
  "fikri haykal": "Kepala Unit Pelayanan Lombok",
  "putu angga bujana": "Kepala Unit Pelayanan Benete",
};
export function umaApproverTitle(name: unknown) {
  return (
    UMA_APPROVER_TITLES[
      String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("id")
    ] || ""
  );
}
const roman = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];
export function umaRequestNumber(
  sequence: string,
  portfolio: string,
  date: string,
) {
  const prefix = sequence.split("/")[0].trim();
  if (!/^\d{1,4}$/.test(prefix) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(date + "T00:00:00Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return "";
  return `${prefix.padStart(4, "0")}/DPS-${roman[Number(date.slice(5, 7)) - 1]}/OPS-${portfolio}/${date.slice(0, 4)}`;
}
export const umaUnit = (portfolio: string) => `Cab Denpasar / ${portfolio}`;
export function umaSignatureDate(
  createdAt: unknown,
  place: unknown = "Denpasar",
) {
  const date = draftBusinessDate(createdAt);
  if (!date) return null;
  return `${String(place || "Denpasar").trim()}, ${new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Makassar" }).format(new Date(date + "T04:00:00Z"))}`;
}
export function umaFilename(request: Record<string, unknown>) {
  const e = (request.equipment_snapshot || {}) as Record<string, unknown>;
  const code = String(
    request.portfolio_code_snapshot || e.portfolio_code || "DPS",
  ).replace(/[^A-Za-z0-9 -]/g, "-");
  const date = draftBusinessDate(request.created_at);
  return `Pengajuan ${request.request_kind === "repair" ? "Perbaikan" : "Kalibrasi"} Alat ${code} ${date?.slice(0, 4) || ""}`.trim();
}
