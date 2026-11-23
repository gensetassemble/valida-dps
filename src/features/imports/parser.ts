import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { clean, normalize, type ImportDomain } from "./normalize";
import { legacyWorkbook } from "@/features/equipment-sync/legacy-workbook";
import { checkZip, isOleWorkbook } from "./workbook-security";
export { checkZip } from "./workbook-security";
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024,
  MAX_ROWS = 2500;
export async function parseSource(
  name: string,
  bytes: Buffer,
  domain: ImportDomain,
  sheet?: string,
  mapping: Record<string, string> = {},
) {
  if (bytes.length < 1 || bytes.length > MAX_IMPORT_BYTES)
    throw Error("Berkas harus berukuran 1 byte sampai 5 MiB.");
  const source: { sheet: string; row: number; raw: Record<string, string> }[] =
    [];
  let sheets: string[];
  const add = (
    headers: string[],
    values: unknown[],
    s: string,
    row: number,
  ) => {
    if (!values.some((v) => clean(v))) return;
    if (
      headers.some((h) =>
        ["__proto__", "prototype", "constructor"].includes(h),
      ) ||
      new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length
    )
      throw Error("Header kosong/duplikat/terlarang perlu diperbaiki.");
    const raw = Object.fromEntries(
      headers.flatMap((h, i) => (h ? [[h, String(values[i] ?? "")]] : [])),
    );
    if (
      Object.values(raw).some((v) => v.length > 12000) ||
      headers.length > 100
    )
      throw Error("Ukuran sel atau kolom melampaui batas.");
    source.push({ sheet: s, row, raw });
    if (source.length > MAX_ROWS)
      throw Error("Maksimum 2.500 baris per berkas.");
  };
  if (name.toLowerCase().endsWith(".csv")) {
    const records = parse(bytes, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false,
      max_record_size: 20000,
      info: true,
    }) as unknown as { record: string[]; info: { lines: number } }[];
    const headers = records.shift()?.record.map(clean);
    if (!headers?.length) throw Error("Header CSV tidak ditemukan.");
    for (const rec of records) add(headers, rec.record, "CSV", rec.info.lines);
    sheets = ["CSV"];
  } else if (/\.(xlsx|xls|xlsb)$/i.test(name)) {
    let book: ExcelJS.Workbook;
    if (isOleWorkbook(bytes) || /\.xlsb$/i.test(name)) {
      book = legacyWorkbook(name, bytes);
    } else {
      checkZip(bytes);
      book = new ExcelJS.Workbook();
      await book.xlsx.load(
        bytes as unknown as Parameters<typeof book.xlsx.load>[0],
      );
    }
    sheets = book.worksheets.map((s) => s.name);
    const selected = sheet
      ? book.getWorksheet(sheet)
      : domain === "employees"
        ? book.getWorksheet("PT & PTT Reguler") || book.worksheets[0]
        : book.getWorksheet("Data") ||
          (book.worksheets.length === 1 ? book.worksheets[0] : undefined);
    if (!selected)
      throw Error(
        "Pilih nama sheet secara eksplisit untuk workbook multi-sheet.",
      );
    let headerRow = 1;
    if (domain === "clients") {
      for (let i=1;i<=Math.min(10,selected.rowCount);i++) {
        const labels: string[]=[];
        selected.getRow(i).eachCell(c=>labels.push(clean(c.text)));
        if (labels.includes("Nomor Sertifikat") && labels.includes("Nama Pelanggan")) { headerRow=i;break; }
      }
    }
    const headers: string[] = [];
    selected
      .getRow(headerRow)
      .eachCell(
        { includeEmpty: true },
        (c, i) => (headers[i - 1] = clean(c.text)),
      );
    selected.eachRow((row, index) => {
      if (index <= headerRow) return;
      const vals: unknown[] = [];
      row.eachCell(
        { includeEmpty: true },
        (c, i) =>
          (vals[i - 1] =
            c.value instanceof Date
              ? c.value.toISOString().slice(0, 10)
              : c.text),
      );
      add(headers, vals, selected.name, index);
    });
  } else throw Error("Gunakan CSV UTF-8, XLSX, XLS, atau XLSB.");
  if (!source.length) throw Error("Tidak ada baris sumber.");
  const signatures = new Set<string>();
  const rows = source.map((r) => {
    const norm = normalize(domain, r.raw, mapping);
    const signature = JSON.stringify(norm.normalized);
    const duplicate = signatures.has(signature);
    signatures.add(signature);
    return {
      ...r,
      ...norm,
      ...(duplicate
        ? {
            status: "duplicate",
            issues: [
              ...norm.issues,
              "Baris identik muncul lebih dari sekali dalam berkas.",
            ],
          }
        : {}),
    };
  });
  return {
    hash: createHash("sha256").update(bytes).digest("hex"),
    rows,
    sheets,
  };
}
