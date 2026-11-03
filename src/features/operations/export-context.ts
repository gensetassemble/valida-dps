import { todayWita } from "@/lib/domain/validity";

export function branchLocation(name: string) {
  return name.replace(/^.*?\bCabang\s+/i, "").trim();
}
export function longExportDate(today = todayWita()) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(today + "T00:00:00Z"));
}
export function personnelFilename(branchName: string, today = todayWita()) {
  const month = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(today + "T00:00:00Z"));
  const location = branchLocation(branchName).replace(/[\\/:*?"<>|]/g, "-");
  return `Status Kompetensi Personil - Cabang ${location}_${month} ${today.slice(0, 4)}.xlsx`;
}
type Employee = {
  full_name: string;
  position: string | null;
  employment_status: string;
  archived_at: string | null;
  merged_into_employee_id: string | null;
};
export function monitoringOfficials(employees: Employee[]) {
  const active = employees.filter(
    (e) =>
      e.employment_status === "active" &&
      !e.archived_at &&
      !e.merged_into_employee_id &&
      !e.full_name.startsWith("[CONTOH]"),
  );
  function one(titles: string[], label: string) {
    const matches = active.filter((e) =>
      titles.includes(
        (e.position || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id"),
      ),
    );
    if (matches.length !== 1)
      throw Error(
        `Direktori harus memuat tepat satu ${label} aktif untuk ekspor.`,
      );
    return matches[0].full_name;
  }
  return {
    acknowledgedBy: one(
      ["kepala cabang", "kepala unit kerja"],
      "Kepala Cabang / Unit Kerja",
    ),
    preparedBy: one(
      ["kepala bidang inspeksi dan pengujian"],
      "Kepala Bidang Inspeksi dan Pengujian",
    ),
  };
}
