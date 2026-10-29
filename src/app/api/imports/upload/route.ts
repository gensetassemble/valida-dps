import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseSource } from "@/features/imports/parser";
import { DOMAINS } from "@/features/imports/normalize";
import { importContext } from "@/features/imports/server";
import { requireActiveUser } from "@/lib/auth/guards";
import { boundedForm } from "@/lib/http/bounded-form";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > 6 * 1024 * 1024)
    return NextResponse.json(
      { error: "Maksimum berkas 5 MiB." },
      { status: 413 },
    );
  try {
    await requireActiveUser();
    const form = await boundedForm(request, 6 * 1024 * 1024);
    const domain = z.enum(DOMAINS).parse(form.get("domain"));
    const c = await importContext(String(form.get("branch") || ""));
    const file = form.get("file");
    if (!(file instanceof File)) throw Error("Pilih berkas.");
    const mapping = z
      .record(z.string().max(100), z.string().max(100))
      .parse(JSON.parse(String(form.get("mapping") || "{}")));
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseSource(
      file.name,
      bytes,
      domain,
      String(form.get("sheet") || "") || undefined,
      mapping,
    );
    if (form.get("preview") === "true")
      return NextResponse.json(
        {
          rows: parsed.rows.length,
          headers: Object.keys(parsed.rows[0].raw),
          sheets: parsed.sheets,
          hash: parsed.hash,
          ready: parsed.rows.filter((r) => r.status === "ready").length,
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const name = file.name.replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 180);
    const { data, error } = await c.db.rpc("stage_import", {
      b: c.branch,
      d: domain,
      f: name,
      h: parsed.hash,
      sz: bytes.length,
      items: parsed.rows,
      note:
        "Unggah melalui aplikasi; pemetaan kolom " +
        JSON.stringify(mapping) +
        ". SIAP_TINJAU bukan persetujuan dokumen.",
    });
    if (error || !data) throw Error("Staging belum dapat disimpan.");
    const path =
      c.branch +
      "/" +
      String(data) +
      "/source" +
      (name.toLowerCase().endsWith(".xlsx") ? ".xlsx" : ".csv");
    const { error: upload } = await c.db.storage
      .from("import-sources")
      .upload(path, bytes, {
        contentType: name.endsWith(".xlsx")
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv",
        upsert: false,
      });
    if (
      upload &&
      !String(upload.message).toLowerCase().includes("already exists") &&
      !String(upload.message).toLowerCase().includes("duplicate")
    )
      return NextResponse.json(
        {
          batch: data,
          warning:
            "Baris staging tersimpan, tetapi salinan berkas privat belum terunggah. Simpan sumber asli dan ulangi unggah untuk melengkapi.",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    return NextResponse.json(
      { batch: data, count: parsed.rows.length },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const known = error instanceof Error ? error.message : "";
    return NextResponse.json(
      {
        error:
          /^[A-Za-zÀ-ž0-9 .,–—()/:;-]{1,180}$/.test(known) &&
          !known.includes("SQL")
            ? known
            : "Berkas/pemetaan ditolak. Periksa format, ukuran, sheet dan kewenangan.",
      },
      { status: 400 },
    );
  }
}
