import { driveFolder, validDate } from "@/lib/domain/validity";
export const DOMAINS = [
  "employees",
  "personnel",
  "calibrations",
  "clients",
] as const;
export type ImportDomain = (typeof DOMAINS)[number];
export const DOMAIN_LABELS: Record<ImportDomain, string> = {
  employees: "Master Pegawai",
  personnel: "Kompetensi Personil",
  calibrations: "Kalibrasi Alat",
  clients: "Sertifikat Klien",
};
export const FIELDS: Record<ImportDomain, Record<string, string>> = {
  employees: {
    npp: "NPP (teks lima karakter)",
    full_name: "Nama pegawai",
    employment_category: "Kategori kepegawaian",
    organization_unit: "Unit organisasi",
  },
  personnel: {
    employee_id: "Pegawai terpetakan",
    certificate_type_id: "Jenis kompetensi terpetakan",
    original_title: "Judul lisensi asli",
    original_holder_name: "Nama pada sumber",
    npp: "NPP hasil pemetaan sumber",
    issuer: "Penerbit",
    certificate_number: "Nomor sertifikat",
    issue_date: "Tanggal terbit ISO",
    expiry_date: "Tanggal akhir ISO",
    interval_months: "Interval bulan",
    validity_kind: "Jenis masa berlaku",
    source_folder_url: "Folder Google Drive",
    notes: "Catatan",
  },
  calibrations: {
    equipment_id: "Aset terverifikasi",
    equipment_name: "Nama alat sumber",
    asset_tag: "Tag sumber",
    serial: "Serial sumber",
    portfolio_code: "Portofolio sumber",
    laboratory: "Laboratorium",
    certificate_number: "Nomor sertifikat",
    calibration_date: "Tanggal kalibrasi ISO",
    issue_date: "Tanggal terbit ISO",
    due_date: "Tanggal akhir ISO",
    interval_months: "Interval bulan",
    notes: "Catatan",
  },
  clients: {
    client_id: "Pelanggan terpetakan",
    certificate_type_id: "Jenis sertifikat klien terpetakan",
    certificate_number: "Nomor sertifikat",
    object_type: "Objek inspeksi",
    object_serial: "Nomor seri",
    installation_location: "Lokasi",
    order_reference: "Nomor SPK",
    contract_reference: "Nomor kontrak",
    issue_date: "Tanggal terbit ISO",
    expiry_date: "Tanggal akhir ISO",
    interval_months: "Interval bulan",
    previous_order_value: "Nilai kontrak IDR",
  },
};
export const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .trim();
export function normalize(
  domain: ImportDomain,
  raw: Record<string, string>,
  mapping: Record<string, string> = {},
) {
  const get = (...names: string[]) => {
    for (const n of names) {
      const v = raw[mapping[n] || n];
      if (v !== undefined && clean(v) !== "") return clean(v);
    }
    return "";
  };
  let n: Record<string, string> = {};
  if (domain === "employees")
    n = {
      npp: get("npp", "NPP", "NRK"),
      full_name: get("full_name", "NamaPegawai", "NAMA"),
      employment_category:
        get("employment_category", "KategoriKepegawaian") ||
        { PT: "PT", PTT: "PTT_REGULAR" }[get("EMPCAT")] ||
        "",
      organization_unit: get(
        "organization_unit",
        "UnitOrganisasi",
        "UNIT ORGANISASI",
      ),
    };
  if (domain === "personnel")
    n = {
      employee_id: get("employee_id"),
      certificate_type_id: get("certificate_type_id"),
      original_title: get("original_title", "JudulLisensiAsli"),
      original_holder_name: get("original_holder_name", "NamaPegawai"),
      npp: get("npp", "NRK_Master", "NPP_Normalized", "NPPAsli"),
      issuer: get("issuer", "PenerbitAsli"),
      certificate_number: get("certificate_number", "NomorSertifikat"),
      issue_date: get("issue_date", "TanggalTerbitISO"),
      expiry_date: get("expiry_date", "TanggalBerakhirISO"),
      interval_months: get("interval_months", "IntervalBulan"),
      validity_kind:
        get("validity_kind") ||
        (get("JenisMasaBerlaku") === "LIFETIME" &&
        get("IsLifetime").toLowerCase() === "true"
          ? "lifetime"
          : "term"),
      source_folder_url: get("source_folder_url", "LinkFolderDrive"),
      notes: [
        get("CatatanValidasi"),
        get("DasarKlasifikasi"),
        get("NPPSebelumKoreksi") &&
          "Nomor sebelum koreksi tersimpan pada sumber",
      ]
        .filter(Boolean)
        .join("; "),
    };
  if (domain === "calibrations")
    n = {
      equipment_id: get("equipment_id"),
      equipment_name: get("equipment_name", "NamaAlat"),
      asset_tag: get("asset_tag", "TagNumber"),
      serial: get("serial", "SerialNumber"),
      portfolio_code: get("portfolio_code", "Portfolio"),
      laboratory: get("laboratory", "LembagaKalibrasi"),
      certificate_number: get("certificate_number", "NomorSertifikatAsli"),
      calibration_date: get("calibration_date", "TanggalKalibrasiISO"),
      issue_date: get("issue_date"),
      due_date: get("due_date", "TanggalBerakhirISO"),
      interval_months: get("interval_months", "IntervalBulan"),
      notes: get("notes", "CatatanValidasi", "KeteranganAsli"),
    };
  if (domain === "clients")
    n = Object.fromEntries(
      Object.keys(FIELDS.clients).map((k) => [
        k,
        get(
          k,
          (
            {
              certificate_number: "Nomor Sertifikat",
              object_type: "Objek Inspeksi",
              object_serial: "Nomor Seri (opsional)",
              installation_location: "Lokasi",
              order_reference: "Nomor SPK",
              issue_date: "Tanggal Terbit",
              expiry_date: "Tanggal Berakhir",
              interval_months: "Interval (bulan)",
              previous_order_value: "Nilai Kontrak (IDR)",
            } as Record<string, string>
          )[k] || k,
        ),
      ]),
    );
  const issues = validateNormalized(domain, n);
  if (
    get("BranchCode", "Cabang Operasional") &&
    get("BranchCode", "Cabang Operasional") !== "DPS"
  )
    issues.push(
      "BranchCode: sumber berbeda dari DPS; tidak dipindahkan otomatis.",
    );
  if (get("StatusReview") === "PERLU_VERIFIKASI")
    issues.push(
      "Sumber menandai PERLU_VERIFIKASI; persetujuan impor tidak memverifikasi dokumen.",
    );
  return {
    normalized: n,
    issues,
    status: issues.length ? "needs_review" : "ready",
  };
}
export function validateNormalized(
  domain: ImportDomain,
  n: Record<string, string>,
) {
  const errors: string[] = [];
  const req = (k: string) => {
    if (!clean(n[k])) errors.push(k + ": wajib diisi/dipetakan.");
  };
  const uuid = (k: string) => {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        n[k] || "",
      )
    )
      errors.push(k + ": pilih rekaman yang sah.");
  };
  for (const k of ["issue_date", "expiry_date", "calibration_date", "due_date"])
    if (n[k] && !validDate(n[k])) errors.push(k + ": tanggal ISO tidak valid.");
  if (
    (n.interval_months && !/^[1-9]\d{0,2}$/.test(n.interval_months)) ||
    Number(n.interval_months) > 600
  )
    errors.push("interval_months: gunakan 1–600.");
  if (domain === "employees") {
    req("full_name");
    if (!/^\d{5}$/.test(n.npp || ""))
      errors.push("npp: NPP harus tepat lima digit teks.");
    if (
      !["PT", "PTT_REGULAR", "PTT_PROJECT", "LS"].includes(
        n.employment_category,
      )
    )
      errors.push("employment_category: kategori belum dipetakan.");
  }
  if (domain === "personnel") {
    uuid("employee_id");
    uuid("certificate_type_id");
    req("original_title");
    if (!["term", "lifetime"].includes(n.validity_kind))
      errors.push("validity_kind: klasifikasi wajib dipilih.");
    if (n.validity_kind === "lifetime" && (n.expiry_date || n.interval_months))
      errors.push("Lifetime tidak boleh memiliki tanggal akhir/interval.");
    if (n.validity_kind === "term") req("expiry_date");
    if (n.source_folder_url && !driveFolder(n.source_folder_url))
      errors.push("source_folder_url: harus URL folder Google Drive HTTPS.");
  }
  if (domain === "calibrations") {
    uuid("equipment_id");
    req("calibration_date");
    req("due_date");
  }
  if (domain === "clients") {
    uuid("client_id");
    uuid("certificate_type_id");
    req("certificate_number");
    req("object_type");
    req("issue_date");
    req("expiry_date");
    if (
      n.previous_order_value &&
      !/^\d{1,18}(\.\d{1,2})?$/.test(n.previous_order_value)
    )
      errors.push("previous_order_value: angka desimal rupiah tidak valid.");
  }
  if (n.issue_date && n.expiry_date && n.expiry_date < n.issue_date)
    errors.push("expiry_date: mendahului tanggal terbit.");
  if (n.calibration_date && n.due_date && n.due_date < n.calibration_date)
    errors.push("due_date: mendahului kalibrasi.");
  for (const [k, v] of Object.entries(n))
    if (v.length > 4000) errors.push(k + ": nilai terlalu panjang.");
  return errors;
}
