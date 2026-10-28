import { AuthForm } from "@/components/shared/auth-form";
import { getSupabaseConfig } from "@/lib/env/public";
export default function ResetPage() { return <><h1 className="text-2xl font-bold">Pulihkan kata sandi</h1><p className="mt-2 text-sm text-muted-foreground">Masukkan alamat email akun Anda.</p><AuthForm mode="reset" configured={!!getSupabaseConfig()}/></>; }
