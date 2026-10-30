"use server";
import { requireActiveUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { changeOwnPasswordSchema } from "@/lib/auth/schemas";
import { signOutCurrentDevice } from "@/lib/auth/logout";

export async function changeOwnPassword(
  input: unknown,
): Promise<{ ok?: true; error?: string }> {
  await requireActiveUser();
  const parsed = changeOwnPasswordSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "Periksa isian password.",
    };
  try {
    const db = await createClient();
    // updateUser is scoped to the authenticated session, never a supplied user ID.
    const { error } = await db.auth.updateUser({
      password: parsed.data.password,
      current_password: parsed.data.currentPassword,
    });
    if (error) {
      if (
        error.code === "reauthentication_needed" ||
        error.code === "reauthentication_not_valid"
      )
        return {
          error:
            "Silakan logout dan masuk kembali, lalu ulangi penggantian password.",
        };
      if (error.code === "weak_password")
        return {
          error:
            "Password baru belum memenuhi persyaratan keamanan. Gunakan password yang lebih kuat.",
        };
      if (error.code === "same_password")
        return { error: "Password baru harus berbeda dari password saat ini." };
      if (error.status === 429)
        return {
          error:
            "Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba kembali.",
        };
      return {
        error:
          "Password belum diubah. Pastikan password saat ini benar, lalu coba kembali.",
      };
    }
  } catch {
    return { error: "Layanan belum dapat dihubungi. Silakan coba kembali." };
  }
  await signOutCurrentDevice();
  return { ok: true };
}
