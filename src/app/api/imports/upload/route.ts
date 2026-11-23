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
        "File diunggah melalui aplikasi; kecocokan kolom " +
        JSON.stringify(mapping) +
        ". Hasil pemeriksaan belum menerapkan perubahan.",
    });
    if (error || !data) throw Error("Hasil pembacaan file belum dapat disiapkan.");
    const extension = name.toLowerCase().match(/\.(csv|xlsx|xlsb|xls)$/)?.[0];
    if (!extension) throw Error("Gunakan CSV UTF-8, XLSX, XLS, atau XLSB.");
    const path =
      c.branch +
      "/" +
      String(data) +
      "/source" + extension;
    const contentTypes: Record<string, string> = {
      ".csv": "text/csv; charset=utf-8",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".xlsb": "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
    };
    const { error: upload } = await c.db.storage
      .from("import-sources")
      .upload(path, bytes, {
        contentType: contentTypes[extension],
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
            "Hasil pemeriksaan sudah disiapkan, tetapi salinan file belum tersimpan. Simpan file asli lalu ulangi unggahan.",
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
            : "File belum dapat diproses. Periksa format, ukuran, nama lembar, dan kewenangan akun.",
      },
      { status: 400 },
    );
  }
}
