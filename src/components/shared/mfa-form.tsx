"use client";
import { useState } from "react";
import { startMfaEnrollment, verifyMfaCode } from "@/app/(auth)/mfa/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MfaForm({ factors }: { factors: { id: string; name: string }[] }) {
  const [factorId, setFactorId] = useState(factors[0]?.id || "");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="mt-5 space-y-4">
    {!factors.length && !qr && <>
      <p className="text-sm leading-6">Daftarkan akun ke aplikasi authenticator milik Anda. Simpan cadangan authenticator di tempat aman; jangan bagikan QR atau kode kepada orang lain.</p>
      <Button disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try {
          const result = await startMfaEnrollment();
          if (result.error) setError(result.error);
          else if (result.id && result.qr) { setFactorId(result.id); setQr(result.qr); }
        } catch { setError("Pendaftaran belum tersedia. Coba kembali."); }
        finally { setBusy(false); }
      }}>Siapkan authenticator</Button>
    </>}
    {qr && <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm">Pindai QR ini dengan authenticator Anda, lalu masukkan kode enam angka.</p>
      {/* Auth-generated QR must stay inside this user's current session. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR pendaftaran authenticator pribadi" width={220} height={220} className="mx-auto" />
    </div>}
    {(factors.length > 0 || qr) && <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      try {
        const result = await verifyMfaCode({ factorId, code });
        if (result.error) setError(result.error);
        else if (result.ok) window.location.assign("/dashboard");
      } catch { setError("Verifikasi belum tersedia. Coba kembali."); }
      finally { setBusy(false); }
    }}>
      {factors.length > 1 && <label className="block text-sm">Authenticator
        <select value={factorId} onChange={e => setFactorId(e.target.value)} className="mt-2 w-full rounded border p-2">{factors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </label>}
      <label className="block text-sm font-semibold" htmlFor="mfa-code">Kode authenticator</label>
      <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required />
      <Button type="submit" disabled={busy}>{busy ? "Memverifikasi…" : "Verifikasi & lanjutkan"}</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p className="text-xs leading-5 text-muted-foreground">Perangkat hilang? Hubungi administrator organisasi melalui saluran resmi. Password saja tidak menghapus faktor keamanan.</p>
    <form action="/auth/logout" method="post"><Button variant="outline" type="submit">Kembali ke login</Button></form>
  </div>;
}
