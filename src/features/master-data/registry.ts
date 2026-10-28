import { ALL_ROLES, type Role } from "@/lib/auth/permissions";
export type FieldKind =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "boolean"
  | "select"
  | "lookup"
  | "date"
  | "integer"
  | "days";
export type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  max?: number;
  options?: { value: string; label: string }[];
  lookup?: string;
  hint?: string;
  immutable?: boolean;
};
export type EntityConfig = {
  key: string;
  table: string;
  title: string;
  singular: string;
  description: string;
  path: string;
  idKey: string;
  labelKey: string;
  fields: Field[];
  columns: string[];
  search: string[];
  readRoles: readonly Role[];
  writeRoles: readonly Role[];
  create?: boolean;
  readonly?: boolean;
  detail?: string;
};
const active: Field = { key: "is_active", label: "Aktif", kind: "boolean" };
const verification: Field = {
  key: "verification_status",
  label: "Status verifikasi",
  kind: "select",
  required: true,
  options: [
    { value: "pending", label: "Menunggu Verifikasi" },
    { value: "verified", label: "Terverifikasi" },
    { value: "rejected", label: "Ditolak" },
  ],
  hint: "Pilih Terverifikasi hanya setelah sumber identitas/dokumen diperiksa.",
};
const text = (
  key: string,
  label: string,
  required = false,
  max = 200,
): Field => ({ key, label, kind: "text", required, max });
const lookup = (
  key: string,
  label: string,
  entity: string,
  required = false,
  immutable = false,
): Field => ({
  key,
  label,
  kind: "lookup",
  lookup: entity,
  required,
  immutable,
});
const admin: Role[] = ["admin"];
const personnel: Role[] = [
  "admin",
  "hrga",
  "coordinator",
  "qshe",
  "inspector",
  "branch_head",
];
const clientReaders: Role[] = [
  "admin",
  "account_manager",
  "qshe",
  "branch_head",
];
const base = {
  idKey: "id",
  labelKey: "name",
  readRoles: ALL_ROLES,
  writeRoles: admin,
};
export const ENTITIES: Record<string, EntityConfig> = {
  cabang: {
    ...base,
    key: "cabang",
    table: "branches",
    title: "Cabang",
    singular: "Cabang",
    path: "/master-data/cabang",
    idKey: "code",
    labelKey: "name",
    create: false,
    description:
      "Cabang yang tercakup dalam penugasan Anda. Cabang baru memerlukan provisioning organisasi.",
    fields: [
      text("code", "Kode cabang", true, 8),
      text("name", "Nama cabang", true),
      text("region", "Wilayah operasional"),
      active,
    ],
    columns: ["code", "name", "region", "is_active"],
    search: ["code", "name", "region"],
  },
  wilayah: {
    ...base,
    key: "wilayah",
    table: "work_areas",
    title: "Wilayah Kerja",
    singular: "Wilayah kerja",
    path: "/master-data/wilayah",
    description: "Katalog wilayah kerja yang dipelihara pada cabang.",
    fields: [text("name", "Nama wilayah", true, 120), active],
    columns: ["name", "is_active", "updated_at"],
    search: ["name"],
  },
  portofolio: {
    ...base,
    key: "portofolio",
    table: "portfolios",
    title: "Portofolio",
    singular: "Portofolio",
    path: "/master-data/portofolio",
    description: "Portofolio dan pemetaan label historis yang telah diperiksa.",
    detail: "/master-data/portofolio",
    fields: [
      text("code", "Kode portofolio", true, 32),
      text("name", "Nama portofolio", true, 160),
      active,
    ],
    columns: ["code", "name", "is_active"],
    search: ["code", "name"],
  },
  alias: {
    ...base,
    key: "alias",
    table: "portfolio_aliases",
    title: "Alias Portofolio",
    singular: "Alias",
    path: "/master-data/portofolio",
    labelKey: "alias",
    description:
      "Pemetaan historis; tidak menyimpulkan portofolio dari label yang belum diverifikasi.",
    fields: [
      text("alias", "Label historis", true),
      lookup("portfolio_id", "Portofolio kanonis", "portofolio", true, true),
      verification,
      { ...text("verification_note", "Catatan verifikasi"), kind: "textarea" },
      active,
    ],
    columns: ["alias", "verification_status", "is_active"],
    search: ["alias"],
  },
  pegawai: {
    ...base,
    key: "pegawai",
    table: "employee_directory",
    title: "Direktori Pegawai",
    singular: "Pegawai",
    path: "/master-data/pegawai",
    labelKey: "full_name",
    detail: "/master-data/pegawai",
    readRoles: personnel,
    writeRoles: ["admin", "hrga"],
    description:
      "Identitas organisasi terpisah dari akun login. Entri direktori tidak memberikan akses aplikasi.",
    fields: [
      text("full_name", "Nama lengkap", true, 160),
      {
        ...text("npp", "NPP", false, 40),
        hint: "Disimpan sebagai teks; nol di depan tetap dipertahankan.",
      },
      text("position", "Jabatan"),
      {
        key: "employment_status",
        label: "Status kepegawaian",
        kind: "select",
        required: true,
        options: [
          { value: "unknown", label: "Belum Dikonfirmasi" },
          { value: "active", label: "Aktif" },
          { value: "inactive", label: "Tidak Aktif" },
        ],
      },
      verification,
      { ...text("verification_note", "Dasar verifikasi"), kind: "textarea" },
      active,
    ],
    columns: [
      "full_name",
      "npp",
      "position",
      "verification_status",
      "is_active",
    ],
    search: ["full_name", "npp", "position"],
  },
  penugasan: {
    ...base,
    key: "penugasan",
    table: "employee_portfolio_assignments",
    title: "Penugasan Portofolio",
    singular: "Penugasan",
    path: "/master-data/pegawai",
    labelKey: "assignment_type",
    readRoles: personnel,
    writeRoles: ["admin", "hrga"],
    description:
      "Hanya penugasan terverifikasi dalam rentang tanggal yang memberi cakupan portofolio.",
    fields: [
      lookup("employee_id", "Pegawai", "pegawai", true, true),
      lookup("portfolio_id", "Portofolio", "portofolio", true, true),
      {
        key: "assignment_type",
        label: "Jenis penugasan",
        kind: "select",
        required: true,
        immutable: true,
        options: [
          { value: "coordinator", label: "Koordinator" },
          { value: "personnel", label: "Personil" },
          { value: "qshe", label: "QSHE" },
          {
            value: "equipment_responsible",
            label: "Penanggung Jawab Peralatan",
          },
        ],
      },
      {
        key: "effective_from",
        label: "Berlaku sejak",
        kind: "date",
        required: true,
      },
      { key: "effective_until", label: "Berlaku sampai", kind: "date" },
      verification,
      text("verification_note", "Dasar persetujuan"),
      active,
    ],
    columns: [
      "portfolio_id",
      "assignment_type",
      "effective_from",
      "effective_until",
      "verification_status",
      "is_active",
    ],
    search: ["assignment_type"],
  },
  "jenis-sertifikat": {
    ...base,
    key: "jenis-sertifikat",
    table: "certificate_types",
    title: "Jenis Sertifikat",
    singular: "Jenis sertifikat",
    path: "/master-data/jenis-sertifikat",
    detail: "/master-data/jenis-sertifikat",
    description:
      "Katalog jenis sertifikat; rujukan regulasi hanya diisi dari sumber yang telah diverifikasi.",
    fields: [
      text("code", "Kode jenis", true, 40),
      text("name", "Nama jenis", true),
      {
        key: "category",
        label: "Kategori",
        kind: "select",
        required: true,
        options: [
          { value: "client", label: "Klien" },
          { value: "personnel", label: "Personel" },
          { value: "equipment", label: "Peralatan" },
        ],
      },
      text("regulation_reference", "Rujukan regulasi"),
      text("issuer", "Penerbit"),
      {
        key: "default_validity_months",
        label: "Masa berlaku standar (bulan)",
        kind: "integer",
        hint: "Kosongkan bila belum dikonfirmasi.",
      },
      {
        key: "reminder_days",
        label: "Hari pengingat",
        kind: "days",
        required: true,
        hint: "Pisahkan dengan koma, misalnya 90,60,30,0. Belum mengaktifkan jadwal pengiriman.",
      },
      active,
    ],
    columns: ["code", "name", "category", "is_active"],
    search: ["code", "name", "issuer"],
  },
  layanan: {
    ...base,
    key: "layanan",
    table: "service_types",
    title: "Jenis Layanan",
    singular: "Jenis layanan",
    path: "/master-data/layanan",
    description:
      "Katalog layanan; pemetaan kompetensi harus ditinjau secara terpisah.",
    fields: [
      text("code", "Kode layanan", true, 40),
      text("name", "Nama layanan", true),
      active,
    ],
    columns: ["code", "name", "is_active"],
    search: ["code", "name"],
  },
  persyaratan: {
    ...base,
    key: "persyaratan",
    table: "service_competency_requirements",
    title: "Pemetaan Kompetensi Layanan",
    singular: "Pemetaan",
    path: "/master-data/jenis-sertifikat",
    labelKey: "requirement_note",
    description:
      "Tidak berisi asumsi kewajiban hukum. Setiap pemetaan memerlukan dasar yang diverifikasi.",
    fields: [
      lookup("service_type_id", "Jenis layanan", "layanan", true, true),
      lookup(
        "certificate_type_id",
        "Jenis kompetensi",
        "jenis-sertifikat",
        true,
      ),
      {
        ...text("requirement_note", "Dasar persyaratan", true, 1000),
        kind: "textarea",
      },
      verification,
      text("verification_note", "Catatan verifikasi"),
      active,
    ],
    columns: [
      "service_type_id",
      "requirement_note",
      "verification_status",
      "is_active",
    ],
    search: ["requirement_note"],
  },
  pelanggan: {
    ...base,
    key: "pelanggan",
    table: "clients",
    title: "Pelanggan",
    singular: "Pelanggan",
    path: "/pelanggan",
    detail: "/pelanggan",
    readRoles: clientReaders,
    writeRoles: ["admin", "account_manager"],
    description:
      "Pelanggan dan kontak dalam cakupan penugasan Anda. Pengalihan AM tetap mempertahankan riwayat sertifikat.",
    fields: [
      text("name", "Nama pelanggan", true),
      text("industry_sector", "Sektor industri"),
      { ...text("address", "Alamat"), kind: "textarea" },
      text("site_location", "Lokasi situs"),
      lookup("work_area_id", "Wilayah kerja", "wilayah"),
      lookup("portfolio_id", "Portofolio", "portofolio"),
      lookup("account_manager_id", "Account Manager", "pengguna"),
      {
        ...text(
          "assignment_reason",
          "Alasan penetapan/pengalihan AM",
          false,
          1000,
        ),
        kind: "textarea",
        hint: "Wajib minimal 8 karakter untuk pengalihan AM oleh administrator.",
      },
      verification,
      text("verification_note", "Catatan verifikasi"),
      active,
    ],
    columns: [
      "name",
      "industry_sector",
      "work_area_id",
      "account_manager_id",
      "verification_status",
      "is_active",
    ],
    search: ["name", "industry_sector", "site_location"],
  },
  kontak: {
    ...base,
    key: "kontak",
    table: "client_contacts",
    title: "Kontak Pelanggan",
    singular: "Kontak",
    path: "/pelanggan",
    readRoles: clientReaders,
    writeRoles: ["admin", "account_manager"],
    description:
      "Data kontak hanya dalam cakupan pelanggan yang dapat Anda akses.",
    fields: [
      lookup("client_id", "Pelanggan", "pelanggan", true, true),
      text("name", "Nama kontak", true, 160),
      text("position", "Jabatan"),
      text("department", "Departemen"),
      { key: "email", label: "Email", kind: "email" },
      { key: "phone", label: "Telepon", kind: "tel" },
      { key: "whatsapp", label: "WhatsApp", kind: "tel" },
      { key: "is_primary", label: "Kontak utama", kind: "boolean" },
      verification,
      text("verification_note", "Catatan verifikasi"),
      active,
    ],
    columns: [
      "name",
      "position",
      "email",
      "whatsapp",
      "is_primary",
      "verification_status",
      "is_active",
    ],
    search: ["name", "position", "email", "department"],
  },
  pengguna: {
    ...base,
    key: "pengguna",
    table: "profiles",
    title: "Pengguna",
    singular: "Profil pengguna",
    path: "/pengaturan/pengguna",
    labelKey: "full_name",
    detail: "/pengaturan/pengguna",
    readRoles: admin,
    writeRoles: admin,
    description:
      "Tautkan Auth UUID yang telah disediakan organisasi. Halaman ini tidak membuat akun Supabase Auth atau mengirim undangan.",
    fields: [
      { ...text("id", "UUID akun Supabase Auth", true, 36), immutable: true },
      lookup("employee_id", "Identitas pegawai terverifikasi", "pegawai"),
      text("full_name", "Nama tampilan akun", false, 160),
      { key: "email", label: "Email akun terverifikasi", kind: "email" },
      { key: "whatsapp", label: "WhatsApp", kind: "tel" },
      active,
    ],
    columns: ["full_name", "email", "employee_id", "is_active"],
    search: ["full_name", "email"],
  },
  roles: {
    ...base,
    key: "roles",
    table: "roles",
    title: "Katalog Peran",
    singular: "Peran",
    path: "/pengaturan/roles",
    idKey: "code",
    description:
      "Definisi peran sistem bersifat tetap. Kewenangan diberikan melalui penugasan pengguna per cabang.",
    readonly: true,
    create: false,
    readRoles: admin,
    fields: [
      text("code", "Kode"),
      text("name", "Nama peran"),
      text("description", "Tanggung jawab"),
      active,
    ],
    columns: ["code", "name", "description", "is_active"],
    search: ["code", "name"],
  },
  "penugasan-peran": {
    ...base,
    key: "penugasan-peran",
    table: "user_role_assignments",
    title: "Penugasan Peran",
    singular: "Penugasan peran",
    path: "/pengaturan/roles",
    labelKey: "role_code",
    readRoles: admin,
    writeRoles: admin,
    description:
      "Satu akun dapat memiliki beberapa peran. Penugasan sendiri ditolak database; seluruh grant/revoke dicatat.",
    fields: [
      lookup("profile_id", "Pengguna", "pengguna", true, true),
      {
        key: "role_code",
        label: "Peran",
        kind: "lookup",
        lookup: "roles",
        required: true,
        immutable: true,
      },
      {
        ...text("grant_reason", "Alasan pemberian/pencabutan", true, 1000),
        kind: "textarea",
      },
      active,
    ],
    columns: [
      "profile_id",
      "role_code",
      "is_active",
      "granted_at",
      "revoked_at",
    ],
    search: ["role_code", "grant_reason"],
  },
  audit: {
    ...base,
    key: "audit",
    table: "audit_logs",
    title: "Audit Trail",
    singular: "Peristiwa audit",
    path: "/audit",
    labelKey: "table_name",
    readRoles: admin,
    readonly: true,
    create: false,
    description:
      "Riwayat perubahan database cabang. Tidak dapat diubah atau dihapus oleh aplikasi.",
    fields: [],
    columns: ["table_name", "record_id", "action", "actor_id", "occurred_at"],
    search: ["table_name", "record_id", "action"],
  },
};
export const MASTER_KEYS = [
  "cabang",
  "wilayah",
  "portofolio",
  "pegawai",
  "jenis-sertifikat",
  "layanan",
];
export function getEntity(key: string) {
  return Object.hasOwn(ENTITIES, key) ? ENTITIES[key] : undefined;
}
