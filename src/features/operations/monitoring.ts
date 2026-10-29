import type { Field } from "@/features/master-data/registry";

// One contract for the website table and the monitoring workbook.
export const monitoringColumns = [
  ["name", "Nama Barang", ""],
  ["tag", "Tag-Number", ""],
  ["brand_type", "Merk/Type", "Spesifikasi"],
  ["serial", "Serial Number", "Spesifikasi"],
  ["color", "Warna", "Spesifikasi"],
  ["specification_size", "Ukuran", "Spesifikasi"],
  ["item_condition", "Kondisi Barang", ""],
  ["item_status", "Status Barang", ""],
  ["monitoring_certificate", "No. Sertifikat Kalibrasi/Perijinan", ""],
  ["monitoring_interval", "Interval Kalibrasi/Perijinan", ""],
  [
    "latest_calibration_date",
    "Tgl Kalibrasi/Perijinan",
    "Periode Kalibrasi/Perijinan",
  ],
  [
    "latest_due_date",
    "Tgl berakhirnya masa Kalibrasi/Perijinan",
    "Periode Kalibrasi/Perijinan",
  ],
  ["unit", "Sub Unit Kerja Pemilik", ""],
  ["monitoring_laboratory", "Lembaga Kalibrasi/Perijinan", ""],
  ["calibration_internal", "Internal", "Jenis Kalibrasi"],
  ["calibration_external", "Eksternal", "Jenis Kalibrasi"],
  ["measurement_range", "Range / Kapasitas", "Kalibrasi"],
  ["correction_factor", "Faktor Koreksi", "Kalibrasi"],
  ["significant_yes", "Ya", "Signifikan"],
  ["significant_no", "Tidak", "Signifikan"],
] as const;
export const monitoringHeaders = [
  [
    [1, "No.", 1, 3],
    [2, "Nama Barang", 1, 3],
    [3, "Tag-Number", 1, 3],
    [4, "Spesifikasi", 4, 1],
    [8, "Kondisi Barang", 1, 3],
    [9, "Status Barang", 1, 3],
    [10, "No. Sertifikat Kalibrasi/Perijinan", 1, 3],
    [11, "Interval Kalibrasi/Perijinan", 1, 3],
    [12, "Periode Kalibrasi/Perijinan", 2, 1],
    [14, "Sub Unit Kerja Pemilik", 1, 3],
    [15, "Lembaga Kalibrasi/Perijinan", 1, 3],
    [16, "Kalibrasi", 6, 1],
  ],
  [
    [4, "Merk/Type", 1, 2],
    [5, "Serial Number", 1, 2],
    [6, "Warna", 1, 2],
    [7, "Ukuran", 1, 2],
    [12, "Tgl Kalibrasi/Perijinan", 1, 2],
    [13, "Tgl berakhirnya masa Kalibrasi/Perijinan", 1, 2],
    [16, "Jenis Kalibrasi", 2, 1],
    [18, "Range / Kapasitas", 1, 2],
    [19, "Faktor Koreksi", 1, 2],
    [20, "Signifikan", 2, 1],
  ],
  [
    [16, "Internal", 1, 1],
    [17, "Eksternal", 1, 1],
    [20, "Ya", 1, 1],
    [21, "Tidak", 1, 1],
  ],
] as const;

