import { NextResponse } from "next/server";
export async function GET() {
  // Reject unsolicited codes. Never exchange or log a token before state, PKCE and user binding exist.
  return NextResponse.json({ ok: false, code: "OAUTH_DISABLED", message: "Callback Microsoft menunggu persetujuan dan implementasi penyimpanan token." }, { status: 503, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
