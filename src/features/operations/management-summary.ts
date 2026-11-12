import JSZip from "jszip";
import type { DataRow } from "@/features/master-data/server";
import { operationalValidity, todayWita, validityDisplayLabel } from "@/lib/domain/validity";
import { longExportDate } from "./export-context";

export type SummaryEntity = "sertifikat-klien" | "kompetensi-personil" | "kalibrasi-alat";
const statuses = [
  ["Expired", "Sudah melewati tanggal berakhir", "DC2626", "FEE2E2"],
  ["Kritis", "Sisa 0–30 hari", "EA580C", "FFEDD5"],
  ["Perhatian", "Sisa 31–60 hari", "CA8A04", "FEF3C7"],
  ["Pantau", "Sisa 61–90 hari", "0891B2", "CFFAFE"],
  ["Aman", "Sisa lebih dari 90 hari", "059669", "DCFCE7"],
  ["Not Recorded", "Tanggal berakhir tidak tercatat atau tertulis N/A", "64748B", "F1F5F9"],
  ["Berlaku Seumur Hidup", "Tidak memiliki batas masa berlaku", "7C3AED", "EDE9FE"],
] as const;
const titles: Record<SummaryEntity, string> = {
  "sertifikat-klien": "Sertifikat Klien",
  "kompetensi-personil": "Kompetensi Personil",
  "kalibrasi-alat": "Kalibrasi Alat",
};
const xml = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const mainNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageNs = "http://schemas.openxmlformats.org/package/2006/relationships";

