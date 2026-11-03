import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { monitoringColumns, monitoringValue } from "./monitoring";
import { businessNotes } from "./notes";
import { todayWita, validDate } from "@/lib/domain/validity";
import { xmlText } from "@/features/workflows/uma-annex";
import { longExportDate } from "./export-context";
import { applyXlsxReadability } from "@/lib/xlsx-readability";

type ReportContext = {
  acknowledgedBy: string;
  preparedBy: string;
  location: string;
};
type Row = Record<string, unknown>;
export function monitoringFilename(rows: Row[], today = todayWita()) {
  const codes = [
    ...new Set(rows.map((r) => String(r.portfolio_code || "")).filter(Boolean)),
  ];
  const code = codes.length === 1 ? codes[0] : "ALL";
  return `Form Laporan Monitoring Peralatan - ${code.replace(/[\\/:*?"<>|]/g, "-")} ${today.slice(0, 4)}.xlsx`;
}
function shiftRow(xml: string, delta: number) {
  return xml
    .replace(/(<row\b[^>]*\br=")(\d+)(")/, (m, a, n, b) => a + (+n + delta) + b)
    .replace(
      /(<c\b[^>]*\br="[A-Z]+)(\d+)(")/g,
      (m, a, n, b) => a + (+n + delta) + b,
    );
}
function shiftRange(ref: string, delta: number) {
  return ref.replace(/(\d+)/g, (n) => String(+n + delta));
}
function setCell(
  row: string,
  ref: string,
  value: unknown,
  numeric = false,
  fallbackStyle?: string,
) {
  const re = new RegExp(
    `<c\\b([^>]*\\br="${ref}"[^>]*?)(?:\\/>|>[\\s\\S]*?<\\/c>)`,
  );
  if (!re.test(row)) {
    if (!/^S\d+$/.test(ref) || !fallbackStyle)
      throw Error("Sel template monitoring tidak ditemukan: " + ref);
    row = row.replace(
      /(?=<c\b[^>]*r="[T-Z]\d+")|(?=<\/row>)/,
      `<c r="${ref}" s="${fallbackStyle}"/>`,
    );
  }
  return row.replace(
    re,
    (_, attrs: string) =>
      `<c${attrs.replace(/\s+t="[^"]*"/g, "")}${numeric ? `><v>${Number(value)}</v>` : ` t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is>`}</c>`,
  );
}
function worksheet(
  template: string,
  records: Row[],
  portfolio: string,
  branch: string,
  today: string,
  context?: ReportContext,
) {
  const sourceRows = [
    ...template.matchAll(
      /<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g,
    ),
  ].map((m) => ({ n: +m[1], xml: m[0] }));
  const header = sourceRows
    .filter((r) => r.n <= 8)
    .map((r) => {
      let xml = r.xml;
      if (r.n === 3)
        xml = setCell(
          xml,
          "A3",
          `Unit Kerja : Divisi/ SBU/ Cabang ${branch === "DPS" ? "Denpasar" : branch} -- ${portfolio}`,
        );
      if (r.n === 4)
        xml = setCell(xml, "A4", "Periode   : " + today.slice(0, 4));
      return xml;
    });
  const model = sourceRows.filter((r) => r.n >= 9 && r.n <= 19);
  const factorStyle = model[0].xml.match(/<c\b[^>]*r="S9"[^>]*s="(\d+)"/)?.[1];
  const body: string[] = [],
    merges: string[] = [];
  let next = 9;
  (records.length ? records : [null]).forEach((record, index) => {
    const corrections = record
      ? monitoringValue(record, "correction_factor")
          .split(/\r?\n/)
          .flatMap((line) => {
            const chars = [...line],
              parts: string[] = [];
            do {
              parts.push(chars.splice(0, 240).join(""));
            } while (chars.length);
            return parts;
          })
      : [];
    const count = Math.max(11, corrections.length);
    for (let i = 0; i < count; i++) {
      const base = model[i === 0 ? 0 : i === count - 1 ? 10 : Math.min(i, 9)];
      let xml = shiftRow(base.xml, next + i - base.n);
      if (record && i === 0) {
        xml = setCell(xml, "A" + next, index + 1, true);
        monitoringColumns.forEach(([key], col) => {
          if (key === "correction_factor") return;
          const ref = String.fromCharCode(66 + col) + next;
          const raw = record[key];
          if (
            ["latest_calibration_date", "latest_due_date"].includes(key) &&
            typeof raw === "string" &&
            validDate(raw)
          )
            xml = setCell(
              xml,
              ref,
              (Date.parse(raw + "T00:00:00Z") - Date.UTC(1899, 11, 30)) /
                86400000,
              true,
            );
          else xml = setCell(xml, ref, monitoringValue(record, key));
        });
        xml = setCell(xml, "V" + next, businessNotes(record.notes));
      }
      if (record)
        xml = setCell(
          xml,
          "S" + (next + i),
          corrections[i] || "",
          false,
          factorStyle,
        );
      body.push(xml);
    }
    for (let col = 0; col < 22; col++)
      if (col !== 18)
        merges.push(
          `${String.fromCharCode(65 + col)}${next}:${String.fromCharCode(65 + col)}${next + count - 1}`,
        );
    next += count;
  });
  const delta = next - 20;
  const footer = sourceRows
    .filter((r) => r.n >= 20)
    .map((r) => {
      let xml = r.xml;
      if (context) {
        if (r.n === 22)
          xml = setCell(
            xml,
            "R22",
            `${context.location}, ${longExportDate(today)}`,
          );
        if (r.n === 29) {
          xml = setCell(xml, "A29", `(${context.acknowledgedBy})`);
          xml = setCell(xml, "R29", `(${context.preparedBy})`);
        }
      }
      return shiftRow(xml, delta);
    });
  for (const m of template.matchAll(/<mergeCell ref="([^"]+)"\/>/g)) {
    const nums = [...m[1].matchAll(/\d+/g)].map((n) => +n[0]);
    if (nums[1] <= 8) merges.push(m[1]);
    else if (nums[0] >= 20) merges.push(shiftRange(m[1], delta));
  }
  let xml = template
    .replace(
      /<sheetData>[\s\S]*?<\/sheetData>/,
      "<sheetData>" + [...header, ...body, ...footer].join("") + "</sheetData>",
    )
    .replace(
      /<mergeCells\b[\s\S]*?<\/mergeCells>/,
      `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`,
    )
    .replace(/<dimension[^>]*\/>/, `<dimension ref="A1:V${42 + delta}"/>`);
  const reportWidths: Record<number, number> = {
    2: 28,
    3: 22,
    4: 18,
    5: 18,
    10: 26,
    11: 22,
    12: 22,
    13: 25,
    14: 22,
    15: 25,
    18: 26,
    19: 20,
    22: 30,
  };
  xml = xml.replace(/<col\b[^>]*\/>/g, (col) => {
    const index = Number(col.match(/\bmin="(\d+)"/)?.[1]);
    return reportWidths[index]
      ? col.replace(/\bwidth="[^"]*"/, `width="${reportWidths[index]}"`)
      : col;
  });
  // Repeat the native eight-row header when printing, without shrinking a whole portfolio to one page.
  xml = xml.replace(
    /<pageSetup\b([^>]*)\/>/,
    (m, a) =>
      "<pageSetup" +
      a.replace(/\s+fitToHeight="[^"]*"/g, "") +
      ' fitToHeight="0"/>',
  );
  return { xml, last: 42 + delta, tableLast: next - 1 };
}
/** Native FOR/SCI-UMA/198 Rev.03: preserve layout, fonts, logo, header, footer and print geometry. */
export async function monitoringXlsx(
  rows: Row[],
  branch: string,
  today = todayWita(),
  context?: ReportContext,
) {
  const zip = await JSZip.loadAsync(
    await readFile(
      path.join(process.cwd(), "src/assets/forms/FOR-SCI-UMA-198-Rev-03.xlsx"),
    ),
  );
  const template = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  const drawing = await zip.file("xl/drawings/drawing1.xml")!.async("string");
  const drawingRel = await zip
    .file("xl/drawings/_rels/drawing1.xml.rels")!
    .async("string");
  const sheetRel = await zip
    .file("xl/worksheets/_rels/sheet1.xml.rels")!
    .async("string");
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const code = String(row.portfolio_code || "Belum dipetakan");
    const list = groups.get(code) || [];
    list.push(row);
    groups.set(code, list);
  }
  if (!groups.size) groups.set("ALL", []);
  const sheets: string[] = [],
    names: string[] = [],
    relationships: string[] = [],
    types: string[] = [];
  const used = new Set<string>();
  const tableRanges: Record<string, { first: number; last: number }> = {};
  let index = 0;
  for (const [portfolio, records] of groups) {
    const id = ++index,
      base =
        portfolio.replace(/[\\/*?:[\]]/g, "_").slice(0, 25) || "Monitoring";
    let name = base,
      suffix = 1;
    while (used.has(name.toLowerCase())) name = base + " " + suffix++;
    used.add(name.toLowerCase());
    const output = worksheet(
      template,
      records,
      portfolio,
      branch,
      today,
      context,
    );
    zip.file(`xl/worksheets/sheet${id}.xml`, output.xml);
    tableRanges[`xl/worksheets/sheet${id}.xml`] = {
      first: 6,
      last: output.tableLast,
    };
    zip.file(
      `xl/worksheets/_rels/sheet${id}.xml.rels`,
      sheetRel.replace("drawing1.xml", `drawing${id}.xml`),
    );
    zip.file(`xl/drawings/drawing${id}.xml`, drawing);
    zip.file(`xl/drawings/_rels/drawing${id}.xml.rels`, drawingRel);
    sheets.push(
      `<sheet name="${xmlText(name)}" sheetId="${id}" r:id="rId${id === 1 ? 1 : id + 2}"/>`,
    );
    const escaped = name.replace(/'/g, "''");
    names.push(
      `<definedName name="_xlnm.Print_Area" localSheetId="${id - 1}">'${xmlText(escaped)}'!$A$1:$V$${output.last}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="${id - 1}">'${xmlText(escaped)}'!$1:$8</definedName>`,
    );
    if (id > 1) {
      relationships.push(
        `<Relationship Id="rId${id + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`,
      );
      types.push(
        `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/drawings/drawing${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
      );
    }
  }
  const book = await zip.file("xl/workbook.xml")!.async("string");
  zip.file(
    "xl/workbook.xml",
    book
      .replace(
        /<sheets>[\s\S]*?<\/sheets>/,
        "<sheets>" + sheets.join("") + "</sheets>",
      )
      .replace(
        /<definedNames>[\s\S]*?<\/definedNames>/,
        "<definedNames>" + names.join("") + "</definedNames>",
      ),
  );
  const rel = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  zip.file(
    "xl/_rels/workbook.xml.rels",
    rel.replace(
      "</Relationships>",
      relationships.join("") + "</Relationships>",
    ),
  );
  const content = await zip.file("[Content_Types].xml")!.async("string");
  zip.file(
    "[Content_Types].xml",
    content.replace("</Types>", types.join("") + "</Types>"),
  );
  await applyXlsxReadability(zip, tableRanges);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
