import { NextResponse, type NextRequest } from "next/server";
import { entityContext, masterClient } from "@/features/master-data/server";
import { getEntity } from "@/features/master-data/registry";
import { safeSearch } from "@/features/master-data/validation";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const context = await entityContext(
    params.get("entity") || "",
    params.get("branch") || undefined,
  );
  const field = context.entity.fields.find(
    (field) => field.key === params.get("field") && field.kind === "lookup",
  );
  const target = field?.lookup && getEntity(field.lookup);
  if (!target)
    return NextResponse.json(
      { error: "Pilihan tidak tersedia." },
      { status: 400 },
    );
  const db = await masterClient();
  let query = db
    .from(target.readTable || target.table)
    .select(
      `${target.idKey},${target.labelKey}${target.key === "roles" ? ",code" : ""}${target.key === "pegawai" ? ",npp" : ""}${target.key === "kalibrasi-alat" ? ",eligibility_status" : ""}`,
    );
  if (target.key !== "roles")
    query = query.eq(
      target.key === "cabang" ? "code" : "branch_code",
      context.branch,
    );
  const search = safeSearch(params.get("q") || "");
  if (search) query = query.ilike(target.labelKey, `%${search}%`);
  if (params.get("id")) query = query.eq(target.idKey, params.get("id")!);
  // Retain existing historical references, but do not offer explicitly inactive
  // employees for a new operational assignment or certificate.
  if (target.key === "pegawai" && !params.get("id") && ["penugasan", "kalibrasi-alat", "kompetensi-personil"].includes(context.entity.key))
    query = query.neq("employment_status", "inactive");
  if (target.key === "roles") query = query.eq("is_active", true);
  if (
    ["kalibrasi-alat", "kompetensi-personil", "riwayat-kalibrasi"].includes(
      context.entity.key,
    )
  ) {
    if (target.key === "pegawai")
      query = query.not("full_name", "ilike", "%[CONTOH]%");
    if (target.key === "portofolio")
      query = query.not("code", "like", "CONTOH_%");
  }
  if (context.entity.key === "persyaratan" && target.key === "jenis-sertifikat")
    query = query.eq("category", "personnel");
  if (
    target.key === "jenis-sertifikat" &&
    ["sertifikat-klien", "kompetensi-personil"].includes(context.entity.key)
  )
    query = query.eq(
      "category",
      context.entity.key === "sertifikat-klien" ? "client" : "personnel",
    );
  const { data, error } = await query.order(target.labelKey).limit(20);
  if (error)
    return NextResponse.json(
      { error: "Pilihan belum dapat dimuat." },
      { status: 400 },
    );
  const rows = (data || []) as unknown as Record<string, unknown>[];
  return NextResponse.json(
    {
      options: rows.map((row) => ({
        value: String(row[target.idKey]),
        label:
          String(row[target.labelKey] || row[target.idKey]) +
          (target.key === "pegawai"
            ? row.npp
              ? " · NPP " + String(row.npp)
              : " · Non-NPP"
            : target.key === "kalibrasi-alat"
              ? " · " + String(row.eligibility_status || "Belum Ada Kalibrasi")
              : ""),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
