import { NextRequest, NextResponse } from "next/server";
import { signOutCurrentDevice } from "@/lib/auth/logout";
import { isSameOrigin } from "@/lib/http/same-origin";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request, true)) {
    return new NextResponse("Permintaan tidak diizinkan.", { status: 403 });
  }
  await signOutCurrentDevice();
  // Native POST + 303 starts a fresh document, clearing the protected router/modal tree.
  return NextResponse.redirect(
    new URL("/login", request.headers.get("origin") || request.url),
    {
      status: 303,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
