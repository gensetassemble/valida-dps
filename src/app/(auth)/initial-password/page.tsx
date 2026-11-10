import {connection} from "next/server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {initialPasswordRequired} from "@/lib/auth/initial-password";
import {ChangePasswordForm} from "@/components/shared/change-password-form";
export default async function InitialPasswordPage(){
 await connection();
 const db=await createClient();const {data,error}=await db.auth.getUser();if(error||!data.user)redirect("/login");
 if(!(await initialPasswordRequired(db)))redirect("/dashboard");
 return <><h1 className="text-2xl font-bold">Ganti password awal</h1><p className="mt-3 text-sm text-muted-foreground">Akun Anda disiapkan Admin. Buat password pribadi sebelum membuka data VALIDA. Setelah tersimpan, masuk kembali dengan password baru.</p><ChangePasswordForm initial/></>;
}
