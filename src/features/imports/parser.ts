import "server-only";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { clean, normalize, type ImportDomain } from "./normalize";
import { legacyWorkbook } from "@/features/equipment-sync/legacy-workbook";
import { checkZip, isOleWorkbook } from "./workbook-security";
import { CLIENT_TEMPLATE_EXAMPLE_MARKER } from "./client-template";
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
      domain === "clients" &&
      values.some((value) => clean(value).includes(CLIENT_TEMPLATE_EXAMPLE_MARKER))
    )
      return;
    if (
      headers.some((h) =>
        ["__proto__", "prototype", "constructor"].includes(h),
      ) ||
      new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length
    )
      throw Error("Nama kolom kosong, berulang, atau tidak diperbolehkan. Perbaiki judul kolom pada file.");
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
    if (!headers?.length) throw Error("Nama kolom pada file CSV tidak ditemukan.");
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
    const clientHeaderRow = (worksheet: ExcelJS.Worksheet) => {
      for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
        const labels: string[] = [];
        worksheet.getRow(i).eachCell((cell) => labels.push(clean(cell.text)));
        const human = labels.includes("Nomor Sertifikat") && labels.includes("Nama Pelanggan");
        const technical = labels.includes("certificate_number") && labels.includes("client_name");
        if (human || technical) return i;
      }
      return null;
    };
    const personnelHeader = (worksheet: ExcelJS.Worksheet) => {
      for (let row = 1; row <= Math.min(10, worksheet.rowCount); row++) {
        const current: string[] = [];
        const next: string[] = [];
        worksheet
          .getRow(row)
          .eachCell({ includeEmpty: true }, (cell, index) => (current[index - 1] = clean(cell.text)));
        worksheet
          .getRow(row + 1)
          .eachCell({ includeEmpty: true }, (cell, index) => (next[index - 1] = clean(cell.text)));
        const labels = [...current, ...next];
        const human = labels.includes("NPP") && labels.includes("NAMA PEGAWAI") && labels.includes("JUDUL LISENSI");
        const technical = labels.includes("employee_id") && labels.includes("original_title");
        if (!human && !technical) continue;
        const hasSubheader = next.includes("TERBIT") || next.includes("BERAKHIR");
        const length = Math.max(current.length, hasSubheader ? next.length : 0);
        return {
          row,
          dataRow: hasSubheader ? row + 1 : row,
          headers: Array.from({ length }, (_, index) =>
            clean((hasSubheader && next[index]) || current[index]),
          ),
        };
      }
      return null;
    };
    let selectedSheets: ExcelJS.Worksheet[];
    if (sheet) {
      const selected = book.getWorksheet(sheet);
      if (!selected) throw Error("Nama lembar yang dipilih tidak ditemukan.");
      selectedSheets = [selected];
    } else if (domain === "clients") {
      selectedSheets = book.worksheets.filter((worksheet) => clientHeaderRow(worksheet) !== null);
      if (!selectedSheets.length)
        throw Error("Tabel sertifikat klien tidak ditemukan. Gunakan judul kolom Nama Pelanggan dan Nomor Sertifikat.");
    } else if (domain === "personnel") {
      selectedSheets = book.worksheets.filter((worksheet) => personnelHeader(worksheet) !== null);
      if (!selectedSheets.length)
        throw Error("Tabel kompetensi personil tidak ditemukan. Gunakan judul kolom NPP, NAMA PEGAWAI, dan JUDUL LISENSI.");
    } else if (domain === "employees") {
      const selected = book.getWorksheet("PT & PTT Reguler") || book.worksheets[0];
      if (!selected) throw Error("File tidak memiliki lembar data.");
      selectedSheets = [selected];
    } else {
      selectedSheets = [book.getWorksheet("Data") || (book.worksheets.length === 1 ? book.worksheets[0] : undefined)].filter(
        (worksheet): worksheet is ExcelJS.Worksheet => !!worksheet,
      );
      if (!selectedSheets.length)
        throw Error("File memiliki beberapa lembar. Isi nama lembar yang ingin digunakan.");
    }
    for (const selected of selectedSheets) {
      const personnel = domain === "personnel" ? personnelHeader(selected) : null;
      const headerRow = domain === "clients" ? clientHeaderRow(selected) || 1 : personnel?.dataRow || 1;
      const headers: string[] = personnel?.headers || [];
      if (!headers.length)
        selected
          .getRow(headerRow)
          .eachCell(
            { includeEmpty: true },
            (cell, index) => (headers[index - 1] = clean(cell.text)),
          );
      selected.eachRow((row, index) => {
        if (index <= headerRow) return;
        const vals: unknown[] = [];
        row.eachCell(
          { includeEmpty: true },
          (cell, cellIndex) =>
            (vals[cellIndex - 1] =
              cell.value instanceof Date
                ? cell.value.toISOString().slice(0, 10)
                : cell.text),
        );
        if (domain === "personnel" && /\(lanjutan\)/i.test(clean(vals[0]))) {
          const previous = source.at(-1);
          if (previous?.sheet === selected.name)
            headers.forEach((header, column) => {
              const value = clean(vals[column]);
              if (header && value && column > 0)
                previous.raw[header] = [previous.raw[header], value].filter(Boolean).join("\n");
            });
          return;
        }
        add(headers, vals, selected.name, index);
      });
    }
  } else throw Error("Gunakan CSV UTF-8, XLSX, XLS, atau XLSB.");
  if (!source.length)
    throw Error(
      domain === "clients"
        ? "Belum ada data yang dapat diimpor. Isi setidaknya satu baris di bawah baris contoh."
        : "Tidak ada baris data yang dapat diimpor.",
    );
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
