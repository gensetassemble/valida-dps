import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import ExcelJS from "exceljs";
import {
  validity,
  operationalValidity,
  remainingDays,
  todayWita,
  addMonths,
  equipmentEligibility,
  driveFolder,
} from "@/lib/domain/validity";
import { normalize, validateNormalized } from "@/features/imports/normalize";
import { parseSource, checkZip } from "@/features/imports/parser";
import { boundedForm } from "@/lib/http/bounded-form";
describe("WITA validity and lifetime", () => {
  it.each([
    [-1, "Kedaluwarsa"],
    [0, "Kritis"],
    [30, "Kritis"],
    [31, "Perhatian"],
    [60, "Perhatian"],
    [61, "Pantau"],
    [90, "Pantau"],
    [91, "Aman"],
  ])("day %i -> %s", (days, label) => {
    const target = new Date(Date.parse("2026-10-29") + Number(days) * 86400000)
      .toISOString()
      .slice(0, 10);
    expect(validity(target, true, false, "2026-10-29")).toBe(label);
  });
  it("changes calendar date at WITA midnight", () => {
    expect(todayWita(new Date("2026-10-28T16:00:00Z"))).toBe("2026-10-29");
    expect(todayWita(new Date("2026-10-28T15:59:59Z"))).toBe("2026-10-28");
  });
  it("never marks unverified or unknown dates safe", () => {
    expect(validity("2030-01-01", false)).toBe("Perlu Verifikasi");
    expect(validity(null, true)).toBe("Perlu Verifikasi");
    expect(validity("2026-02-30", true)).toBe("Perlu Verifikasi");
    expect(remainingDays("not-a-date")).toBeNull();
  });
  it("lifetime is distinct and still requires evidence verification", () => {
    expect(validity(null, true, true)).toBe("Berlaku Seumur Hidup");
    expect(validity(null, false, true)).toBe("Perlu Verifikasi");
  });
  it.each([
    ["2024-01-31", 1, "2024-02-29"],
    ["2025-01-31", 1, "2025-02-28"],
    ["2024-02-29", 12, "2025-02-28"],
    ["2026-12-31", 2, "2027-02-28"],
  ])("calendar months %s", (date, n, result) =>
    expect(addMonths(String(date), Number(n))).toBe(result),
  );
});
describe("Calibration eligibility", () => {
  it("tracks supplied dates immediately without a review stage", () => {
    expect(operationalValidity("2026-10-29", false, "2026-10-29")).toBe(
      "Kritis",
    );
    expect(operationalValidity("2030-01-01", false, "2026-10-29")).toBe("Aman");
    expect(operationalValidity(null, true)).toBe("Berlaku Seumur Hidup");
    expect(operationalValidity(null)).toBe("Tanggal Belum Diisi");
    expect(operationalValidity("invalid")).toBe("Tanggal Belum Diisi");
  });
  const event = {
    id: "1",
    calibration_date: "2026-01-01",
    created_at: "2026-01-01T00:00:00Z",
    verification_status: "verified",
    result: "layak",
    due_date: "2027-01-01",
  };
  it("requires a recorded result and future/current due date", () => {
    expect(equipmentEligibility([event], "2026-10-29")).toBe("Layak Pakai");
    expect(
      equipmentEligibility([{ ...event, result: null }], "2026-10-29"),
    ).toBe("Hasil Belum Diisi");
    expect(
      equipmentEligibility([{ ...event, result: "tidak_layak" }], "2026-10-29"),
    ).toBe("Tidak Layak Pakai");
    expect(
      equipmentEligibility(
        [{ ...event, due_date: "2026-10-28" }],
        "2026-10-29",
      ),
    ).toBe("Tidak Layak Pakai");
  });
  it("a latest event with missing result cannot clear an asset", () => {
    expect(
      equipmentEligibility(
        [
          event,
          {
            ...event,
            id: "2",
            calibration_date: "2026-10-28",
            verification_status: "pending",
            result: null,
          },
        ],
        "2026-10-29",
      ),
    ).toBe("Hasil Belum Diisi");
  });
  it("ties are deterministic and invalid dates do not clear", () => {
    expect(
      equipmentEligibility(
        [
          event,
          { ...event, id: "2", verification_status: "pending", result: null },
        ],
        "2026-10-29",
      ),
    ).toBe("Hasil Belum Diisi");
    expect(
      equipmentEligibility([{ ...event, due_date: "invalid" }], "2026-10-29"),
    ).toBe("Tanggal Belum Diisi");
  });
});
describe("Source normalization and private imports", () => {
  it("retains leading zeros and strips directional marks only from normalized identifiers", () => {
    const raw = {
      NRK: "\u202d00001\u202c",
      NAMA: "[CONTOH] Pegawai",
      EMPCAT: "PTT",
      "UNIT ORGANISASI": "DPS",
    };
    const result = normalize("employees", raw);
    expect(result.normalized.npp).toBe("00001");
    expect(raw.NRK).toContain("\u202d");
    expect(result.normalized.employment_category).toBe("PTT_REGULAR");
    expect(result.issues).toHaveLength(0);
  });
  it("uses explicit per-record lifetime and never infers it from title", () => {
    expect(
      normalize("personnel", { JudulLisensiAsli: "[CONTOH] P3K" }).normalized
        .validity_kind,
    ).toBe("term");
    const r = normalize("personnel", {
      JenisMasaBerlaku: "LIFETIME",
      IsLifetime: "true",
    });
    expect(r.normalized.expiry_date).toBe("");
    expect(r.normalized.interval_months).toBe("");
    expect(r.normalized.validity_kind).toBe("lifetime");
  });
  it("uses normalized ISO rather than invalid raw date strings", () => {
    expect(
      normalize("personnel", {
        TanggalBerakhirAsli: "28/17/2030",
        TanggalBerakhirISO: "2030-07-28",
      }).normalized.expiry_date,
    ).toBe("2030-07-28");
  });
  it("does not infer calibration test outcome from asset condition", () => {
    const n = normalize("calibrations", {
      KondisiBarangAsli: "Baik",
      StatusBarangAsli: "Terpakai",
    }).normalized;
    expect(n).not.toHaveProperty("result");
    expect(n.equipment_id).toBe("");
    expect(validateNormalized("calibrations", n).length).toBeGreaterThan(0);
  });
  it("accepts UTF8 BOM, CRLF and quoted CSV fields without mutating data", async () => {
    const b = Buffer.from(
      '\ufeffNRK,NamaPegawai,EMPCAT\r\n00002,"[CONTOH] Nama, Dua",PT\r\n',
    );
    const r = await parseSource("test.csv", b, "employees");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].normalized.npp).toBe("00002");
    expect(r.rows[0].raw.NamaPegawai).toContain(",");
    expect(r.rows[0].row).toBe(2);
  });
  it("rejects reserved headers and repeat source rows are marked", async () => {
    await expect(
      parseSource(
        "x.csv",
        Buffer.from("constructor,NRK\nx,00001"),
        "employees",
      ),
    ).rejects.toThrow();
    const r = await parseSource(
      "x.csv",
      Buffer.from(
        "NRK,NamaPegawai,EMPCAT\n00001,[CONTOH],PT\n00001,[CONTOH],PT",
      ),
      "employees",
    );
    expect(r.rows[1].status).toBe("duplicate");
  });
  it("reads XLSX identifiers as text and guards compressed resource expansion", async () => {
    const w = new ExcelJS.Workbook();
    const s = w.addWorksheet("Data");
    w.addWorksheet("Petunjuk");
    s.addRow(["NRK", "NamaPegawai", "EMPCAT"]);
    s.addRow(["00001", "[CONTOH] Nama", "PT"]);
    const bytes = Buffer.from(await w.xlsx.writeBuffer());
    const r = await parseSource("test.xlsx", bytes, "employees");
    expect(r.rows[0].normalized.npp).toBe("00001");
    const mutated = Buffer.from(bytes);
    const central = mutated.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    mutated.writeUInt32LE(30 * 1024 * 1024, central + 24);
    expect(() => checkZip(mutated)).toThrow();
  });
  it("blocks canonical import without mapped identity and catalog", () => {
    const errors = validateNormalized("personnel", {
      original_title: "[CONTOH] License",
      validity_kind: "term",
      expiry_date: "2030-01-01",
    });
    expect(errors.some((e) => e.startsWith("employee_id"))).toBe(true);
    expect(errors.some((e) => e.startsWith("certificate_type_id"))).toBe(true);
  });
  it("only accepts Drive folder references", () => {
    expect(
      driveFolder("https://drive.google.com/drive/folders/CONTOH123"),
    ).toContain("drive.google.com");
    expect(driveFolder("https://evil.example/drive/folders/test")).toBeNull();
    expect(driveFolder("javascript:alert(1)")).toBeNull();
    expect(driveFolder("https://drive.google.com/file/d/test/view")).toBeNull();
  });
  it("bounds streaming multipart bodies even with no Content-Length", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: "x".repeat(20),
    });
    await expect(boundedForm(request, 10)).rejects.toThrow("batas");
  });
});
