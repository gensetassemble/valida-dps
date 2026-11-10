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
export async function DELETE(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Origin ditolak." }, { status: 403, headers });
  const parsed = z.object({
    id: z.uuid(),
    record: z.uuid(),
    domain: z.enum(["client", "personnel", "calibration"]),
    branch: z.string().regex(/^[A-Z0-9]{2,8}$/),
  }).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success)
    return NextResponse.json({ error: "Identitas lampiran tidak valid." }, { status: 400, headers });
  const p = parsed.data;
  // Keep Next.js authentication/MFA redirects outside the mutation catch.
  await requireActiveUser();
  try {
    await entityContext(entities[p.domain], p.branch, true);
  } catch {
    return NextResponse.json({ error: "Anda tidak berwenang menghapus lampiran ini." }, { status: 403, headers });
  }
  try {
    const db = await masterClient();
    const { data, error } = await db.rpc("remove_operational_document", {
      doc: p.id, b: p.branch, d: p.domain, r: p.record,
    });
    if (error) {
      const status = error.code === "23503" ? 409 : error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
      return NextResponse.json({ error: status === 409
        ? "Dokumen sudah digunakan sebagai bukti proses. Lampiran tersebut tidak dapat dihapus."
        : status === 403 ? "Anda tidak berwenang menghapus lampiran ini."
        : status === 404 ? "Lampiran sudah tidak tersedia. Gunakan Refresh untuk memperbarui daftar."
        : "Lampiran belum dapat dihapus. Silakan coba kembali." }, { status, headers });
    }
    const removed = z.object({ id: z.uuid(), object_path: z.string().min(1), cleanup_pending: z.boolean() }).parse(data);
    if (removed.id !== p.id) throw Error("Invalid removal result");
    let cleanupPending = removed.cleanup_pending;
    if (cleanupPending) {
      try {
        const cleanup = await db.storage.from(CERTIFICATE_BUCKET).remove([removed.object_path]);
        if (!cleanup.error) {
          const finished = await db.rpc("finish_document_cleanup", { doc: p.id });
          cleanupPending = !!finished.error;
        }
      } catch { cleanupPending = true; }
    }
    return NextResponse.json({ ok: true, cleanupPending,
      message: cleanupPending ? "Lampiran dilepas dari rekaman. Pembersihan berkas belum selesai; coba Hapus lagi."
        : "Lampiran berhasil dihapus. Riwayat tindakan tersimpan di audit." }, { headers });
  } catch {
    return NextResponse.json({ error: "Hasil penghapusan belum dapat dipastikan. Gunakan Refresh sebelum mencoba lagi." }, { status: 400, headers });
  }
}
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
    if (p.domain !== "client" && p.kind !== "certificate") throw Error();
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
  if (request.nextUrl.searchParams.get("preview") === "1") {
    const { data: pdf, error } = await db.storage.from(CERTIFICATE_BUCKET).download(String(data.object_path));
    if (error || !pdf) return new NextResponse(null, { status: 404 });
    return new NextResponse(await pdf.arrayBuffer(), { headers: {
      "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline; filename=certificate.pdf",
    } });
  }
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
