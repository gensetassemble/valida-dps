import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthAdminClient } from "@/lib/supabase/auth-admin";
import { publicDatabaseError } from "./server";

export async function saveProfileAccount({
  db,
  branch,
  id,
  details,
  password,
  superAdmin,
}: {
  db: SupabaseClient;
  branch: string;
  id?: string;
  details: Record<string, unknown>;
  password?: string | null;
  superAdmin: boolean;
}): Promise<{ id?: string; error?: string }> {
  if (password && !superAdmin)
    return {
      error: "Hanya Super Admin yang dapat membuat atau mengganti password.",
    };
  const admin = password ? getAuthAdminClient() : null;
  if (password && !admin)
    return {
      error:
        "Pengelolaan password belum dikonfigurasi pada server. Konfigurasi kunci admin Supabase terlebih dahulu.",
    };
  let created: string | undefined;
  if (password && !id && admin) {
    const result = await admin.auth.admin.createUser({
      email: String(details.email),
      password,
      email_confirm: true,
    });
    if (result.error || !result.data.user)
      return {
        error:
          "Akun login belum dibuat. Jika email sudah terdaftar, kosongkan Password untuk menautkan profilnya.",
      };
    created = result.data.user.id;
  }
  const { data, error } = await db.rpc("save_profile_identity", {
    b: branch,
    profile: id || null,
    details,
  });
  if (error) {
    if (created && admin) {
      const cleanup = await admin.auth.admin.deleteUser(created);
      if (cleanup.error)
        return {
          error:
            "Profil belum tersimpan dan akun login baru belum dapat dibersihkan. Hubungi IT sebelum mencoba email yang sama.",
        };
    }
    return {
      error:
        error.code === "P0001"
          ? "Email belum memiliki akun login atau NPP belum ditemukan dalam direktori cabang. Isi Password bila membuat akun baru."
          : publicDatabaseError(error.code),
    };
  }
  if (password && id && admin) {
    const result = await admin.auth.admin.updateUserById(String(data), {
      password,
    });
    if (result.error)
      return {
        error:
          "Identitas tersimpan, tetapi password belum berhasil diubah. Periksa layanan autentikasi lalu coba lagi.",
      };
  }
  return { id: String(data) };
}
