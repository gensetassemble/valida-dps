// Read-only probes. No account creation, OAuth, uploads or email delivery.
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key?.startsWith("sb_publishable_")) {
  console.error("Konfigurasi Supabase belum lengkap.");
  process.exit(1);
}
const headers = { apikey: key };
for (const [label, path, expected] of [
  [
    "PostgreSQL REST menolak akses anonim",
    "/rest/v1/profiles?select=id",
    [401, 403],
  ],
  [
    "Bucket privat menolak metadata anonim",
    "/storage/v1/bucket/certificate-documents",
    [400, 401, 403, 404],
  ],
]) {
  const response = await fetch(new URL(path, base), {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const passed = expected.includes(response.status);
  console.log(
    JSON.stringify({ check: label, passed, status: response.status }),
  );
  if (!passed) process.exitCode = 1;
}
const response = await fetch(new URL("/auth/v1/settings", base), {
  headers,
  signal: AbortSignal.timeout(15000),
});
if (!response.ok) {
  console.error("Pengaturan Auth tidak dapat diverifikasi.");
  process.exitCode = 1;
} else {
  const settings = await response.json();
  console.log(
    JSON.stringify({
      check: "Supabase Auth",
      reachable: true,
      publicSignupDisabled: settings.disable_signup === true,
      emailPasswordEnabled: settings.external?.email === true,
    }),
  );
  if (settings.disable_signup !== true) {
    console.log(
      "TINDAKAN: nonaktifkan Allow new users to sign up pada proyek pengembangan sebelum provisioning akun.",
    );
    process.exitCode = 1;
  }
}
