import { describe, expect, it } from "vitest";
import { normalize, personnelRenewalIntent } from "@/features/imports/normalize";

describe("personnel spreadsheet import", () => {
  it("reads the human headers from the personnel export", () => {
    const result = normalize("personnel", {
      NPP: "18103",
      "NAMA PEGAWAI": "I Putu Indra Murtha",
      "JUDUL LISENSI": "Petugas Pengambil Contoh BBM",
      TERBIT: "2025-04-21",
      "INTERVAL (BULAN)": "12",
      BERAKHIR: "2026-04-21",
      "Link Sertifikat": "https://drive.google.com/drive/folders/example123",
      "No. Sertifikat (jika ada)": "IMG.074 00580 2025",
      KETERANGAN: "Dalam tahap perpanjangan",
      "STATUS PROSES PERPANJANGAN": "Belum Diproses",
    });
    expect(result.normalized).toMatchObject({
      npp: "18103",
      employee_name: "I Putu Indra Murtha",
      original_title: "Petugas Pengambil Contoh BBM",
      certificate_number: "IMG.074 00580 2025",
      issue_date: "2025-04-21",
      expiry_date: "2026-04-21",
      renewal_intent: "processing",
    });
  });

  it("recognizes renewal intent from either notes or the process column", () => {
    expect(personnelRenewalIntent({ notes: "Dalam Proses Perpanjangan di AISI" })).toBe("processing");
    expect(personnelRenewalIntent({ renewal_status_source: "Sedang Diproses" })).toBe("processing");
    expect(personnelRenewalIntent({ notes: "Dokumen masih berlaku" })).toBe("");
  });
});
