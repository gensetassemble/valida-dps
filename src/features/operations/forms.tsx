"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RecordForm } from "@/features/master-data/record-form";
import type { EntityConfig } from "@/features/master-data/registry";
import type { DataRow } from "@/features/master-data/server";
import { submitCorrection, transitionRenewal } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
export function OperationalForm(props: {
  entity: EntityConfig;
  branch: string;
  row?: DataRow;
  parent?: { field: string; id: string };
  userId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  return (
    <RecordForm
      {...props}
      onSaved={() => router.push(props.entity.path + "?branch=" + props.branch)}
    />
  );
}
export function CorrectionForm({ id, branch }: { id: string; branch: string }) {
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const r = await submitCorrection(
            id,
            branch,
            String(f.get("message")),
          );
          setState(
            r.error || "Usulan koreksi tercatat. Rekaman resmi tidak berubah.",
          );
        } catch {
          setState("Koreksi belum dapat dikirim.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-xs font-semibold">
        Usulan koreksi
        <textarea
          name="message"
          required
          minLength={8}
          maxLength={2000}
          className="mt-2 block w-full rounded-lg border border-input p-3"
        />
      </label>
      <Button disabled={busy} variant="outline">
        Kirim usulan
      </Button>
      <p role="status">{state}</p>
    </form>
  );
}
export function EvidenceForm({
  domain,
  id,
  branch,
}: {
  domain: string;
  id: string;
  branch: string;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    f.set("domain", domain);
    f.set("id", id);
    f.set("branch", branch);
    try {
      const r = await fetch("/api/documents", { method: "POST", body: f });
      const data = await r.json();
      setMessage(
        r.ok
          ? "Dokumen PDF tersimpan privat."
          : data.error || "Dokumen ditolak.",
      );
      if (r.ok) window.location.reload();
    } catch {
      setMessage("Dokumen belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={upload} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs">
        PDF, maksimum 10 MiB
        <Input
          className="mt-1"
          type="file"
          name="file"
          accept="application/pdf"
          required
        />
      </label>
      <label className="text-xs">
        Jenis bukti
        <select
          name="kind"
          className="mt-1 h-10 w-full rounded-lg border border-input px-3"
        >
          <option value="certificate">Sertifikat</option>
          {domain === "client" && (
            <>
              <option value="quotation">Penawaran</option>
              <option value="purchase_order">Purchase Order</option>
            </>
          )}
        </select>
      </label>
      <Button disabled={busy} variant="outline">
        Unggah PDF privat
      </Button>
      <p role="status" className="text-xs">
        {message}
      </p>
    </form>
  );
}
export function PipelineAction({
  certificate,
  branch,
  stage,
  documents,
}: {
  certificate: string;
  branch: string;
  stage: string;
  documents: { id: string; kind: string; original_name: string }[];
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const next: Record<string, string> = {
    uncontacted: "contacted",
    contacted: "offered",
    offered: "po_received",
    deferred: "contacted",
  };
  if (!next[stage]) return null;
  return (
    <div className="mt-3">
      <Button
        size="sm"
        variant="outline"
        className="w-full whitespace-normal px-2 text-[10px]"
        onClick={() => setOpen(true)}
      >
        Catat tindak lanjut
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Tindak lanjut perpanjangan"
        description="Periksa PIC, catatan kontak dan bukti dokumen sebelum mengubah tahap."
      >
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              const r = await transitionRenewal({
                certificate,
                branch,
                stage: f.get("stage"),
                note: f.get("note"),
                document: f.get("document") || null,
              });
              setMessage(r.error || "Tahap telah diperbarui.");
              if (r.ok) {
                setOpen(false);
                router.refresh();
              }
            } catch {
              setMessage("Perubahan belum tersimpan.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-xs">
            Tahap tujuan
            <select
              name="stage"
              className="mt-1 h-9 w-full rounded border border-input"
            >
              <option value={next[stage]}>
                {
                  (
                    {
                      contacted: "Dihubungi",
                      offered: "Penawaran Terkirim",
                      po_received: "PO Diterima",
                    } as Record<string, string>
                  )[next[stage]]
                }
              </option>
              <option value="deferred">Ditunda</option>
              <option value="not_renewed">Tidak Diperpanjang</option>
            </select>
          </label>
          <label className="block text-xs">
            Catatan kontak / alasan
            <textarea
              name="note"
              minLength={8}
              maxLength={2000}
              required
              className="mt-1 w-full rounded border border-input p-2"
            />
          </label>
          <label className="block text-xs">
            Bukti penawaran / PO
            <select
              name="document"
              className="mt-1 h-9 w-full rounded border border-input"
            >
              <option value="">Belum dipilih</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.kind} · {d.original_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <input type="checkbox" required /> Saya telah memeriksa bukti dan
            menyetujui perubahan tahap.
          </label>
          <Button size="sm" disabled={busy}>
            Simpan tindak lanjut
          </Button>
        </form>
        <p role="status" className="mt-2 text-xs text-amber-900">
          {message}
        </p>
      </Modal>
    </div>
  );
}