/** Count business records, never the physical rows used for correction factors or wrapped text. */
function uniqueRecords(rows: DataRow[]) {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row.id) return true;
    const id = String(row.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function managementSummary(rows: DataRow[], entity: SummaryEntity, today = todayWita()) {
  const counts = statuses.map(() => 0);
  for (const row of uniqueRecords(rows)) {
    const date = entity === "kalibrasi-alat"
      ? row.latest_due_date || row.due_date_original
      : row.expiry_date;
    const status = operationalValidity(typeof date === "string" ? date : null,
      entity === "kompetensi-personil" && row.validity_kind === "lifetime", today);
    const index = statuses.findIndex(([label]) => label === validityDisplayLabel(status));
    counts[index]++;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  return { total, urgent: counts[0] + counts[1], upcoming: counts[1] + counts[2] + counts[3],
    buckets: statuses.map(([status, description, color, fill], index) => ({ status, description, color, fill,
      count: counts[index], share: total ? counts[index] / total : 0 })) };
}

export function equipmentPortfolioSummary(rows: DataRow[], today = todayWita()) {
  const groups = new Map<string, DataRow[]>();
  for (const row of uniqueRecords(rows)) {
    const code = typeof row.portfolio_code === "string" ? row.portfolio_code.trim().toUpperCase() : "";
    const portfolio = code || "Belum dipetakan";
    const group = groups.get(portfolio);
    if (group) group.push(row);
    else groups.set(portfolio, [row]);
  }
  return [...groups].sort(([a], [b]) => a === "Belum dipetakan" ? 1 : b === "Belum dipetakan" ? -1 : a.localeCompare(b, "id"))
    .map(([portfolio, records]) => ({ portfolio, ...managementSummary(records, "kalibrasi-alat", today) }));
}

function chartXml(data: ReturnType<typeof managementSummary>) {
  const points = data.buckets.map((b, i) => `<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${b.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:dPt>`).join("");
  const categories = data.buckets.map((b, i) => `<c:pt idx="${i}"><c:v>${xml(b.status)}</c:v></c:pt>`).join("");
  const values = data.buckets.map((b, i) => `<c:pt idx="${i}"><c:v>${b.count}</c:v></c:pt>`).join("");
  return `${declaration}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:lang val="id-ID"/><c:chart><c:autoTitleDeleted val="1"/><c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>Jumlah rekaman</c:v></c:tx>${points}<c:cat><c:strRef><c:f>'Ringkasan Manajemen'!$B$12:$B$18</c:f><c:strCache><c:ptCount val="7"/>${categories}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'Ringkasan Manajemen'!$C$12:$C$18</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="7"/>${values}</c:numCache></c:numRef></c:val></c:ser><c:dLbls><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbls><c:gapWidth val="65"/><c:axId val="101"/><c:axId val="102"/></c:barChart><c:catAx><c:axId val="101"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="102"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="102"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="101"/><c:crosses val="max"/><c:crossBetween val="between"/><c:majorUnit val="${Math.max(1, Math.ceil(Math.max(...data.buckets.map(b => b.count)) / 5))}"/></c:valAx></c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000"><a:solidFill><a:srgbClr val="0B2545"/></a:solidFill><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr></c:chartSpace>`;
}

/** Append OOXML parts rather than resaving the UMA template: preserve drawings and native report geometry. */
export async function withManagementSummary(bytes: Uint8Array, options: {
  entity: SummaryEntity; rows: DataRow[]; branch: string; today?: string; includeInactive?: boolean;
}) {
  const today = options.today ?? todayWita();
  const data = managementSummary(options.rows, options.entity, today);
  const portfolios = options.entity === "kalibrasi-alat" ? equipmentPortfolioSummary(options.rows, today) : null;
  const zip = await JSZip.loadAsync(bytes);
  if (zip.file("xl/charts/valida-validity.xml")) throw Error("Ringkasan manajemen sudah ditambahkan.");
  async function read(path: string) {
    const file = zip.file(path);
    if (!file) throw Error(`Bagian XLSX tidak tersedia: ${path}`);
    return file.async("string");
  }
  let workbook = await read("xl/workbook.xml");
  const sheetId = Math.max(...Array.from(workbook.matchAll(/sheetId="(\d+)"/g), m => Number(m[1]))) + 1;
  const sheetPath = `xl/worksheets/sheet${sheetId}.xml`;
  let styles = await read("xl/styles.xml");
  function append(collection: string, elements: string[]) {
    let start = -1;
    styles = styles.replace(new RegExp(`<${collection} count="(\\d+)"([^>]*)>([\\s\\S]*?)</${collection}>`), (_, n, attrs, content) => {
      start = Number(n);
      return `<${collection} count="${start + elements.length}"${attrs}>${content}${elements.join("")}</${collection}>`;
    });
    if (start < 0) throw Error(`Gaya XLSX tidak valid: ${collection}`);
    return start;
  }
  const font = append("fonts", [
    '<font><sz val="11"/><color rgb="FF0B2545"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    '<font><b/><sz val="25"/><color rgb="FF0B2545"/><name val="Calibri"/></font>',
    '<font><b/><sz val="16"/><color rgb="FF0B2545"/><name val="Calibri"/></font>',
    '<font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font>',
  ]);
  const fill = append("fills", ["0B2545", "F0FDFA", "FFF7ED", "F8FAFC", ...data.buckets.map(b => b.fill)]
    .map(color => `<fill><patternFill patternType="solid"><fgColor rgb="FF${color}"/><bgColor indexed="64"/></patternFill></fill>`));
  const xf = (fontId: number, fillId = 0, numFmtId = 0, horizontal = "left") => `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${horizontal}" vertical="center" wrapText="1"/></xf>`;
  const style = append("cellXfs", [xf(font), xf(font + 1, fill), xf(font + 2, fill + 1), xf(font + 3), xf(font + 4),
    xf(font, fill + 3, 9, "center"), xf(font + 2, fill + 2),
    ...data.buckets.flatMap((_, i) => [xf(font, fill + 4 + i), xf(font, fill + 4 + i, 0, "center"), xf(font, fill + 4 + i, 9, "center")])]);
  zip.file("xl/styles.xml", styles);
  const cells = new Map<number, string[]>();
  const merges: string[] = [];
  function cell(ref: string, value: string | number, s = 0) {
    const row = Number(ref.match(/\d+/)![0]);
    const content = typeof value === "number" ? `<v>${value}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`;
    const entry = `<c r="${ref}" s="${style + s}"${typeof value === "number" ? "" : ' t="inlineStr"'}>${content}</c>`;
    cells.set(row, [...(cells.get(row) || []), entry]);
  }
  function merged(ref: string, value: string | number, s = 0) { merges.push(ref); cell(ref.split(":")[0], value, s); }
  merged("B2:L2", "RINGKASAN MANAJEMEN", 3);
  merged("B3:L3", titles[options.entity]);
  merged("B4:L4", `Cabang ${options.branch} · Posisi ${longExportDate(today)} (WITA)`, 4);
  merged("B6:D6", "TOTAL REKAMAN", 1); merged("F6:H6", "EXPIRED + KRITIS", 1); merged("J6:L6", "BERAKHIR DALAM 0–90 HARI", 1);
  merged("B7:D8", data.total, 2); merged("F7:H8", data.urgent, 6); merged("J7:L8", data.upcoming, 2);
  merged("F10:L10", "KOMPOSISI MASA BERLAKU", 1);
  cell("B11", "Status", 1); cell("C11", "Jumlah", 1); cell("D11", "Persentase", 1);
  data.buckets.forEach((b, i) => { cell(`B${12 + i}`, b.status, 7 + i * 3); cell(`C${12 + i}`, b.count, 8 + i * 3); cell(`D${12 + i}`, b.share, 9 + i * 3); });
  cell("B19", "TOTAL", 1); cell("C19", data.total, 1); cell("D19", data.total ? 1 : 0, 5);
  merged("B21:D21", "ACUAN MASA BERLAKU", 1);
  merged("B22:D24", "Kritis: 0–30 hari\nPerhatian: 31–60 hari\nPantau: 61–90 hari\nAman: lebih dari 90 hari", 4);
  const unit = options.entity === "kalibrasi-alat" ? "Satu alat dihitung sekali, terlepas dari jumlah parameter/faktor koreksi." : "Jumlah dihitung per rekaman sertifikat yang diekspor, bukan per pemilik/pelanggan.";
  merged("B26:L27", `Cakupan sesuai filter ekspor dan hak akses akun. ${unit}${options.entity === "kompetensi-personil" ? options.includeInactive ? " Termasuk personil nonaktif yang dipilih dalam ekspor." : " Personil nonaktif dikecualikan." : ""}`, 4);
  merged("B28:L29", "Grafik adalah snapshot pada tanggal ekspor. Not Recorded berarti tanggal berakhir tidak tercatat atau tertulis N/A; terpisah dari status Expired dan seumur hidup. Pengajuan/perpanjangan tidak otomatis mengubah masa berlaku.", 4);
  let lastRow = 29;
  if (portfolios) {
    merged("B32:L32", "STATUS ALAT PER PORTOFOLIO", 3);
    merged("B33:L34", "Sesuai alat yang masuk ekspor. Warna menunjukkan kategori masa berlaku; angka 0 berarti tidak ada alat pada kategori tersebut.", 4);
    const columns = ["B", "C", "D", "E:F", "G", "H", "I", "J:L"];
    function portfolioRow(row: number, values: (string | number)[], header = false) {
      columns.forEach((col, index) => {
        const range = col.includes(":") ? col.split(":").map(c => `${c}${row}`).join(":") : null;
        const style = header ? 1 : index < 2 ? 0 : 8 + (index - 2) * 3;
        if (range) merged(range, values[index], style);
        else cell(`${col}${row}`, values[index], style);
      });
    }
    portfolioRow(35, ["Portofolio", "Total alat", "Expired", "Kritis", "Perhatian", "Pantau", "Aman", "Not Recorded"], true);
    portfolios.forEach((p, i) => portfolioRow(36 + i, [p.portfolio, p.total, ...p.buckets.slice(0, 6).map(b => b.count)]));
    const totalRow = 36 + portfolios.length;
    portfolioRow(totalRow, ["TOTAL", data.total, ...data.buckets.slice(0, 6).map(b => b.count)], true);
    if (!portfolios.length) merged(`B${totalRow + 2}:L${totalRow + 2}`, "Tidak ada alat yang sesuai filter ekspor.", 4);
    merged(`B${totalRow + 4}:L${totalRow + 5}`, "Expired: lewat tanggal berakhir · Kritis: 0–30 hari · Perhatian: 31–60 hari · Pantau: 61–90 hari · Aman: lebih dari 90 hari. Alat tanpa portofolio ditampilkan sebagai Belum dipetakan.", 4);
    lastRow = totalRow + 5;
  }
  const rows = Array.from({ length: lastRow + 1 }, (_, i) => `<row r="${i + 1}" ht="${i >= 11 && i <= 17 || i === 34 ? 32 : 22}" customHeight="1">${(cells.get(i + 1) || []).join("")}</row>`).join("");
  zip.file(sheetPath, `${declaration}<worksheet xmlns="${mainNs}" xmlns:r="${relNs}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="B2:L${lastRow}"/><sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols><col min="1" max="1" width="3" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="11" customWidth="1"/><col min="4" max="4" width="15" customWidth="1"/><col min="5" max="5" width="3" customWidth="1"/><col min="6" max="12" width="12" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="${portfolios ? 2 : 1}"/>${portfolios ? '<rowBreaks count="1" manualBreakCount="1"><brk id="30" max="16383" man="1"/></rowBreaks>' : ""}<drawing r:id="rIdSummaryDrawing"/></worksheet>`);
  zip.file(`xl/worksheets/_rels/sheet${sheetId}.xml.rels`, `${declaration}<Relationships xmlns="${packageNs}"><Relationship Id="rIdSummaryDrawing" Type="${relNs}/drawing" Target="../drawings/valida-summary.xml"/></Relationships>`);
  zip.file("xl/drawings/valida-summary.xml", `${declaration}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>10</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>24</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="Komposisi masa berlaku"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${relNs}" r:id="rIdChart"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`);
  zip.file("xl/drawings/_rels/valida-summary.xml.rels", `${declaration}<Relationships xmlns="${packageNs}"><Relationship Id="rIdChart" Type="${relNs}/chart" Target="../charts/valida-validity.xml"/></Relationships>`);
  zip.file("xl/charts/valida-validity.xml", chartXml(data));
  workbook = workbook.replace(/localSheetId="(\d+)"/g, (_, n) => `localSheetId="${Number(n) + 1}"`)
    .replace(/activeTab="\d+"/g, 'activeTab="0"').replace(/firstSheet="\d+"/g, 'firstSheet="0"')
    .replace("<sheets>", `<sheets><sheet name="Ringkasan Manajemen" sheetId="${sheetId}" r:id="rIdValidaSummary"/>`);
  const area = `<definedName name="_xlnm.Print_Area" localSheetId="0">'Ringkasan Manajemen'!$B$2:$L$${lastRow}</definedName>`;
  workbook = workbook.includes("</definedNames>") ? workbook.replace("</definedNames>", `${area}</definedNames>`) : workbook.replace("</sheets>", `</sheets><definedNames>${area}</definedNames>`);
  zip.file("xl/workbook.xml", workbook);
  zip.file("xl/_rels/workbook.xml.rels", (await read("xl/_rels/workbook.xml.rels")).replace("</Relationships>", `<Relationship Id="rIdValidaSummary" Type="${relNs}/worksheet" Target="worksheets/sheet${sheetId}.xml"/></Relationships>`));
  const additions = [[`/${sheetPath}`, "spreadsheetml.worksheet"], ["/xl/drawings/valida-summary.xml", "drawing"], ["/xl/charts/valida-validity.xml", "drawingml.chart"]]
    .map(([path, type]) => `<Override PartName="${path}" ContentType="application/vnd.openxmlformats-officedocument.${type}+xml"/>`).join("");
  zip.file("[Content_Types].xml", (await read("[Content_Types].xml")).replace("</Types>", `${additions}</Types>`));
  for (const name of Object.keys(zip.files).filter(name => name !== sheetPath && /^xl\/worksheets\/sheet\d+\.xml$/.test(name)))
    zip.file(name, (await read(name)).replace(/tabSelected="1"/g, 'tabSelected="0"'));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
