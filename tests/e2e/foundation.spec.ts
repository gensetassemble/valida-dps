import { test, expect } from "@playwright/test";
test("beranda dan navigasi autentikasi", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Fondasi tepercaya/ })).toBeVisible();
  await page.screenshot({ path: ".artifacts/home-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Masuk ke VALIDA" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Lupa kata sandi?" }).click();
  await expect(page.getByRole("heading", { name: "Pulihkan kata sandi" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("dashboard menolak sesi anonim", async ({ page }) => { await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login/); });
test("callback Microsoft gagal tertutup", async ({ request }) => { const response = await request.get("/api/microsoft/callback?code=unsolicited"); expect(response.status()).toBe(503); expect((await response.json()).ok).toBe(false); });
test("tampilan seluler tidak melebar", async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); await page.screenshot({ path: ".artifacts/home-mobile.png", fullPage: true }); });
