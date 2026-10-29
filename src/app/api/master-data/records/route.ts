import { NextRequest, NextResponse } from "next/server";
import {
  entityContext,
  listRecords,
  type QueryParams,
} from "@/features/master-data/server";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  try {
    const c = await entityContext(
      p.get("entity") || "",
      p.get("branch") || undefined,
    );
    const parentField = p.get("parent_field"),
      parentId = p.get("parent_id");
    // Restrict relation names to the same registry used by server-rendered tables.
    const parent =
      parentField &&
      parentId &&
      /^[0-9a-f-]{36}$/i.test(parentId) &&
      c.entity.fields.some((f) => f.key === parentField && f.kind === "lookup")
        ? { field: parentField, id: parentId }
        : undefined;
    if ((parentField || parentId) && !parent)
      return NextResponse.json(
        { error: "Relasi tidak valid." },
        { status: 400 },
      );
    const data = await listRecords(
      c.entity,
      c.branch,
      Object.fromEntries(p) as QueryParams,
      parent,
      40,
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Data berikutnya belum dapat dimuat. Silakan coba lagi." },
      { status: 403 },
    );
  }
}
