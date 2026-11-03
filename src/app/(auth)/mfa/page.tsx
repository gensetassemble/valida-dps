import { redirect } from "next/navigation";
import { mfaContext } from "@/lib/auth/mfa-context";
import { hasSecondFactor } from "@/lib/auth/security";
import { MfaForm } from "@/components/shared/mfa-form";

export default async function MfaPage() {
  const db = await mfaContext().catch(() => null);
  if (!db) redirect("/login");
  if (await hasSecondFactor(db)) redirect("/dashboard");
  const result = await db.auth.mfa.listFactors();
  if (result.error) throw Error("Authenticator belum dapat dimuat.");
  const factors = result.data.totp.filter(f => f.status === "verified").map(f => ({ id: f.id, name: f.friendly_name || "Authenticator" }));
  return <><h1 className="text-2xl font-bold">Verifikasi keamanan</h1>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Akses administrator memerlukan verifikasi tambahan dari authenticator.</p>
    <MfaForm factors={factors} /></>;
}
