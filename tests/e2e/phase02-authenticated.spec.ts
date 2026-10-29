import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
const fixtureFile = ".tools/phase02-identities.json";
type Account = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  password: string;
  role: string | null;
};
const fixture: {
  run: string;
  users: Record<string, Account>;
  clients: { a: string; b: string };
  certificate: string;
} | null = existsSync(fixtureFile)
  ? JSON.parse(readFileSync(fixtureFile, "utf8"))
  : null;
async function login(page: Page, key: string) {
  const user = fixture!.users[key];
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
}
const testName = (value: string) => `[CONTOH] E2E ${value} ${fixture!.run}`;
const attempt = Date.now().toString(36);
const recordName = (value: string) => `${testName(value)} ${attempt}`;
test.describe("Phase 02 authenticated development verification", () => {
  test.skip(
    !fixture,
    "Memerlukan akun uji development yang disetujui; tidak membuat Auth account otomatis di CI.",
  );
  test.describe.configure({ mode: "serial" });
  test("admin login, shell 240/68, server catalog and mobile drawer", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page, "admin");
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("desktop-sidebar")).toHaveCSS(
      "width",
      "240px",
    );
    await page.getByRole("button", { name: "Ringkas sidebar" }).click();
    await expect(page.getByTestId("desktop-sidebar")).toHaveCSS(
      "width",
      "68px",
    );
    await page.getByRole("button", { name: "Perluas sidebar" }).click();
    await page.goto("/master-data/portofolio");
    await expect(
      page.getByRole("cell", { name: "HMPM", exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: ".artifacts/phase02-master-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Buka navigasi" }).click();
    const drawer = page.getByRole("dialog", { name: "Navigasi VALIDA" });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Pelanggan", exact: true }).click();
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pelanggan", exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".artifacts/phase02-master-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
  test("real work-area CRUD, sort, filters, confirmation and audit", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/master-data/wilayah");
    await page.getByRole("button", { name: "Tambah wilayah kerja" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nama wilayah", { exact: true })
      .fill(recordName("Wilayah"));
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: recordName("Wilayah"), exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `Ubah ${recordName("Wilayah")}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Nama wilayah", { exact: true })
      .fill(recordName("Wilayah Diperbarui"));
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Simpan perubahan" })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page.getByRole("cell", {
        name: recordName("Wilayah Diperbarui"),
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `Nonaktifkan ${recordName("Wilayah Diperbarui")}`,
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "Konfirmasi perubahan" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.locator('select[name="active"]').selectOption("false");
    await expect(
      page.getByRole("cell", {
        name: recordName("Wilayah Diperbarui"),
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Nama wilayah/ }).click();
    await expect(page).toHaveURL(/sort=name/);
    await page.goto("/audit?q=work_areas");
    await expect(
      page.getByRole("cell", { name: "work_areas", exact: true }).first(),
    ).toBeVisible();
  });
  test("admin directory verification and multiple portfolio assignments", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/master-data/pegawai");
    await page
      .getByRole("button", { name: "Tambah pegawai", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nama lengkap", { exact: true })
      .fill(recordName("Pegawai Tambahan"));
    await dialog
      .getByLabel("NPP", { exact: true })
      .fill("0000" + fixture!.run + attempt);
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("link", {
        name: recordName("Pegawai Tambahan"),
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: recordName("Pegawai Tambahan"), exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Penugasan Portofolio", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Tambah penugasan", exact: true })
      .click();
    const assignment = page.getByRole("dialog");
    await expect(
      assignment.locator('select[id="portfolio_id"] option', {
        hasText: "HMPM",
      }),
    ).toHaveCount(1);
    await assignment
      .locator('select[id="portfolio_id"]')
      .selectOption({ label: "HMPM" });
    await assignment.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(assignment).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: "HMPM", exact: true }),
    ).toBeVisible();
  });
  test("client/contact CRUD uses actual relations and validation", async ({
    page,
  }) => {
    await login(page, "admin");
    await page.goto("/pelanggan");
    await page
      .getByRole("button", { name: "Tambah pelanggan", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nama pelanggan", { exact: true })
      .fill(recordName("Pelanggan Baru"));
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole("link", { name: recordName("Pelanggan Baru"), exact: true })
      .click();
    await page
      .getByRole("button", { name: "Tambah kontak", exact: true })
      .click();
    const contact = page.getByRole("dialog");
    await contact
      .getByLabel("Nama kontak", { exact: true })
      .fill(recordName("Kontak"));
    await contact
      .getByLabel("Email", { exact: true })
      .fill(`kontak-${fixture!.run}@example.invalid`);
    await contact.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(contact).not.toBeVisible();
    await expect(
      page.getByRole("cell", { name: recordName("Kontak"), exact: true }),
    ).toBeVisible();
  });
  test("AM sees assigned client only and cannot open admin role management", async ({
    page,
  }) => {
    await login(page, "am_a");
    await page.goto("/pelanggan");
    await expect(
      page.getByRole("link", { name: testName("Pelanggan A"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: testName("Pelanggan B"), exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Audit Trail", exact: true }),
    ).toHaveCount(0);
    await page.goto("/pengaturan/pengguna");
    await expect(
      page.getByRole("heading", { name: "Akses ditolak" }),
    ).toBeVisible();
  });
  test("portfolio aliases and certificate/service catalogs save real records", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await login(page, "admin");
    const code = `E2E_${fixture!.run}_${attempt}`;
    await page.goto("/master-data/portofolio");
    await page
      .getByRole("button", { name: "Tambah portofolio", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Kode portofolio", { exact: true }).fill(code);
    await dialog
      .getByLabel("Nama portofolio", { exact: true })
      .fill(recordName("Portofolio"));
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("link", { name: code, exact: true }).click();
    await page
      .getByRole("button", { name: "Tambah alias", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Label historis", { exact: true })
      .fill(recordName("Label Historis"));
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("cell", {
        name: recordName("Label Historis"),
        exact: true,
      }),
    ).toBeVisible();
    await page.goto("/master-data/jenis-sertifikat");
    await page
      .getByRole("button", { name: "Tambah jenis sertifikat", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Kode jenis", { exact: true }).fill(code);
    await dialog
      .getByLabel("Nama jenis", { exact: true })
      .fill(recordName("Jenis Kompetensi"));
    await dialog
      .getByLabel("Kategori", { exact: true })
      .selectOption("personnel");
    await dialog.getByLabel("Hari pengingat", { exact: true }).fill("90,30,0");
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await page.getByRole("link", { name: code, exact: true }).click();
    await page
      .getByRole("button", { name: "Tambah pemetaan", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByRole("textbox", { name: "Cari pilihan Jenis layanan", exact: true })
      .fill("Layanan Halaman 01");
    await expect(
      dialog.locator("#service_type_id option", {
        hasText: "Layanan Halaman 01",
      }),
    ).toHaveCount(1);
    const option = await dialog
      .locator("#service_type_id option", { hasText: "Layanan Halaman 01" })
      .getAttribute("value");
    await dialog.locator("#service_type_id").selectOption(option!);
    await dialog
      .getByLabel("Dasar persyaratan", { exact: true })
      .fill(
        "[CONTOH] Pemetaan uji yang belum diverifikasi; bukan kewajiban regulasi.",
      );
    await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("cell", {
        name: "[CONTOH] Pemetaan uji yang belum diverifikasi; bukan kewajiban regulasi.",
        exact: true,
      }),
    ).toBeVisible();
  });
  test("server pagination returns a separate second page", async ({ page }) => {
    await login(page, "admin");
    await page.goto(`/master-data/layanan?q=${fixture!.run}`);
    await expect(
      page.getByText("22 rekaman sesuai akses dan filter"),
    ).toBeVisible();
    const first = await page.locator("tbody tr").allTextContents();
    expect(first).toHaveLength(20);
    await page
      .getByRole("button", { name: "Halaman berikutnya", exact: true })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("tbody tr")).toHaveCount(2);
    const second = await page.locator("tbody tr").allTextContents();
    expect(first.some((row) => second.includes(row))).toBe(false);
  });
  test("admin links verified directory to existing Auth UUID and grants multiple roles", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await login(page, "admin");
    const target = fixture!.users.pending;
    await page.goto("/pengaturan/pengguna");
    if (
      !(await page
        .getByRole("link", { name: target.name, exact: true })
        .count())
    ) {
      await page
        .getByRole("button", { name: "Tambah profil pengguna", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Tambah profil pengguna",
      });
      await dialog
        .getByLabel("UUID akun Supabase Auth", { exact: true })
        .fill(target.id);
      await dialog
        .getByLabel("Nama tampilan akun", { exact: true })
        .fill(target.name);
      await dialog
        .getByLabel("Email akun terverifikasi", { exact: true })
        .fill(target.email);
      await expect(
        dialog.locator("#employee_id option", { hasText: target.name }),
      ).toHaveCount(1);
      await dialog.locator("#employee_id").selectOption(target.employeeId);
      await dialog
        .getByRole("combobox", { name: "Aktif", exact: true })
        .selectOption("true");
      await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
      await page
        .getByRole("button", { name: "Setujui dan simpan", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await page.getByRole("link", { name: target.name, exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`/pengaturan/pengguna/${target.id}`),
    );
    await expect(
      page.getByRole("heading", { name: "Penugasan Peran", exact: true }),
    ).toBeVisible();
    for (const [code, label] of [
      ["inspector", "Personil / Inspector"],
      ["hrga", "HRGA"],
    ]) {
      if (
        await page
          .getByRole("button", { name: `Ubah ${code}`, exact: true })
          .count()
      ) {
        const activate = page.getByRole("button", {
          name: `Aktifkan ${code}`,
          exact: true,
        });
        if (await activate.count()) {
          await activate.click();
          await page
            .getByRole("dialog")
            .getByLabel("Alasan perubahan", { exact: true })
            .fill("[CONTOH] Aktivasi ulang penugasan untuk pengujian regresi.");
          await page
            .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
            .click();
          await expect(page.getByRole("dialog")).not.toBeVisible();
        }
        continue;
      }
      await page
        .getByRole("button", { name: "Tambah penugasan peran", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Tambah penugasan peran",
      });
      await expect(
        dialog.locator("#role_code option", { hasText: label }),
      ).toHaveCount(1);
      await dialog.locator("#role_code").selectOption(code);
      await dialog
        .getByLabel("Alasan pemberian/pencabutan", { exact: true })
        .fill("[CONTOH] Penugasan terotorisasi untuk pengujian multi-role.");
      await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
      await page
        .getByRole("button", { name: "Setujui dan simpan", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(
        page.getByRole("cell", { name: label, exact: true }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Nonaktifkan inspector", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Alasan perubahan", { exact: true })
      .fill("[CONTOH] Pencabutan peran uji; HRGA tetap aktif.");
    await page
      .getByRole("button", { name: "Konfirmasi perubahan", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Logout akun", exact: true })
      .click();
    await login(page, "pending");
    await page.goto("/master-data/pegawai");
    await expect(
      page.getByRole("button", { name: "Tambah pegawai", exact: true }),
    ).toBeVisible();
  });
  test("branch head has real read access without mutation controls", async ({
    page,
  }) => {
    await login(page, "head");
    await page.goto("/pelanggan");
    await expect(
      page.getByRole("link", { name: testName("Pelanggan A"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: testName("Pelanggan B"), exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tambah pelanggan", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Ubah / })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Logout akun", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
  });
});
