import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { draftBusinessDate } from "./request-form-model";
type Row = Record<string, unknown>;
const xmlText = (value: unknown) =>
  String(value ?? "")
    .split("")
    .filter((c) => c.charCodeAt(0) >= 32 || [9, 10, 13].includes(c.charCodeAt(0)))
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
  // Keep the original dotted blanks in section B for manual completion; never export estimates.
  if (request.supervisor_name) set("B42", `(${request.supervisor_name})`);
  if (request.requester_name) set("G42", `(${request.requester_name})`);
  set("G43", "NPP.  " + String(request.requester_npp || "Non-NPP"));
  const date = draftBusinessDate(request.created_at);
  if (date) {
    const [y, m, d] = date.split("-");
    set("G36", `${d} / ${m} / ${y}`);
  }
  zip.file("xl/worksheets/sheet1.xml", xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
