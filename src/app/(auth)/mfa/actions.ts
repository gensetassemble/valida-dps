"use server";
import { z } from "zod";
import { hasSecondFactor } from "@/lib/auth/security";
import { mfaContext } from "@/lib/auth/mfa-context";

export async function startMfaEnrollment() {
  try {
    const db = await mfaContext();
    const factors = await db.auth.mfa.listFactors();
    if (factors.error) return { error: "Faktor keamanan belum dapat dimuat." };
    if (factors.data.all.some(f => f.status === "verified") && !(await hasSecondFactor(db)))
      return { error: "Gunakan authenticator yang sudah terdaftar." };
    for (const factor of factors.data.all.filter(f => f.status === "unverified" && f.factor_type === "totp"))
      await db.auth.mfa.unenroll({ factorId: factor.id });
    const result = await db.auth.mfa.enroll({ factorType: "totp", issuer: "VALIDA DPS", friendlyName: "Authenticator VALIDA" });
    if (result.error) return { error: "Authenticator belum dapat didaftarkan. Hubungi IT Officer." };
    return { id: result.data.id, qr: result.data.totp.qr_code };
  } catch { return { error: "Sesi tidak tersedia. Silakan masuk kembali." }; }
}

export async function verifyMfaCode(input: unknown) {
  const parsed = z.object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).strict().safeParse(input);
  if (!parsed.success) return { error: "Masukkan enam angka dari authenticator." };
  try {
    const db = await mfaContext();
    const factors = await db.auth.mfa.listFactors();
    if (factors.error || !factors.data.all.some(f => f.id === parsed.data.factorId && f.factor_type === "totp"))
      return { error: "Faktor keamanan tidak tersedia." };
    const result = await db.auth.mfa.challengeAndVerify(parsed.data);
    if (result.error) return { error: "Kode tidak sesuai atau sudah expired. Coba kode terbaru." };
    return { ok: true };
  } catch { return { error: "Verifikasi belum dapat diproses. Silakan masuk kembali." }; }
}
