import { z } from "zod";
export const loginSchema = z.object({
  email: z.email("Alamat email tidak valid."),
  password: z.string().min(1, "Masukkan kata sandi.").max(128),
});
export const resetSchema = z.object({
  email: z.email("Alamat email tidak valid."),
});
export const passwordSchema = z.object({
  password: z.string().min(12, "Gunakan minimal 12 karakter.").max(128),
});
export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Masukkan password saat ini.").max(128),
    password: z.string().min(12, "Gunakan minimal 12 karakter.").max(128),
    confirmation: z.string().min(1, "Konfirmasikan password baru.").max(128),
  })
  .strict()
  .refine((v) => v.password === v.confirmation, {
    message: "Konfirmasi password tidak sama.",
    path: ["confirmation"],
  })
  .refine((v) => v.password !== v.currentPassword, {
    message: "Password baru harus berbeda dari password saat ini.",
    path: ["password"],
  });
