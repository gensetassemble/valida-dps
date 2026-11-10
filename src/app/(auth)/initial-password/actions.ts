"use server";
import { createClient } from "@/lib/supabase/server";
import { initialPasswordRequired } from "@/lib/auth/initial-password";
import { changeOwnPasswordSchema } from "@/lib/auth/schemas";
import { signOutCurrentDevice } from "@/lib/auth/logout";
export async function changeInitialPassword(input:unknown) {
 const parsed=changeOwnPasswordSchema.safeParse(input);if(!parsed.success)return {error:parsed.error.issues[0]?.message||"Periksa password baru."};
 const db=await createClient();const {data,error}=await db.auth.getUser();
 if(error||!data.user||!(await initialPasswordRequired(db)))return {error:"Sesi penggantian password awal tidak valid. Masuk kembali."};
 const result=await db.auth.updateUser({password:parsed.data.password,current_password:parsed.data.currentPassword});
 if(result.error)return {error:"Password belum diubah. Periksa password saat ini dan gunakan password baru yang berbeda, minimal 12 karakter."};
 if(await initialPasswordRequired(db))return {error:"Password tersimpan tetapi akses belum terbuka. Hubungi IT."};
 await signOutCurrentDevice();return {ok:true as const};
}
