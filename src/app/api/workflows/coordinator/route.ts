import { NextRequest, NextResponse } from "next/server";
import { entityContext, masterClient } from "@/features/master-data/server";
import { z } from "zod";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const c = await entityContext("kalibrasi-alat", p.get("branch") || undefined);
  if (!z.uuid().safeParse(p.get("portfolio")).success)
    return NextResponse.json({ coordinator: null });
  const db = await masterClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data, error } = await db
    .from("portfolio_coordinators")
    .select(
      "id,employee_id,coordinator:operational_coordinators(full_name,is_active)",
    )
    .eq("branch_code", c.branch)
    .eq("portfolio_id", p.get("portfolio")!)
    .eq("is_active", true)
    .lte("effective_from", today)
    .or("effective_until.is.null,effective_until.gte." + today)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Penetapan koordinator belum dapat dimuat." },
      { status: 503 },
    );
  const contact = data?.coordinator as unknown as {
    full_name: string;
    is_active: boolean;
  } | null;
  return NextResponse.json(
    {
      coordinator: contact?.is_active
        ? {
            id: data!.id,
            employee_id: data!.employee_id,
            name: contact.full_name,
          }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
