import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth/guards";
import { masterClient } from "@/features/master-data/server";
import { boundedForm } from "@/lib/http/bounded-form";
import { validateCertificate } from "@/lib/supabase/storage";
import { isSameOrigin } from "@/lib/http/same-origin";
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json({ error: "Origin ditolak." }, { status: 403 });
  try {
    await requireActiveUser();
    const f = await boundedForm(request, 11 * 1024 * 1024);
    const rid = z.uuid().parse(f.get("request")),
      branch = z
        .string()
        .regex(/^[A-Z0-9]{2,8}$/)
        .parse(f.get("branch"));
    const file = f.get("file");
    if (!(file instanceof File)) throw Error();
    const bytes = Buffer.from(await file.arrayBuffer());
    validateCertificate(file, bytes.subarray(0, 8));
    const db = await masterClient();
    const id = randomUUID(),
      path = branch + "/" + rid + "/" + id + ".pdf";
    const { error: meta } = await db.from("workflow_documents").insert({
      id,
      branch_code: branch,
      request_id: rid,
      object_path: path,
      original_name: file.name
        .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
        .slice(0, 180),
      file_bytes: file.size,
    });
    if (meta) throw Error();
    const { error } = await db.storage
      .from("workflow-documents")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (error) throw Error();
    return NextResponse.json(
      { id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "PDF ditolak atau belum tersimpan. Periksa kewenangan, ukuran maksimal 10 MiB dan format PDF.",
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
    .from("workflow_documents")
    .select("object_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!data) return new NextResponse(null, { status: 404 });
  const { data: link, error } = await db.storage
    .from("workflow-documents")
    .createSignedUrl(data.object_path, 60);
  if (error || !link) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(link.signedUrl, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
