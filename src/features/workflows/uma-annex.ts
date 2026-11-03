import type JSZip from "jszip";
import { umaApproverTitle, umaSignatureDate } from "./uma-format";
type Row = Record<string, unknown>;
export const xmlText = (v: unknown) =>
  String(v ?? "")
    .split("")
    .filter(
      (c) => c.charCodeAt(0) >= 32 || [9, 10, 13].includes(c.charCodeAt(0)),
    )
    .join("")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Add the landscape attachment while keeping the source cover's styles/drawings intact. */
export async function addUmaAnnex(zip: JSZip, request: Row, items: Row[]) {
  let styles = await zip.file("xl/styles.xml")!.async("string");
  function append(tag: string, entries: string[]) {
    const re = new RegExp(
      "<" + tag + '\\b([^>]*count="(\\d+)"[^>]*)>([\\s\\S]*?)</' + tag + ">",
    );
    const match = styles.match(re);
    if (!match) throw Error("Style template UMA tidak lengkap.");
    const start = Number(match[2]);
    styles = styles.replace(
      re,
      () =>
        "<" +
        tag +
        match[1].replace(
          /count="\d+"/,
          'count="' + (start + entries.length) + '"',
        ) +
        ">" +
        match[3] +
        entries.join("") +
        "</" +
        tag +
        ">",
    );
    return start;
  }
  const font = append("fonts", [
    '<font><sz val="10"/><name val="Arial"/></font>',
    '<font><b/><sz val="10"/><name val="Arial"/></font>',
    '<font><b/><sz val="13"/><name val="Arial"/></font>',
  ]);
  const border = append("borders", [
    '<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>',
  ]);
  const base = append("cellXfs", [
    `<xf numFmtId="0" fontId="${font}" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
    `<xf numFmtId="0" fontId="${font + 2}" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`,
    `<xf numFmtId="0" fontId="${font + 1}" fillId="0" borderId="${border}" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`,
    `<xf numFmtId="0" fontId="${font}" fillId="0" borderId="${border}" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`,
  ]);
  const cells = (n: number, values: unknown[], style = base) =>
    values
      .map(
        (v, i) =>
          `<c r="${String.fromCharCode(65 + i)}${n}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlText(v)}</t></is></c>`,
      )
      .join("");
  const rows: string[] = [];
  const merges: string[] = [];
  function row(n: number, values: unknown[], height: number, style = base) {
    rows.push(
      `<row r="${n}" ht="${height}" customHeight="1">${cells(n, values, style)}</row>`,
    );
  }
  row(1, ["LAMPIRAN PERMOHONAN KALIBRASI PERALATAN"], 24, base + 1);
  merges.push("A1:J1");
  row(2, ["Unit Kerja: " + String(request.unit_name || "Cab Denpasar")], 18);
  merges.push("A2:J2");
  row(3, ["Nomor: " + String(request.request_number || "")], 18);
  merges.push("A3:J3");
  row(
    4,
    [
      "No.",
      "Nama",
      "Tag-number",
      "Spesifikasi",
      "",
      "",
      "",
      "Nama di Sertifikat Kalibrasi",
      "Alamat di Sertifikat Kalibrasi",
      "Keterangan / Instrument Reading",
    ],
    26,
    base + 2,
  );
  row(
    5,
    ["", "", "", "Merk/Type", "Serial Number", "Warna", "Ukuran", "", "", ""],
    28,
    base + 2,
  );
  merges.push("A4:A5", "B4:B5", "C4:C5", "D4:G4", "H4:H5", "I4:I5", "J4:J5");
  let n = 6;
  const widths = [5, 22, 20, 18, 19, 12, 24, 25, 35, 32];
  // Wrap explicitly at conservative column widths and split long readings across rows.
  // Excel limits row height to 409 points: continuing rows preserve every test point.
  function lines(v: unknown, width: number) {
    return String(v ?? "")
      .split(/\r?\n/)
      .flatMap((line) => {
        const out = [];
        while (line.length > width) {
          let pos = line.lastIndexOf(" ", width);
          if (pos < width / 2) pos = width;
          out.push(line.slice(0, pos));
          line = line.slice(pos).trimStart();
        }
        return [...out, line];
      });
  }
  items.forEach((e, index) => {
    const values = [
      index + 1,
      e.name,
      e.tag || e.asset_id,
      [e.brand, e.model].filter(Boolean).join(" / "),
      e.serial,
      e.color,
      e.measurement_range || e.specification_size,
      request.certificate_name || "PT SUCOFINDO Cabang Denpasar",
      request.certificate_address || "",
      [
        e.resolution_class ? "Resolusi / kelas: " + e.resolution_class : "",
        e.instrument_reading,
      ]
        .filter(Boolean)
        .join("\n"),
    ];
    const wrapped = values.map((v, i) => lines(v, Math.max(4, widths[i] - 3)));
    const count = Math.max(...wrapped.map((v) => v.length));
    for (let offset = 0; offset < count; offset += 22) {
      const content = wrapped.map((v) =>
        v.slice(offset, offset + 22).join("\n"),
      );
      if (offset) {
        content[0] = String(index + 1);
        content[1] = String(e.name || "") + " (lanjutan)";
      }
      row(
        n++,
        content,
        Math.max(64, Math.min(22, count - offset) * 13 + 12),
        base + 3,
      );
    }
  });
  n++;
  row(
    n,
    [
      "Mengetahui,",
      "",
      "",
      "",
      "",
      "",
      umaSignatureDate(request.created_at, request.signature_place) || "",
    ],
    20,
  );
  merges.push(`A${n}:E${n}`, `G${n}:J${n}`);
  row(n + 1, ["", "", "", "", "", "", "Penanggung jawab alat,"], 18);
  merges.push(`G${n + 1}:J${n + 1}`);
  row(n + 2, [], 52);
  row(
    n + 3,
    [
      String(request.supervisor_name || ""),
      "",
      "",
      "",
      "",
      "",
      String(request.requester_name || ""),
    ],
    18,
  );
  merges.push(`A${n + 3}:E${n + 3}`, `G${n + 3}:J${n + 3}`);
  row(
    n + 4,
    [
      request.supervisor_title || umaApproverTitle(request.supervisor_name),
      "",
      "",
      "",
      "",
      "",
      "NPP. " + String(request.requester_npp || "Non-NPP"),
    ],
    30,
  );
  merges.push(`A${n + 4}:E${n + 4}`, `G${n + 4}:J${n + 4}`);
  const last = n + 4;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:J${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;RHalaman &amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
  zip.file("xl/styles.xml", styles);
  let book = await zip.file("xl/workbook.xml")!.async("string");
  const rel = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const relId =
    "rId" +
    (Math.max(...[...rel.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))) +
      1);
  const sheetId =
    Math.max(
      ...[...book.matchAll(/sheetId="(\d+)"/g)].map((m) => Number(m[1])),
    ) + 1;
  book = book.replace(
    "</sheets>",
    `<sheet name="Lampiran Alat" sheetId="${sheetId}" r:id="${relId}"/></sheets>`,
  );
  zip.file(`xl/worksheets/sheet${sheetId}.xml`, xml);
  const names = `<definedName name="_xlnm.Print_Area" localSheetId="${sheetId - 1}">'Lampiran Alat'!$A$1:$J$${last}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="${sheetId - 1}">'Lampiran Alat'!$1:$5</definedName>`;
  book = book.includes("</definedNames>")
    ? book.replace("</definedNames>", names + "</definedNames>")
    : book.replace(
        "</sheets>",
        "</sheets><definedNames>" + names + "</definedNames>",
      );
  zip.file("xl/workbook.xml", book);
  zip.file(
    "xl/_rels/workbook.xml.rels",
    rel.replace(
      "</Relationships>",
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetId}.xml"/></Relationships>`,
    ),
  );
  const types = await zip.file("[Content_Types].xml")!.async("string");
  zip.file(
    "[Content_Types].xml",
    types.replace(
      "</Types>",
      `<Override PartName="/xl/worksheets/sheet${sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
  );
}
