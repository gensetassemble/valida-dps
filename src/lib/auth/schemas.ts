import { z } from "zod";
export const loginSchema = z.object({ email: z.email("Alamat email tidak valid."), password: z.string().min(1, "Masukkan kata sandi.").max(128) });
export const resetSchema = z.object({ email: z.email("Alamat email tidak valid.") });
export const passwordSchema = z.object({ password: z.string().min(12, "Gunakan minimal 12 karakter.").max(128) });
