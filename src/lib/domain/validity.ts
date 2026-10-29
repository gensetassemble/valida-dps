export type Validity =
  | "Expired"
  | "Kritis"
  | "Perhatian"
  | "Pantau"
  | "Aman"
  | "Perlu Verifikasi"
  | "Tanggal Belum Diisi"
  | "Berlaku Seumur Hidup";
export function todayWita(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function remainingDays(date: string, today = todayWita()) {
  if (!validDate(date) || !validDate(today)) return null;
  return Math.round((Date.parse(date) - Date.parse(today)) / 86400000);
}
export function validity(
  date: string | null,
  verified: boolean,
  lifetime = false,
  today = todayWita(),
): Validity {
  if (!verified) return "Perlu Verifikasi";
  if (lifetime) return "Berlaku Seumur Hidup";
  const n = date ? remainingDays(date, today) : null;
  return n === null
    ? "Perlu Verifikasi"
    : n < 0
      ? "Expired"
      : n <= 30
        ? "Kritis"
        : n <= 60
          ? "Perhatian"
          : n <= 90
            ? "Pantau"
            : "Aman";
}
export function addMonths(date: string, months: number) {
  if (
    !validDate(date) ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 600
  )
    throw Error("Tanggal atau interval tidak valid.");
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
export function driveFolder(value: string | null | undefined) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      u.hostname === "drive.google.com" &&
      /^\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export type Calibration = {
  id: string;
  calibration_date: string | null;
  created_at: string;
  verification_status: string;
  result: string | null;
  due_date: string | null;
};
export function validityLabel(
  date: string | null,
  verified: boolean,
  lifetime = false,
  today = todayWita(),
) {
  // Review metadata is retained for compatibility, but is no longer a display stage.
  void verified;
  return operationalValidity(date, lifetime, today);
}
export function operationalValidity(
  date: string | null,
  lifetime = false,
  today = todayWita(),
): Validity {
  const value = validity(date, true, lifetime, today);
  return value === "Perlu Verifikasi" ? "Tanggal Belum Diisi" : value;
}
export function equipmentEligibility(
  events: Calibration[],
  today = todayWita(),
) {
  const sorted = [...events].sort(
    (a, b) =>
      (b.calibration_date || "").localeCompare(a.calibration_date || "") ||
      b.created_at.localeCompare(a.created_at) ||
      b.id.localeCompare(a.id),
  );
  const latest = sorted[0],
    known = sorted.find((e) => e.result !== null);
  if (
    known &&
    (known.result === "tidak_layak" ||
      (known.due_date && remainingDays(known.due_date, today)! < 0))
  )
    return "Tidak Layak Pakai";
  if (!latest) return "Belum Ada Kalibrasi";
  if (latest.due_date && remainingDays(latest.due_date, today)! < 0)
    return "Tidak Layak Pakai";
  if (!latest.due_date || remainingDays(latest.due_date, today) === null)
    return "Tanggal Belum Diisi";
  if (!latest.result) return "Hasil Belum Diisi";
  if (
    !latest ||
    latest.result !== "layak" ||
    !latest.due_date ||
    remainingDays(latest.due_date, today) === null
  )
    return "Hasil Belum Diisi";
  return "Layak Pakai";
}

export function deadlineTone(date: string, today = todayWita()) {
  const days = remainingDays(date, today);
  return days === null
    ? "unknown"
    : days < 0
      ? "expired"
      : days <= 90
        ? "soon"
        : "normal";
}
