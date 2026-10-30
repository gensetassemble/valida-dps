import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { entityContext, masterClient } from "@/features/master-data/server";
import {
  validateCertificate,
  CERTIFICATE_BUCKET,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/supabase/storage";
import { requireActiveUser } from "@/lib/auth/guards";
import { boundedForm } from "@/lib/http/bounded-form";
import { isSameOrigin } from "@/lib/http/same-origin";
const entities: Record<string, string> = {
  client: "sertifikat-klien",
  personnel: "kompetensi-personil",
  calibration: "riwayat-kalibrasi",
};
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Origin ditolak." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
    return NextResponse.json(
      { error: "Berkas terlalu besar." },
      { status: 413 },
    );
  try {
    await requireActiveUser();
    const f = await boundedForm(request, 11 * 1024 * 1024);
    const p = z
      .object({
        domain: z.enum(["client", "personnel", "calibration"]),
        id: z.uuid(),
        branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
        kind: z.enum(["certificate", "quotation", "purchase_order"]),
      })
      .parse(
        Object.fromEntries(
          ["domain", "id", "branch", "kind"].map((k) => [k, f.get(k)]),
        ),
      );
    const c = await entityContext(entities[p.domain], p.branch, true);
    const file = f.get("file");
    if (!(file instanceof File)) throw Error();
    const bytes = Buffer.from(await file.arrayBuffer());
    validateCertificate(file, bytes.subarray(0, 8));
    const db = await masterClient();
    const id = randomUUID(),
      path = c.branch + "/" + p.domain + "/" + p.id + "/" + id + ".pdf";
    const { error: meta } = await db.from("operational_documents").insert({
      id,
      branch_code: c.branch,
      domain: p.domain,
      record_id: p.id,
      kind: p.kind,
      object_path: path,
      original_name: file.name
        .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
        .slice(0, 180),
      file_bytes: file.size,
      created_by: c.user.id,
    });
    if (meta) throw Error();
    const { error } = await db.storage
      .from(CERTIFICATE_BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (error) throw Error();
    return NextResponse.json(
      { ok: true, id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Dokumen ditolak atau belum tersimpan. Periksa kewenangan, ukuran dan format PDF.",
      },
      { status: 400 },
    );
  }
}
export async function GET(request: NextRequest) {
  await requireActiveUser();
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
  if (!id.success) return new NextResponse(null, { status: 400 });
  const db = await masterClient();
  const { data } = await db
    .from("operational_documents")
    .select("object_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const { data: link, error } = await db.storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(String(data.object_path), SIGNED_URL_TTL_SECONDS);
  if (error || !link)
    return NextResponse.json(
      { error: "Dokumen belum tersedia." },
      { status: 404 },
    );
  return NextResponse.redirect(link.signedUrl, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
