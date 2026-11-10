import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { monitoringColumns, monitoringValue } from "./monitoring";
import { businessNotes } from "./notes";
import { todayWita, validDate, remainingDays } from "@/lib/domain/validity";
import { xmlText } from "@/features/workflows/uma-annex";
import { longExportDate } from "./export-context";
import { applyXlsxReadability } from "@/lib/xlsx-readability";

type ReportContext = {
  acknowledgedBy: string;
  preparedBy: string;
  location: string;
};
type Row = Record<string, unknown>;
type DeadlineHighlight = { first: number; last: number; tone: "expired" | "soon" };

async function highlightDeadlines(zip: JSZip, sheets: Record<string, DeadlineHighlight[]>) {
  if (!Object.values(sheets).some((alerts) => alerts.length)) return;
  let styles = await zip.file("xl/styles.xml")!.async("string");
  const fills = styles.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/)!;
  const fillCount = [...fills[1].matchAll(/<fill\b/g)].length;
  const colors = ["FFFEE2E2", "FFFEF3C7"];
  styles = styles.replace(fills[0], fills[0]
    .replace(/\bcount="\d+"/, `count="${fillCount + 2}"`)
    .replace("</fills>", colors.map((color) => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`).join("") + "</fills>"));
  const cellXfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)!;
  const originals = [...cellXfs[1].matchAll(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)].map((m) => m[0]);
  const added: string[] = [], cache = new Map<string, number>();
  for (const [file, alerts] of Object.entries(sheets)) {
    const tones = new Map<number, DeadlineHighlight["tone"]>();
    for (const alert of alerts) for (let row = alert.first; row <= alert.last; row++) tones.set(row, alert.tone);
    const xml = (await zip.file(file)!.async("string")).replace(/<c\b[^>]*\/?>/g, (cell) => {
      const address = cell.match(/\br="([A-Z]+)(\d+)"/);
      const tone = address && ["B", "C", "M"].includes(address[1]) ? tones.get(Number(address[2])) : undefined;
      if (!tone) return cell;
      const original = Number(cell.match(/\bs="(\d+)"/)?.[1] || 0), key = `${original}:${tone}`;
      if (!cache.has(key)) {
        const fillId = fillCount + (tone === "expired" ? 0 : 1);
        added.push(originals[original].replace(/^<xf\b[^>]*\/?>/, (open) => open
          .replace(/\s+(?:fillId|applyFill)="[^"]*"/g, "")
          .replace(/(\/?>)$/, ` fillId="${fillId}" applyFill="1"$1`)));
        cache.set(key, originals.length + added.length - 1);
      }
      return cell.replace(/\s+s="[^"]*"/g, "").replace(/(\/?>)$/, ` s="${cache.get(key)}"$1`);
    });
    zip.file(file, xml);
  }
  styles = styles.replace(cellXfs[0], cellXfs[0]
    .replace(/\bcount="\d+"/, `count="${originals.length + added.length}"`)
    .replace("</cellXfs>", added.join("") + "</cellXfs>"));
  zip.file("xl/styles.xml", styles);
}
export function monitoringFilename(rows: Row[], today = todayWita(), allPortfolios = false) {
  const codes = [
    ...new Set(rows.map((r) => String(r.portfolio_code || "")).filter(Boolean)),
  ];
  const code = !allPortfolios && codes.length === 1 ? codes[0] : "ALL";
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
  const highlights: DeadlineHighlight[] = [];
  let next = 9;
  (records.length ? records : [null]).forEach((record, index) => {
    const sourceGroups = Array.isArray(record?.monitoring_measurements)
      ? record.monitoring_measurements.filter(
          (group): group is Row => !!group && typeof group === "object" && !Array.isArray(group),
        )
      : [];
    const groups = (sourceGroups.length ? sourceGroups : [record || {}]).map((group) => {
      const factors = String(group.correction_factor ?? record?.correction_factor ?? "")
        .replace(/\\n/g, "\n").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return {
        range: String(group.measurement_range ?? record?.measurement_range ?? "").replace(/\\n/g, "\n"),
        factors: factors.length ? factors : [""],
      };
    });
    const corrections = groups.flatMap((group) => group.factors);
    const count = corrections.length;
    const days = record ? remainingDays(monitoringValue(record, "latest_due_date"), today) : null;
    if (days !== null && days <= 90)
      highlights.push({first: next, last: next + count - 1, tone: days < 0 ? "expired" : "soon"});
    let groupStart = next;
    const ranges = new Map<number, string>();
    for (const group of groups) {
      ranges.set(groupStart, group.range);
      if (group.factors.length > 1) merges.push(`R${groupStart}:R${groupStart + group.factors.length - 1}`);
      groupStart += group.factors.length;
    }
    for (let i = 0; i < count; i++) {
      const base = model[i === 0 ? 0 : i === count - 1 ? 10 : Math.min(i, 9)];
      let xml = shiftRow(base.xml, next + i - base.n);
      if (record && i === 0) {
        xml = setCell(xml, "A" + next, index + 1, true);
        monitoringColumns.forEach(([key], col) => {
          if (key === "correction_factor" || key === "measurement_range") return;
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
      if (record && ranges.has(next + i))
        xml = setCell(xml, "R" + (next + i), ranges.get(next + i));
      body.push(xml);
    }
    for (let col = 0; col < 22; col++)
      if (col !== 17 && col !== 18 && count > 1)
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
  return { xml, last: 42 + delta, tableLast: next - 1, highlights };
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
  const nativeDrawing = await zip.file("xl/drawings/drawing1.xml")!.async("string");
  const logo = await zip.file("xl/media/logo.png")!.async("nodebuffer");
  const logoRatio = logo.readUInt32BE(16) / logo.readUInt32BE(20);
  // Column widths are widened for readable table data. A two-cell image anchor
  // stretches with those columns even with noChangeAspect set. Keep the native
  // logo's physical dimensions independent of the worksheet grid instead.
  const drawing = nativeDrawing.replace(
    /<xdr:twoCellAnchor\b[^>]*>([\s\S]*?)<\/xdr:twoCellAnchor>/g,
    (_, body: string) => {
      const extent = body.match(/<a:xfrm\b[^>]*>[\s\S]*?<a:ext cx="(\d+)" cy="(\d+)"/);
      if (!extent) throw Error("Ukuran logo template monitoring tidak ditemukan.");
      const width = Math.round(Number(extent[2]) * logoRatio);
      body = body.replace(/<a:ext cx="\d+" cy="\d+"\/>/, `<a:ext cx="${width}" cy="${extent[2]}"/>`);
      return "<xdr:oneCellAnchor>" + body.replace(
        /<xdr:to>[\s\S]*?<\/xdr:to>/,
        `<xdr:ext cx="${width}" cy="${extent[2]}"/>`,
      ) + "</xdr:oneCellAnchor>";
    },
  );
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
  const deadlineHighlights: Record<string, DeadlineHighlight[]> = {};
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
    deadlineHighlights[`xl/worksheets/sheet${id}.xml`] = output.highlights;
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
  await highlightDeadlines(zip, deadlineHighlights);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
