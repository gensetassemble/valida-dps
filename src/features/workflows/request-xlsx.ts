import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { umaApproverTitle, umaSignatureDate } from "./uma-format";
import { addUmaAnnex } from "./uma-annex";
import { applyXlsxReadability } from "@/lib/xlsx-readability";
type Row = Record<string, unknown>;
const xmlText = (value: unknown) =>
  String(value ?? "")
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

/** Fill the native Excel-converted source without round-tripping styles, drawings or print settings. */
export async function calibrationRequestXlsx(request: Row) {
  const zip = await JSZip.loadAsync(
    await readFile(
      path.join(process.cwd(), "src/assets/forms/FOR-SCI-UMA-197-Rev-02.xlsx"),
    ),
  );
  const sheet = zip.file("xl/worksheets/sheet1.xml");
  if (!sheet) throw new Error("Template UMA tidak tersedia.");
  let xml = await sheet.async("string");
  const set = (cell: string, value: unknown) => {
    const re = new RegExp(
      `<c\\b([^>]*\\br="${cell}"[^>]*)(?:\\/>|>[\\s\\S]*?<\\/c>)`,
    );
    if (!re.test(xml))
      throw new Error(`Sel template UMA tidak ditemukan: ${cell}`);
    xml = xml.replace(
      re,
      (_match, attrs: string) =>
        `<c${attrs.replace(/\s+t="[^"]*"/g, "")} t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`,
    );
  };
  const e = (request.equipment_snapshot || {}) as Row;
  const items = Array.isArray(request.items_snapshot)
    ? (request.items_snapshot as Row[])
    : [];
  const bundled = items.length > 1;
  const field = (cell: string, value: unknown) => {
    if (value != null && value !== "") set(cell, "  : " + String(value));
  };
  set("A6", "No.   :  " + String(request.request_number || "……………………………………"));
  if (request.unit_name)
    set("F9", "Unit Kerja /Bagian   : " + request.unit_name);
  field("E15", e.name);
  field("E16", request.quantity || 1);
  field(
    "E17",
    [e.serial, e.asset_id || e.tag, e.location].filter(Boolean).join(" / "),
  );
  field(
    "E18",
    [e.brand, e.model, e.specification_size].filter(Boolean).join(" / "),
  );
  field("E19", e.measurement_range);
  field("E20", request.resolution_class);
  field("E21", request.notes);
  if (request.notes) set("E22", "");
  field("E23", request.request_kind === "repair" ? "Perbaikan" : "Kalibrasi");
  field("E24", request.laboratory);
  if (bundled) {
    field("E15", "Berbagai peralatan (terlampir)");
    field("E16", items.length + " unit");
    for (const cell of ["E17", "E18", "E19", "E20"]) field(cell, "Terlampir");
  } else if (items.length === 1) {
    field("E20", items[0].resolution_class || request.resolution_class);
  }
  // Keep the original dotted blanks in section B for manual completion; never export estimates.
  if (request.supervisor_name) set("B42", `(${request.supervisor_name})`);
  const supervisorTitle = String(
    request.supervisor_title || umaApproverTitle(request.supervisor_name),
  );
  if (supervisorTitle) set("B43", supervisorTitle);
  if (request.requester_name) set("G42", `(${request.requester_name})`);
  set("G43", "NPP.  " + String(request.requester_npp || "Non-NPP"));
  const date = umaSignatureDate(request.created_at, request.signature_place);
  if (date) {
    set("G36", date);
  }
  // The original cover uses text overflow across blank cells. Merge those intended
  // writing areas before wrapping, otherwise Excel confines labels to narrow cells.
  const writingAreas = [
    "A6:D6",
    "B7:D7",
    "A8:D8",
    "F8:H8",
    "A9:D10",
    "F9:H10",
    "B13:D13",
    "E13:H13",
    "B21:D22",
    "E21:H22",
    "B27:D27",
    "B29:D30",
    "E29:H30",
    "B31:D31",
    "E31:H31",
    "B32:D33",
    "E32:H33",
    "B36:D36",
    "G36:H36",
    "G37:H37",
    "B42:D42",
    "G42:H42",
    "B43:D43",
    "G43:H43",
    ...[15, 16, 17, 18, 19, 20, 23, 24].flatMap((r) => [
      `B${r}:D${r}`,
      `E${r}:H${r}`,
    ]),
  ];
  xml = xml.replace(
    /<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,
    (_, existing: string) =>
      `<mergeCells count="${2 + writingAreas.length}">${existing}${writingAreas.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`,
  );
  zip.file("xl/worksheets/sheet1.xml", xml);
  if (items.length) await addUmaAnnex(zip, request, items);
  await applyXlsxReadability(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
