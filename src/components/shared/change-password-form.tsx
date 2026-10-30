"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { changeOwnPasswordSchema } from "@/lib/auth/schemas";
import { changeOwnPassword } from "@/app/(dashboard)/profil/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";

type Values = {
  currentPassword: string;
  password: string;
  confirmation: string;
};
const fields = [
  ["currentPassword", "Password saat ini", "current-password"],
  ["password", "Password baru", "new-password"],
  ["confirmation", "Konfirmasi password baru", "new-password"],
] as const;
export function ChangePasswordForm() {
  const [visible, setVisible] = useState(false),
    [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(changeOwnPasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmation: "" },
  });
  return (
    <form
      className="mt-5 max-w-lg space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError("");
        try {
          const result = await changeOwnPassword(values);
          if (result.ok) {
            reset();
            window.location.replace("/login?status=password-updated");
          } else setError(result.error || "Password belum dapat diubah.");
        } catch (error) {
          if (error instanceof Error && error.message === "NEXT_REDIRECT")
            throw error;
          setError(
            "Layanan belum dapat dihubungi. Muat ulang halaman dan coba kembali.",
          );
        }
      })}
    >
      {fields.map(([key, label, autocomplete]) => (
        <FormField
          key={key}
          id={key}
          label={label}
          required
          error={errors[key]?.message}
          hint={
            key === "password"
              ? "Minimal 12 karakter. Gunakan password yang berbeda dari sebelumnya."
              : undefined
          }
        >
          <Input
            id={key}
            {...register(key)}
            type={visible ? "text" : "password"}
            autoComplete={autocomplete}
            minLength={key === "currentPassword" ? 1 : 12}
            maxLength={128}
            required
            disabled={isSubmitting}
            aria-invalid={!!errors[key]}
            aria-describedby={
              errors[key]
                ? `${key}-error`
                : key === "password"
                  ? `${key}-hint`
                  : undefined
            }
          />
        </FormField>
      ))}
      <button
        type="button"
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
        {visible ? "Sembunyikan password" : "Tampilkan password"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
        {isSubmitting ? "Menyimpan…" : "Ganti password"}
      </Button>
    </form>
  );
}
