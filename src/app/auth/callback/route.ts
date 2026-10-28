import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/env/server";
export async function GET(request: NextRequest) {
  const base = getAppConfig().APP_URL;
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/update-password", base));
  }
  return NextResponse.redirect(new URL("/login?status=callback-error", base));
}
