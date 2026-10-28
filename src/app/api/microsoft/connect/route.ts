import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/guards";
export async function POST() {
  await requireActiveUser();
  return NextResponse.json({ ok: false, code: "AUTHORIZATION_PENDING", message: "Otorisasi mailbox belum diaktifkan." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
