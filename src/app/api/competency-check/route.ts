import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkCompetency } from "@/features/operations/competency";
export async function GET(request: NextRequest) {
  const p = z
    .object({
      employee: z.uuid(),
      service: z.uuid(),
      branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
    })
    .safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!p.success) return new NextResponse(null, { status: 400 });
  try {
    return NextResponse.json(
      await checkCompetency(p.data.employee, p.data.service, p.data.branch),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Pemeriksaan ditolak atau belum tersedia." },
      { status: 403 },
    );
  }
}
