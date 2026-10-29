"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOMAIN_LABELS, FIELDS, type ImportDomain } from "./normalize";
export function ImportUpload({ branch }: { branch: string }) {
  const [domain, setDomain] = useState<ImportDomain>("employees"),
    [headers, setHeaders] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        const form = new FormData(e.currentTarget);
        const button = (e.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        const preview = button?.value === "preview";
        form.set("preview", String(preview));
        form.set("branch", branch);
        const mapping: Record<string, string> = {};
        for (const key of Object.keys(FIELDS[domain])) {
          const source = String(form.get("mapping_" + key) || "");
          if (source) mapping[key] = source;
        }
        form.set("mapping", JSON.stringify(mapping));
        try {
          const response = await fetch("/api/imports/upload", {
            method: "POST",
            body: form,
          });
          const data = await response.json();
          if (!response.ok) {
            setMessage(data.error || "Unggah ditolak.");
            return;
          }
          if (preview) {
            setHeaders(data.headers);
            setMessage(
              data.rows +
                " baris terbaca. " +
                data.ready +
                " baris siap ditinjau; belum ada data kanonis yang ditulis.",
            );
          } else {
            setMessage(
              data.warning || "Seluruh baris tersimpan di staging privat.",
            );
            router.push("/impor-data/" + data.batch + "?branch=" + branch);
          }
        } catch {
          setMessage("Unggah belum dapat diselesaikan.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-xs font-semibold">
        Jenis sumber
        <select
          name="domain"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value as ImportDomain);
            setHeaders([]);
          }}
          className="mt-2 h-10 w-full rounded-lg border border-input px-3"
        >
          {Object.entries(DOMAIN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-semibold">
        CSV UTF-8 / XLSX, maksimum 5 MiB
        <Input
          name="file"
          type="file"
          accept=".csv,.xlsx"
          required
          onChange={() => setHeaders([])}
          className="mt-2"
        />
      </label>
      <label className="block text-xs">
        Sheet (opsional; master bawaan: PT &amp; PTT Reguler)
        <Input name="sheet" className="mt-2" />
      </label>
      {headers.length > 0 && (
        <details open>
          <summary className="cursor-pointer text-sm font-semibold">
            Pemetaan kolom sumber
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(FIELDS[domain]).map(([k, label]) => (
              <label className="text-xs" key={k}>
                {label}
                <select
                  name={"mapping_" + k}
                  defaultValue={headers.includes(k) ? k : ""}
                  className="mt-1 h-9 w-full rounded border border-input px-2"
                >
                  <option value="">Deteksi header yang dikenal</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      )}
      <p role="status" className="text-xs text-amber-900">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          name="operation"
          value="preview"
          disabled={busy}
          variant="outline"
        >
          Pratinjau &amp; periksa kolom
        </Button>
        <Button
          name="operation"
          value="stage"
          disabled={busy || !headers.length}
        >
          Simpan ke staging privat
        </Button>
        <a
          className="py-2 text-xs underline"
          href={"/api/imports/template?domain=" + domain + "&branch=" + branch}
        >
          Unduh template XLSX
        </a>
      </div>
    </form>
  );
}
type Result = { error?: string; ok?: boolean; message?: string };
export function ReviewForm({
  action,
  children,
}: {
  action: (data: FormData) => Promise<Result>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const data = new FormData(e.currentTarget);
        const submit = (e.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        if (submit?.name) data.set(submit.name, submit.value);
        try {
          const r = await action(data);
          setMessage(r.error || r.message || "Keputusan tersimpan.");
          if (r.ok) router.refresh();
        } catch {
          setMessage("Permintaan belum dapat diselesaikan.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        {children}
      </fieldset>
      <p role="status" className="text-xs text-amber-900">
        {busy ? "Memproses…" : message}
      </p>
    </form>
  );
}
export function ImportReference({
  name,
  label,
  entity,
  field,
  branch,
  value,
}: {
  name: string;
  label: string;
  entity: string;
  field: string;
  branch: string;
  value: string;
}) {
  const [q, setQ] = useState(""),
    [options, setOptions] = useState<{ value: string; label: string }[]>([]),
    [error, setError] = useState("");
  return (
    <div>
      <label className="text-xs">
        {label}
        <select
          name={name}
          defaultValue={value}
          className="mt-1 h-10 w-full rounded-lg border border-input px-2"
        >
          <option value="">Belum dipetakan</option>
          {value && !options.some((o) => o.value === value) && (
            <option value={value}>{value}</option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          aria-label={"Cari " + label}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              const response = await fetch(
                "/api/master-data/lookups?" +
                  new URLSearchParams({ entity, field, branch, q }),
              );
              if (!response.ok) throw Error();
              const data = await response.json();
              setOptions(data.options);
              setError(
                data.options.length
                  ? ""
                  : "Tidak ada pilihan. Buat referensi terverifikasi melalui master/modul terkait.",
              );
            } catch {
              setError("Pilihan belum dapat dimuat.");
            }
          }}
        >
          Cari
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {error ||
          "Pilih identitas/referensi yang telah diperiksa; maksimum 20 hasil."}
      </p>
    </div>
  );
}
