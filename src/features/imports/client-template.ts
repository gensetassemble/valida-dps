export const CLIENT_TEMPLATE_EXAMPLE_MARKER = "[CONTOH - TIDAK DIIMPOR]";

export const CLIENT_CERTIFICATE_TEMPLATE_COLUMNS = [
  { sourceKey: "portfolio_code", formKey: "portfolio_id", header: "Portofolio", width: 14.5 },
  { sourceKey: "client_name", formKey: "client_id", header: "Nama Pelanggan", width: 34 },
  { sourceKey: "certificate_type_name", formKey: "certificate_type_id", header: "Jenis Sertifikat", width: 37.625 },
  { sourceKey: "certificate_number", formKey: "certificate_number", header: "Nomor Sertifikat", width: 51.625 },
  { sourceKey: "object_type", formKey: "object_type", header: "Objek Inspeksi", width: 48.25 },
  { sourceKey: "object_serial", formKey: "object_serial", header: "Nomor Seri (opsional)", width: 28.5 },
  { sourceKey: "installation_location", formKey: "installation_location", header: "Lokasi", width: 36.875 },
  { sourceKey: "work_area_name", formKey: "certificate_work_area_id", header: "Wilayah", width: 13.5 },
  { sourceKey: "issue_date", formKey: "issue_date", header: "Tanggal Terbit", width: 20.625 },
  { sourceKey: "interval_months", formKey: "interval_months", header: "Interval (bulan)", width: 21.625 },
  { sourceKey: "expiry_date", formKey: "expiry_date", header: "Tanggal Berakhir", width: 23.5 },
  { sourceKey: "previous_order_value", formKey: "previous_order_value", header: "Nilai Kontrak (IDR)", width: 24.625 },
  { sourceKey: "order_reference", formKey: "order_reference", header: "Nomor SPK", width: 32 },
  { sourceKey: "pic_name", formKey: null, header: "PIC Perusahaan", width: 27 },
  { sourceKey: "pic_email", formKey: null, header: "Email PIC", width: 27 },
] as const;

export const CLIENT_CERTIFICATE_FORM_KEYS = CLIENT_CERTIFICATE_TEMPLATE_COLUMNS
  .flatMap((column) => column.formKey ? [column.formKey] : []);
