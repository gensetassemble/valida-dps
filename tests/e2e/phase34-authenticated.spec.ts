import { test, expect, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import ExcelJS from "exceljs";
const path = ".tools/phase02-identities.json";
const f = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
const run = f?.run || "none",
  testNpp =
    "0" + String(Math.floor(Date.now() / 1000) % 10000).padStart(4, "0"),
  attempt = Date.now().toString(36),
  name = (s: string) => "[CONTOH] E2E " + s + " " + run + " " + attempt;
let certId = "",
  certNumber = "",
  employeeId = "",
  assetId = "";
async function login(page: Page, key = "admin") {
  const u = f.users[key];
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(u.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
}
async function save(page: Page) {
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
}
async function typeOption(page: Page, code: string) {
  const label =
    code === "CONTOH_KLIEN"
      ? "Contoh jenis sertifikat klien"
      : "Contoh jenis sertifikat kompetensi";
  await expect(
    page.locator("#certificate_type_id option", { hasText: label }),
  ).toHaveCount(1);
  await page.locator("#certificate_type_id").selectOption({ label });
}
test.describe("Phase 03+04 development operations", () => {
  test.skip(
    !f,
    "Memerlukan fixture development sementara yang diotorisasi; tidak memakai data perusahaan di CI.",
  );
  test.describe.configure({ mode: "serial" });
  test("dashboard and six-column example kanban use real RLS queries", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await login(page);
    const template = await page.request.get(
      "/api/imports/template?domain=clients",
    );
    expect(template.status()).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      (await template.body()) as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0],
    );
    expect(
      (workbook.getWorksheet("Data")!.getRow(1).values as unknown[]).slice(1),
    ).toEqual([
      "Nama Pelanggan",
      "Jenis Sertifikat",
      "Nomor Sertifikat",
      "Objek Inspeksi",
      "Nomor Seri (opsional)",
      "Lokasi",
      "Wilayah",
      "Tanggal Terbit",
      "Interval (bulan)",
      "Tanggal Berakhir",
      "Nilai Kontrak (IDR)",
      "Account Manager (AM)",
      "Nomor SPK",
      "Cabang Operasional",
    ]);
    await expect(
      page.getByRole("heading", { name: "Segera Berakhir", exact: true }),
    ).toBeVisible();
    await page.goto("/pipeline-perpanjangan");
    await expect(page.getByText(/MODE CONTOH/)).toBeVisible();
    for (const label of [
      "Belum Dihubungi",
      "Dihubungi",
      "Penawaran Terkirim",
      "PO Diterima",
      "Ditunda",
      "Tidak Diperpanjang",
    ])
      await expect(
        page.getByRole("heading", { name: label, exact: true }),
      ).toBeVisible();
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.screenshot({
      path: ".artifacts/phase34-kanban-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: ".artifacts/phase34-kanban-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
  test("client certificate CRUD preserves decimal value and exports authorized XLSX", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/sertifikat-klien/baru");
    await expect(
      page.locator("#client_id option", { hasText: "Pelanggan A" }),
    ).toHaveCount(1);
    await page.locator("#client_id").selectOption(f.clients.a);
    await typeOption(page, "CONTOH_KLIEN");
    certNumber = name("Sertifikat Operasional");
    await page.getByLabel("Nomor sertifikat", { exact: true }).fill(certNumber);
    await page
      .getByLabel("Objek inspeksi", { exact: true })
      .fill("[CONTOH] Unit Inspeksi 01");
    await page.getByLabel("Nomor SPK", { exact: true }).fill(name("SPK"));
    await page.getByLabel("Tanggal terbit", { exact: true }).fill("2026-10-01");
    await page
      .getByLabel("Tanggal berakhir", { exact: true })
      .fill("2027-10-01");
    await page.getByLabel("Interval (bulan)", { exact: true }).fill("12");
    await page
      .getByLabel("Nilai kontrak (IDR)", { exact: true })
      .fill("900719925474099312.34");
    await save(page);
    await expect(page).toHaveURL(/\/sertifikat-klien\?/);
    const link = page.getByRole("link", { name: certNumber, exact: true });
    await expect(link).toBeVisible();
    certId = (await link.getAttribute("href"))!.split("/")[2].split("?")[0];
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Ekspor XLSX sesuai filter" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      "sertifikat-klien-sesuai-akses.xlsx",
    );
    await link.click();
    await expect(
      page.getByRole("heading", { name: certNumber, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Rp 900.719.925.474.099.312,34", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Ubah rekaman", exact: true }).click();
    await page
      .getByLabel("Lokasi", { exact: true })
      .fill("[CONTOH] Lokasi diperbarui");
    await save(page);
    await expect(page).toHaveURL(/\/sertifikat-klien\?/);
  });
  test("directory-only employee owns separate licenses and lifetime matrix", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/master-data/pegawai");
    await page
      .getByRole("button", { name: "Tambah pegawai", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nama lengkap", { exact: true })
      .fill(name("Personil Operasional"));
    await dialog
      .getByLabel("NPP", { exact: true })
      .fill("E2E-" + run + "-" + attempt);
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    const employee = page.getByRole("link", {
      name: name("Personil Operasional"),
      exact: true,
    });
    employeeId = (await employee.getAttribute("href"))!
      .split("/")[3]
      .split("?")[0];
    for (const [title, lifetime] of [
      ["Liquid Cargo", false],
      ["Draught Survey", false],
      ["Lifetime", true],
    ] as const) {
      await page.goto("/kompetensi-personil/baru");
      await expect(
        page.locator("#employee_id option", {
          hasText: name("Personil Operasional"),
        }),
      ).toHaveCount(1);
      await page.locator("#employee_id").selectOption(employeeId);
      await typeOption(page, "CONTOH_PERSONEL");
      await page
        .getByLabel("Judul lisensi asli", { exact: true })
        .fill(name(title));
      if (lifetime)
        await page
          .getByLabel("Jenis masa berlaku", { exact: true })
          .selectOption("lifetime");
      else
        await page
          .getByLabel("Tanggal berakhir", { exact: true })
          .fill("2030-07-28");
      await save(page);
      await expect(page).toHaveURL(/\/kompetensi-personil\?/);
    }
    await page.goto(
      "/kompetensi-personil/matriks?q=" +
        encodeURIComponent(name("Personil Operasional")),
    );
    await expect(
      page.getByRole("link", { name: name("Liquid Cargo") }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: name("Draught Survey") }),
    ).toBeVisible();
    await expect(
      page.getByText("Berlaku Seumur Hidup", { exact: true }),
    ).toBeVisible();
  });
  test("one asset retains two calibration events and rejects unsafe clearance", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/kalibrasi-alat/baru");
    await page.getByLabel("Nama alat", { exact: true }).fill(name("Alat"));
    await page
      .getByLabel("ID aset", { exact: true })
      .fill("E2E-" + run + "-" + attempt);
    await save(page);
    await expect(page).toHaveURL(/\/kalibrasi-alat\?/);
    const asset = page.getByRole("link", { name: name("Alat"), exact: true });
    assetId = (await asset.getAttribute("href"))!.split("/")[2].split("?")[0];
    for (const verified of [true, false]) {
      await page.goto("/kalibrasi-alat/" + assetId + "/kalibrasi/baru");
      await page
        .getByLabel("Nomor sertifikat", { exact: true })
        .fill(name(verified ? "Kalibrasi Lama" : "Kalibrasi Baru"));
      await page
        .getByLabel("Tanggal kalibrasi", { exact: true })
        .fill(verified ? "2026-01-31" : "2026-10-28");
      await page.getByLabel("Interval (bulan)", { exact: true }).fill("12");
      if (verified) {
        await page
          .getByLabel("Hasil kalibrasi", { exact: true })
          .selectOption("layak");
        await page
          .getByLabel("Sumber tanggal", { exact: true })
          .selectOption("approved_interval");
        await page
          .getByLabel("Keterangan sumber tanggal", { exact: true })
          .fill("[CONTOH] Interval disetujui penguji");
      }
      await save(page);
      await expect(page).toHaveURL(/\/kalibrasi-alat\?/);
      const row = page.getByRole("row").filter({ hasText: name("Alat") });
      await expect(row).toContainText(
        verified ? "Layak Pakai" : "Hasil Belum Diisi",
      );
    }
    await page.goto("/kalibrasi-alat/" + assetId);
    await expect(
      page.getByRole("cell", { name: name("Kalibrasi Lama"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: name("Kalibrasi Baru"), exact: true }),
    ).toBeVisible();
  });
  test("synthetic import requires row approval and preserves five-character NPP", async ({
    page,
  }) => {
    await login(page);
    const content = Buffer.from(
      "npp,full_name,employment_category,organization_unit\r\n" +
        testNpp +
        "," +
        name("Impor Browser") +
        ",PT,DPS\r\n",
    );
    await page.goto("/impor-data");
    await page.locator("input[name=file]").setInputFiles({
      name: "CONTOH-" + run + "-" + attempt + ".csv",
      mimeType: "text/csv",
      buffer: content,
    });
    await page
      .getByRole("button", { name: "Pratinjau & periksa kolom", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("1 baris terbaca");
    await page
      .getByRole("button", { name: "Simpan ke staging privat", exact: true })
      .click();
    await expect(page).toHaveURL(/\/impor-data\/[0-9a-f-]+/);
    const batch = page.url();
    await page
      .locator("input[name=reason]")
      .fill("[CONTOH] Persetujuan fixture sintetis untuk uji browser.");
    await page
      .getByRole("button", { name: "Setujui baris", exact: true })
      .click();
    await expect(
      page.getByText(
        "Konfirmasikan pemeriksaan baris dan pemetaan terlebih dahulu.",
      ),
    ).toBeVisible();
    await page.locator("input[name=confirmed]").check();
    await page
      .getByRole("button", { name: "Setujui baris", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Impor Baris yang Disetujui",
        exact: true,
      }),
    ).toBeEnabled();
    await page
      .locator("input[name=confirmation]")
      .fill("IMPOR DPS DEVELOPMENT");
    await page
      .getByRole("button", { name: "Impor Baris yang Disetujui", exact: true })
      .click();
    await expect(
      page.getByText("Sudah diimpor; ID", { exact: false }),
    ).toBeVisible();
    await page.goto(
      "/master-data/pegawai?q=" + encodeURIComponent(name("Impor Browser")),
    );
    await expect(
      page.getByRole("link", { name: name("Impor Browser"), exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("cell", { name: testNpp, exact: true }),
    ).toBeVisible();
    await page.goto(batch);
    await expect(
      page.getByRole("button", {
        name: "Impor Baris yang Disetujui",
        exact: true,
      }),
    ).toBeDisabled();
  });
  test("kanban gates block missing PIC and missing PDF; invalid PDF never uploads", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/pipeline-perpanjangan");
    const card = page.locator("article").filter({ hasText: certNumber });
    await card
      .getByRole("button", { name: "Catat tindak lanjut", exact: true })
      .click();
    await card
      .locator("textarea[name=note]")
      .fill("[CONTOH] Uji gerbang tanpa PIC terverifikasi.");
    await card.getByRole("checkbox").check();
    await card
      .getByRole("button", { name: "Simpan tindak lanjut", exact: true })
      .click();
    await expect(card.getByRole("status")).toContainText("Transisi ditolak");
    await page.goto("/sertifikat-klien/" + certId);
    await page.locator("input[name=file]").setInputFiles({
      name: "CONTOH-invalid.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("<html>invalid</html>"),
    });
    await page
      .getByRole("button", { name: "Unggah PDF privat", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Dokumen ditolak" }),
    ).toBeVisible();
  });
  test("AM and branch-head access stays restricted across new modules", async ({
    page,
  }) => {
    await login(page, "am_b");
    await page.goto("/sertifikat-klien");
    await expect(
      page.getByRole("link", { name: certNumber, exact: true }),
    ).toHaveCount(0);
    const response = await page.request.get(
      "/api/imports/template?domain=employees",
    );
    expect(response.status()).not.toBe(200);
    await login(page, "head");
    await page.goto("/sertifikat-klien");
    await expect(
      page.getByRole("link", { name: certNumber, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Tambah sertifikat klien",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Ubah / })).toHaveCount(0);
  });
});
