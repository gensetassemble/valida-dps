"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOMAINS, DOMAIN_LABELS, FIELDS, type ImportDomain } from "./normalize";
export function ImportUpload({
  branch,
  initialDomain = "employees",
  lockedDomain = false,
  domains = DOMAINS,
}: {
  branch: string;
  initialDomain?: ImportDomain;
  lockedDomain?: boolean;
  domains?: readonly ImportDomain[];
}) {
  const [domain, setDomain] = useState<ImportDomain>(initialDomain),
    [headers, setHeaders] = useState<string[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  const clientImport = lockedDomain && domain === "clients";
  const personnelImport = lockedDomain && domain === "personnel";
  const guidedImport = clientImport || personnelImport;
  return (
    <form
      className="space-y-3"
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
                " baris siap diperiksa. Data website belum berubah.",
            );
          } else {
            setMessage(
              data.warning || "Hasil pembacaan file sudah disiapkan. Lanjutkan untuk memeriksa perubahan.",
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
      {lockedDomain ? (
        <input type="hidden" name="domain" value={domain} />
      ) : (
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
            {domains.map((item) => (
              <option key={item} value={item}>
                {DOMAIN_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-xs font-semibold">
        {clientImport ? "File pembaruan sertifikat klien" : personnelImport ? "File pembaruan kompetensi personil" : "CSV UTF-8 / XLSX / XLS / XLSB, maksimum 5 MiB"}
        <Input
          name="file"
          type="file"
          accept=".csv,.xlsx,.xls,.xlsb"
          required
          onChange={() => setHeaders([])}
          className="mt-1"
        />
        {guidedImport && (
          <span className="mt-1 block font-normal leading-snug text-muted-foreground">
            CSV / XLSX / XLS / XLSB · Maks. 5 MiB · Tabel ditemukan otomatis.
          </span>
        )}
      </label>
      {!guidedImport && (
        <label className="block text-xs">
          Nama lembar (opsional; pilihan awal: PT &amp; PTT Reguler)
          <Input name="sheet" className="mt-2" />
        </label>
      )}
      {guidedImport && <>
        <p className="text-xs leading-snug text-muted-foreground">Data baru berubah setelah Anda memilih <strong>Terapkan pembaruan</strong>.</p>
        <details className="rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-teal-900">Petunjuk pengisian</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 leading-snug text-muted-foreground">
            <li>{personnelImport ? "Gunakan hasil ekspor kompetensi atau tabel lama. Lengkapi nama, NPP, judul lisensi, nomor sertifikat, tanggal, dan keterangan." : "Isi portofolio, pelanggan, jenis dan nomor sertifikat. Tanggal terbit wajib untuk sertifikat baru."}</li>
            <li>Nama lembar dan susunan kolom dicocokkan otomatis. Periksa hasil pembacaan; cocokkan kolom bila diperlukan.</li>
            <li>Baris identik dilewati. Perubahan nomor atau tanggal sertifikat perlu diperiksa sebelum diterapkan.</li>
            {personnelImport && <li>Catatan perpanjangan membuat proses Sedang Diproses saat sertifikat masuk 90 hari terakhir atau telah berakhir.</li>}
          </ul>
        </details>
      </>}
      {headers.length > 0 && (
        <details open>
          <summary className="cursor-pointer text-sm font-semibold">
            Cocokkan kolom file
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
                  <option value="">Cari nama kolom otomatis</option>
                  {headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      )}
      <p role="status" className={message ? "text-xs text-amber-900" : "hidden"}>
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          name="operation"
          value="preview"
          disabled={busy}
          variant="outline"
        >
          Periksa file
        </Button>
        <Button
          name="operation"
          value="stage"
          disabled={busy || !headers.length}
        >
          Lanjut periksa perubahan
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
          <option value="">Belum ditemukan pasangannya</option>
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
          "Cari lalu pilih data yang sesuai; maksimum 20 hasil."}
      </p>
    </div>
  );
}
