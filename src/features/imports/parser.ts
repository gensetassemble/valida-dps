import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { clean, normalize, type ImportDomain } from "./normalize";
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024,
  MAX_ROWS = 2500;
export function checkZip(bytes: Buffer) {
  // Read central-directory declared sizes before ExcelJS allocates decompressed XML.
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length)
    throw Error("Arsip XLSX tidak valid.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16),
    size = 0;
  if (count > 1000 || count === 65535) throw Error("XLSX terlalu kompleks.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw Error("Direktori XLSX tidak valid.");
    const expanded = bytes.readUInt32LE(offset + 24),
      len = bytes.readUInt16LE(offset + 28),
      extra = bytes.readUInt16LE(offset + 30),
      comment = bytes.readUInt16LE(offset + 32);
    size += expanded;
    if (
      size > 20 * 1024 * 1024 ||
      expanded === 0xffffffff ||
      bytes.readUInt16LE(offset + 8) & 1
    )
      throw Error("XLSX terkompresi berlebihan atau terenkripsi.");
    const name = bytes.subarray(offset + 46, offset + 46 + len).toString();
    if (/vbaProject|\.\./i.test(name))
      throw Error("Makro atau path XLSX ditolak.");
    offset += 46 + len + extra + comment;
  }
}
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
  } else if (name.toLowerCase().endsWith(".xlsx")) {
    checkZip(bytes);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      bytes as unknown as Parameters<typeof book.xlsx.load>[0],
    );
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
    const headers: string[] = [];
    selected
      .getRow(1)
      .eachCell(
        { includeEmpty: true },
        (c, i) => (headers[i - 1] = clean(c.text)),
      );
    selected.eachRow((row, index) => {
      if (index === 1) return;
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
  } else throw Error("Gunakan CSV UTF-8 atau XLSX; XLS/makro tidak diterima.");
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
