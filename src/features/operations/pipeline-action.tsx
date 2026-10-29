"use client";
import Link from "next/link";
import { useState, useEffect, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatTimestamp } from "@/lib/format";
import { recordRenewalFollowup, getRenewalHistory } from "./actions";
import { renewalNext as next, outlookCompose } from "@/lib/domain/renewal";
import { usePipelineDrag } from "./pipeline-drag";
const labels: Record<string, string> = {
  uncontacted: "Belum Dihubungi",
  contacted: "Dihubungi",
  offered: "Penawaran Terkirim",
  po_received: "PO Diterima",
  deferred: "Ditunda",
  not_renewed: "Tidak Diperpanjang",
};

const actions: Record<string, string> = {
  uncontacted: "Hubungi PIC",
  contacted: "Catat Penawaran",
  offered: "Konfirmasi PO",
  deferred: "Lanjutkan",
};
type History = {
  id: string;
  created_at: string;
  note: string;
  kind: string;
  stage: string;
  pic_name?: string;
  channel?: string;
  recipient_email?: string | null;
  subject?: string | null;
  details?: Record<string, unknown>;
  document_id?: string | null;
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-xs font-semibold">
      {label}
      {children}
    </label>
  );
}
export function PipelineAction({
  certificate,
  customer,
  number,
  canWrite,
  contacts,
  branch,
  stage,
  documents,
}: {
  certificate: string;
  customer: string;
  number: string;
  canWrite: boolean;
  branch: string;
  stage: string;
  contacts: { id: string; name: string; email: string }[];
  documents: { id: string; kind: string; original_name: string }[];
}) {
  const [mode, setMode] = useState<"log" | "status" | "gate" | null>(null),
    [target, setTarget] = useState(next[stage] || "contacted"),
    [channel, setChannel] = useState("email"),
    [contactId, setContactId] = useState(contacts[0]?.id || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<History[]>([]),
    [ready, setReady] = useState(false);
  const drag = usePipelineDrag();
  useEffect(
    () =>
      drag?.register(certificate, (value) => {
        if (canWrite) {
          setTarget(value);
          setMessage("");
          setMode("gate");
        }
      }),
    [drag, certificate, canWrite],
  );
  const router = useRouter(),
    contact = contacts.find((c) => c.id === contactId),
    isContact = mode === "gate" && target === "contacted",
    needsDocument =
      mode === "gate" && ["offered", "po_received"].includes(target),
    kind = target === "offered" ? "quotation" : "purchase_order";
  async function open(value: "log" | "status" | "gate") {
    setMode(value);
    setMessage("");
    if (value !== "gate") {
      setReady(false);
      try {
        const r = await getRenewalHistory(certificate, branch);
        if (r.error) setMessage(r.error);
        else setHistory(r.rows as History[]);
      } catch {
        setMessage("Riwayat belum dapat dimuat.");
      } finally {
        setReady(true);
      }
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    try {
      let document = String(f.get("document") || "") || null;
      const file = f.get("file");
      if (needsDocument && file instanceof File && file.size) {
        const upload = new FormData();
        upload.set("domain", "client");
        upload.set("id", certificate);
        upload.set("branch", branch);
        upload.set("kind", kind);
        upload.set("file", file);
        const response = await fetch("/api/documents", {
          method: "POST",
          body: upload,
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error || "PDF ditolak.");
          return;
        }
        document = data.id;
      }
      if (needsDocument && !document) {
        setMessage("Pilih atau unggah PDF sesuai tahap.");
        return;
      }
      const details: Record<string, unknown> = {
        pic_name: String(f.get("pic_name") || ""),
        channel,
      };
      if (isContact) details.contact_id = contactId;
      if (channel === "email") {
        details.recipient_email = String(f.get("recipient_email") || "");
        details.subject = String(f.get("subject") || "");
      }
      if (needsDocument) {
        details.document_number = String(f.get("document_number") || "");
        details.document_date = String(f.get("document_date") || "");
      }
      if (mode === "gate") {
        details.confirmed = f.get("confirmed") === "on";
        if (target === "deferred")
          details.follow_up_date = String(f.get("follow_up_date") || "");
        if (target === "not_renewed")
          details.reason = String(f.get("reason") || "");
      }
      const r = await recordRenewalFollowup({
        certificate,
        branch,
        target: mode === "gate" ? target : null,
        note: String(f.get("note") || ""),
        document: needsDocument ? document : null,
        details,
      });
      if (r.error) {
        setMessage(r.error);
        return;
      }
      setMode(null);
      router.refresh();
    } catch {
      setMessage("Catatan belum tersimpan. Silakan periksa kembali.");
    } finally {
      setBusy(false);
    }
  }
  function compose(form: HTMLFormElement) {
    const values = new FormData(form);
    if (!contact?.email) {
      setMessage("Lengkapi email PIC utama terlebih dahulu.");
      return;
    }
    window.open(
      outlookCompose(
        contact.email,
        String(values.get("subject") || ""),
        String(values.get("note") || ""),
      ),
      "_blank",
      "noopener,noreferrer",
    );
  }
  const fieldClass = "h-10 w-full rounded-lg border border-input px-3";
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 flex-1 px-1 text-[10px]"
          onClick={() => void open("log")}
        >
          Log
        </Button>
        {canWrite && next[stage] && (
          <Button
            size="sm"
            className="min-w-0 flex-[2] whitespace-normal px-1 text-[10px]"
            onClick={() => {
              setTarget(next[stage]);
              void open("gate");
            }}
          >
            {actions[stage]}
          </Button>
        )}
      </div>
      <button
        className="block w-full text-left text-[10px] text-muted-foreground underline"
        onClick={() => void open("status")}
      >
        Status · {labels[stage]}
      </button>
      <Modal
        open={!!mode}
        onOpenChange={(v) => {
          if (!v && !busy) setMode(null);
        }}
        title={
          mode === "gate"
            ? "Gerbang Bisnis: Transisi ke " + labels[target]
            : mode === "log"
              ? "Log Komunikasi Klien"
              : "Riwayat Status"
        }
        description={customer + " · " + number}
      >
        {mode !== "gate" && (
          <div
            className="my-3 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-surface-muted p-3 text-xs"
            aria-label="Riwayat tindak lanjut"
          >
            {!ready ? (
              <p>Memuat riwayat…</p>
            ) : history.filter((r) => r.kind === mode).length ? (
              history
                .filter((r) => r.kind === mode)
                .map((r) => (
                  <article key={r.id} className="border-b border-border pb-2">
                    <p className="font-semibold">
                      {formatTimestamp(r.created_at)} ·{" "}
                      {labels[r.stage] || r.stage}
                    </p>
                    {r.pic_name && (
                      <p>
                        {r.pic_name} · {r.channel}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap">{r.note}</p>
                    {r.recipient_email && <p>{r.recipient_email}</p>}
                    {r.subject && <p>Subjek: {r.subject}</p>}
                    {r.details?.document_number ? (
                      <p>
                        Dokumen: {String(r.details.document_number)} ·{" "}
                        {String(r.details.document_date || "")}
                      </p>
                    ) : null}
                    {r.details?.follow_up_date ? (
                      <p>
                        Tindak lanjut berikutnya:{" "}
                        {String(r.details.follow_up_date)}
                      </p>
                    ) : null}
                    {r.details?.reason ? (
                      <p>Alasan: {String(r.details.reason)}</p>
                    ) : null}
                    {r.document_id && (
                      <a
                        className="mt-1 inline-block underline"
                        href={"/api/documents?id=" + r.document_id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Buka PDF bukti
                      </a>
                    )}
                  </article>
                ))
            ) : (
              <p>
                Belum ada{" "}
                {mode === "log" ? "log komunikasi" : "perubahan status"}.
              </p>
            )}
          </div>
        )}
        {mode === "status" && canWrite && next[stage] && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setTarget(next[stage]);
                void open("gate");
              }}
            >
              {actions[stage]}
            </Button>
            {stage !== "deferred" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTarget("deferred");
                  void open("gate");
                }}
              >
                Tunda
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setTarget("not_renewed");
                void open("gate");
              }}
            >
              Tidak diperpanjang
            </Button>
          </div>
        )}
        {mode !== "status" && canWrite && (
          <form className="mt-4 space-y-3" onSubmit={save} key={mode + target}>
            {mode === "gate" && (
              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
                {isContact
                  ? "Pilih PIC utama yang telah diperiksa, lalu catat komunikasi yang sudah dilakukan."
                  : needsDocument
                    ? "Nomor, tanggal, dan bukti PDF wajib sesuai tahap."
                    : target === "deferred"
                      ? "Catat alasan dan tanggal tindak lanjut berikutnya."
                      : "Catat alasan keputusan tidak diperpanjang."}
              </p>
            )}
            {isContact && (
              <Field label="PIC utama klien">
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  required
                  className={fieldClass}
                >
                  <option value="">Pilih PIC utama</option>
                  {contacts.map((v) => (
                    <option value={v.id} key={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                {!contacts.length && (
                  <Link
                    className="block underline"
                    href={
                      "/sertifikat-klien/" + certificate + "?branch=" + branch
                    }
                  >
                    Lengkapi PIC utama pada pelanggan
                  </Link>
                )}
              </Field>
            )}
            <Field label="Nama PIC">
              <Input
                name="pic_name"
                required
                minLength={2}
                maxLength={200}
                key={isContact ? contactId : "manual"}
                defaultValue={contact?.name || ""}
                readOnly={isContact}
              />
            </Field>
            <Field label="Saluran komunikasi">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className={fieldClass}
              >
                <option value="email">Email</option>
                <option value="phone">Telepon</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="meeting">Pertemuan</option>
              </select>
            </Field>
            {channel === "email" && (
              <>
                <Field label="Alamat email PIC penerima">
                  <Input
                    name="recipient_email"
                    type="email"
                    required
                    maxLength={254}
                    key={contactId}
                    defaultValue={contact?.email || ""}
                    readOnly={isContact}
                  />
                </Field>
                <Field label="Subjek pesan">
                  <Input
                    name="subject"
                    defaultValue={
                      isContact
                        ? `[PT SUCOFINDO] Penawaran Perpanjangan - ${customer} - ${number}`
                        : ""
                    }
                    required={isContact}
                    minLength={isContact ? 3 : undefined}
                    maxLength={200}
                  />
                </Field>
              </>
            )}
            {needsDocument && (
              <>
                <Field
                  label={target === "offered" ? "Nomor penawaran" : "Nomor PO"}
                >
                  <Input
                    name="document_number"
                    required
                    minLength={2}
                    maxLength={200}
                  />
                </Field>
                <Field label="Tanggal dokumen">
                  <Input name="document_date" type="date" required />
                </Field>
                <Field label="Pilih bukti PDF privat">
                  <select name="document" className={fieldClass}>
                    <option value="">Pilih PDF atau unggah di bawah</option>
                    {documents
                      .filter((d) => d.kind === kind)
                      .map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.original_name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Unggah PDF (maksimum 10 MiB)">
                  <Input name="file" type="file" accept="application/pdf" />
                </Field>
              </>
            )}
            {mode === "gate" && target === "deferred" && (
              <Field label="Tanggal tindak lanjut berikutnya">
                <Input name="follow_up_date" type="date" required />
              </Field>
            )}
            {mode === "gate" && target === "not_renewed" && (
              <Field label="Alasan tidak diperpanjang">
                <textarea
                  name="reason"
                  required
                  minLength={8}
                  maxLength={2000}
                  className="min-h-20 w-full rounded-lg border border-input p-3"
                />
              </Field>
            )}
            <Field
              label={
                mode === "log"
                  ? "Hasil komunikasi"
                  : "Ringkasan tindak lanjut / alasan"
              }
            >
              <textarea
                name="note"
                defaultValue={
                  isContact
                    ? `Yth. ${contact?.name || "PIC"},\n\nKami bermaksud menindaklanjuti perpanjangan sertifikat ${number} untuk ${customer}. Mohon konfirmasi kebutuhan dan jadwal inspeksi ulang.\n\nRuang lingkup: [lengkapi]\nPenawaran: [lengkapi nilai dan lampirkan PDF penawaran resmi]\n\nTerima kasih,\nPT SUCOFINDO Cabang Denpasar`
                    : ""
                }
                key={isContact ? contactId : "note"}
                required
                minLength={8}
                maxLength={2000}
                className="min-h-24 w-full rounded-lg border border-input p-3"
              />
            </Field>
            {isContact && channel === "email" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!contact?.email}
                  onClick={(e) => compose(e.currentTarget.form!)}
                >
                  Buka draft di Outlook
                </Button>
                <p>
                  Draft terbuka di Microsoft 365. Periksa isi, lampirkan
                  penawaran resmi bila ada, lalu kirim melalui Outlook. Setelah
                  terkirim, konfirmasikan komunikasi di bawah. Membuka draft
                  belum memindahkan kartu.
                </p>
              </div>
            )}
            {mode === "gate" && (
              <label className="flex gap-2 text-xs">
                <input type="checkbox" name="confirmed" required />
                Saya memastikan aktivitas ini sudah dilakukan dan bukti sesuai.
              </label>
            )}
            <p className="text-[11px] text-muted-foreground">
              Pencatatan ini tidak mengirim email.{" "}
              {target === "po_received" && mode === "gate"
                ? "PO diterima belum memperpanjang masa berlaku sertifikat."
                : ""}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setMode(null)}
              >
                Batal
              </Button>
              <Button disabled={busy}>
                {busy
                  ? "Menyimpan…"
                  : mode === "log"
                    ? "Simpan Log"
                    : "Validasi & Pindahkan Kartu"}
              </Button>
            </div>
          </form>
        )}
        {message && (
          <p role="status" className="mt-3 text-xs text-amber-900">
            {message}
          </p>
        )}
      </Modal>
    </div>
  );
}