export const monitoringAssetFields: Field[] = [
  {
    key: "color",
    label: "Warna",
    kind: "combobox",
    options: [
      "Hitam",
      "Putih",
      "Silver",
      "Bening",
      "Stainless",
      "Biru",
      "Merah",
      "Kuning",
      "Hijau",
      "Abu-abu",
    ].map((value) => ({ value, label: value })),
    max: 200,
  },
  {
    key: "specification_size",
    label: "Ukuran / spesifikasi",
    kind: "text",
    max: 200,
  },
  {
    key: "item_condition",
    label: "Kondisi barang",
    kind: "combobox",
    options: ["Baik", "Baru", "Rusak", "Pecah", "Tidak diketahui"].map(
      (value) => ({ value, label: value }),
    ),
    max: 200,
  },
  {
    key: "item_status",
    label: "Status barang",
    kind: "combobox",
    options: [
      "Terpakai",
      "Tidak Terpakai",
      "Dipinjam",
      "Dalam perbaikan",
      "Tidak diketahui",
    ].map((value) => ({ value, label: value })),
    max: 200,
  },
];
export const monitoringCalibrationFields: Field[] = [
  {
    key: "interval_label",
    label: "Interval pada laporan (mis. 1 tahun)",
    kind: "combobox",
    options: [
      "1 bulan",
      "3 bulan",
      "6 bulan",
      "12 bulan",
      "1 tahun",
      "24 bulan",
      "2 tahun",
      "36 bulan",
      "3 tahun",
    ].map((value) => ({ value, label: value })),
    max: 200,
  },
  {
    key: "calibration_internal",
    label: "Jenis kalibrasi — Internal",
    kind: "select",
    options: [
      { value: "", label: "Belum dicatat" },
      { value: "√", label: "Ya" },
      { value: "-", label: "Tidak" },
      { value: "N/A", label: "Tidak berlaku (N/A)" },
    ],
    max: 200,
    hint: "Pilihan disimpan sebagai tanda pada laporan monitoring.",
  },
  {
    key: "calibration_external",
    label: "Jenis kalibrasi — Eksternal",
    kind: "select",
    options: [
      { value: "", label: "Belum dicatat" },
      { value: "√", label: "Ya" },
      { value: "-", label: "Tidak" },
      { value: "N/A", label: "Tidak berlaku (N/A)" },
      { value: "'√", label: "Ya (tanda asli sumber)" },
    ],
    max: 200,
  },
  {
    key: "correction_factor",
    label: "Faktor koreksi",
    kind: "textarea",
    max: 10000,
  },
  {
    key: "significant_yes",
    label: "Signifikan — kolom Ya",
    kind: "select",
    options: [
      { value: "", label: "Belum dicatat" },
      { value: "√", label: "Ditandai" },
      { value: "-", label: "Tidak ditandai" },
      { value: "N/A", label: "Tidak berlaku (N/A)" },
    ],
    max: 200,
  },
  {
    key: "significant_no",
    label: "Signifikan — kolom Tidak",
    kind: "select",
    options: [
      { value: "", label: "Belum dicatat" },
      { value: "√", label: "Ditandai" },
      { value: "-", label: "Tidak ditandai" },
      { value: "N/A", label: "Tidak berlaku (N/A)" },
    ],
    max: 200,
  },
];
export const measurementKeys = [
  "measurement_range",
  "correction_factor",
  "calibration_internal",
  "calibration_external",
  "significant_yes",
  "significant_no",
] as const;
export const initialCalibrationFields: Field[] = [
  {
    key: "initial_enabled",
    label: "Catat kalibrasi awal",
    kind: "boolean",
    hint: "Tanggal di bawah disimpan sebagai peristiwa kalibrasi pertama. Matikan bila alat belum pernah dikalibrasi.",
  },
  {
    key: "initial_calibration_date",
    label: "Tanggal kalibrasi awal",
    kind: "date",
  },
  {
    key: "initial_due_date",
    label: "Tanggal berakhir kalibrasi awal",
    kind: "date",
  },
  {
    key: "initial_interval_months",
    label: "Interval kalibrasi awal (bulan)",
    kind: "integer",
  },
  {
    key: "initial_certificate_number",
    label: "Nomor sertifikat kalibrasi awal",
    kind: "text",
    max: 200,
  },
  {
    key: "initial_laboratory",
    label: "Lembaga kalibrasi awal",
    kind: "text",
    max: 200,
  },
  ...monitoringCalibrationFields.map((field) => ({
    ...field,
    key: "initial_" + field.key,
  })),
];

export function monitoringValue(
  row: Record<string, unknown>,
  key: string,
): string {
  const groups = Array.isArray(row.monitoring_measurements)
    ? row.monitoring_measurements.filter(
        (v): v is Record<string, unknown> =>
          !!v && typeof v === "object" && !Array.isArray(v),
      )
    : [];
  if (
    groups.length > 1 &&
    (measurementKeys as readonly string[]).includes(key) &&
    groups.some((group) => key in group)
  ) {
    const values = groups.map((group) => String(group[key] ?? row[key] ?? ""));
    const rangesDiffer =
      new Set(groups.map((g) => String(g.measurement_range || ""))).size > 1;
    if (
      new Set(values).size > 1 ||
      (rangesDiffer && ["measurement_range", "correction_factor"].includes(key))
    )
      return values
        .map((value, index) => `[${index + 1}] ${value}`)
        .join(key === "correction_factor" ? "\n\n" : "\n");
    return values[0];
  }
  if (key === "latest_calibration_date")
    return String(row[key] || row.calibration_date_original || "");
  if (key === "latest_due_date")
    return String(row[key] || row.due_date_original || "");
  return String(row[key] ?? "");
}
