import { NextResponse, type NextRequest } from "next/server";
import { entityContext, masterClient } from "@/features/master-data/server";
import { getEntity } from "@/features/master-data/registry";
import { safeSearch } from "@/features/master-data/validation";
import { personnelText } from "@/lib/personnel-text";
import { SIMULATION_BRANCH } from "@/lib/simulation";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const context = await entityContext(
    params.get("entity") || "",
    params.get("branch") || undefined,
  );
  const field = context.entity.fields.find(
    (field) => field.key === params.get("field") && field.kind === "lookup",
  );
  const target = field?.lookup && getEntity(field.lookup,context.branch);
  // Business ownership still references the authenticated profile. Fake user
  // identities are only valid in the separate simulated role-assignment table.
  if (context.branch === SIMULATION_BRANCH && field?.key === "account_manager_id" && field.lookup === "pengguna") {
    const label = "[LATIHAN] " + context.profile.full_name;
    const matches = !params.get("q") || label.toLowerCase().includes((params.get("q") || "").toLowerCase());
    return NextResponse.json({options: matches ? [{value:context.user.id,label}] : []}, {headers:{"Cache-Control":"private, no-store"}});
  }
  if (!target)
    return NextResponse.json(
      { error: "Pilihan tidak tersedia." },
      { status: 400 },
    );
  const db = await masterClient();
  let query = db
    .from(target.readTable || target.table)
    .select(
      `${target.idKey},${target.labelKey}${target.key === "roles" ? ",code" : ""}${target.key === "pegawai" ? ",npp" : ""}${target.key === "kalibrasi-alat" ? ",tag,eligibility_status" : ""}`,
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
  if (context.entity.key === "sertifikat-klien" && !params.get("id")) {
    if (["pelanggan", "jenis-sertifikat", "portofolio", "wilayah"].includes(target.key)) query = query.eq("is_active",true);
    if (target.key === "pelanggan") query=query.eq("is_example",false);
  }
  if (context.entity.key === "sertifikat-klien" && target.key === "sertifikat-klien")
    query=query.eq("is_example",false);
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
        ...(target.key === "pegawai" ? { full_name: personnelText(row.full_name), npp: row.npp } : {}),
        label:
          (target.key === "pegawai" ? personnelText(row[target.labelKey]) : String(row[target.labelKey] || "Tanpa nama")) +
          (target.key === "pegawai"
            ? row.npp
              ? " · NPP " + String(row.npp)
              : " · Non-NPP"
            : target.key === "kalibrasi-alat"
              ? (row.tag ? " · " + String(row.tag) : "") + " · " + String(row.eligibility_status || "Belum Ada Kalibrasi")
              : ""),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
