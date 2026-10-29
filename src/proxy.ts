import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/env/public";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const config = getSupabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sertifikat-klien/:path*",
    "/kompetensi-personil/:path*",
    "/kalibrasi-alat/:path*",
    "/peristiwa-kalibrasi/:path*",
    "/pipeline-perpanjangan/:path*",
    "/impor-data/:path*",
    "/api/imports/:path*",
    "/api/operations/:path*",
    "/api/documents",
    "/api/competency-check",
    "/master-data/:path*",
    "/pelanggan/:path*",
    "/pengaturan/:path*",
    "/profil",
    "/audit",
    "/login",
    "/reset-password",
    "/update-password",
    "/auth/:path*",
    "/api/microsoft/:path*",
    "/api/master-data/:path*",
  ],
};
