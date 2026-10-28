"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Eye, EyeOff } from "lucide-react";
import { loginSchema } from "@/lib/auth/schemas";
import { login, resetPassword, updatePassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "reset" | "update";
  configured: boolean;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ error?: string; message?: string }>(
    {},
  );
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string; password: string }>({
    resolver: mode === "login" ? zodResolver(loginSchema) : undefined,
  });
  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setNotice({});
        try {
          const result = await (mode === "login"
            ? login(values)
            : mode === "reset"
              ? resetPassword({ email: values.email })
              : updatePassword({ password: values.password }));
          setNotice(result ?? {});
          router.refresh();
        } catch (error) {
          if (error instanceof Error && error.message === "NEXT_REDIRECT")
            throw error;
          setNotice({
            error: "Layanan belum dapat dihubungi. Silakan coba kembali.",
          });
        }
      })}
    >
      {mode !== "update" && (
        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-700">{errors.email.message}</p>
          )}
        </div>
      )}
      {mode !== "reset" && (
        <div>
          <label
            className="mb-2 block text-xs font-semibold"
            htmlFor="password"
          >
            {mode === "update" ? "Kata sandi baru" : "Kata sandi"}
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              className="pr-12"
              autoComplete={
                mode === "update" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "update" ? 12 : 1}
              maxLength={128}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={
                showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
              }
              className="absolute right-3 top-3 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-700">
              {errors.password.message}
            </p>
          )}
        </div>
      )}
      {!configured && (
        <p
          role="status"
          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          Layanan autentikasi belum dikonfigurasi.
        </p>
      )}
      {notice.error && (
        <p role="alert" className="text-sm text-red-700">
          {notice.error}
        </p>
      )}
      {notice.message && (
        <p role="status" className="text-sm text-emerald-800">
          {notice.message}
        </p>
      )}
      <Button
        className="w-full"
        disabled={!configured || isSubmitting}
        type="submit"
      >
        {isSubmitting && <LoaderCircle className="animate-spin" />}
        {mode === "login"
          ? "Masuk"
          : mode === "reset"
            ? "Kirim petunjuk pemulihan"
            : "Simpan kata sandi"}
      </Button>
      <p className="text-center text-sm">
        <Link
          className="underline underline-offset-4"
          href={mode === "login" ? "/reset-password" : "/login"}
        >
          {mode === "login" ? "Lupa kata sandi?" : "Kembali ke halaman masuk"}
        </Link>
      </p>
    </form>
  );
}
