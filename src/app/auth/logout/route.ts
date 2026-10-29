import { NextRequest, NextResponse } from "next/server";
import { signOutCurrentDevice } from "@/lib/auth/logout";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin)
  ) {
    return new NextResponse("Permintaan tidak diizinkan.", { status: 403 });
  }
  await signOutCurrentDevice();
  // Native POST + 303 starts a fresh document, clearing the protected router/modal tree.
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
    headers: { "Cache-Control": "private, no-store" },
  });
}
