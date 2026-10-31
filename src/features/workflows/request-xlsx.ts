import ExcelJS from "exceljs";
import path from "node:path";
import { draftBusinessDate } from "./request-form-model";
type Row = Record<string, unknown>;
export async function calibrationRequestXlsx(request: Row) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(
    path.join(process.cwd(), "src/assets/forms/FOR-SCI-UMA-197-Rev-02.xlsx"),
  );
  const s = book.worksheets[0],
    e = (request.equipment_snapshot || {}) as Row;
  const set = (cell: string, value: unknown) => {
    s.getCell(cell).value = value == null || value === "" ? null : String(value);
  };
  set("A6", "No. : " + String(request.request_number || ""));
  set("F9", "Unit Kerja / Bagian : " + String(request.unit_name || ""));
  set("E15", e.name);
  s.getCell("E16").value = Number(request.quantity || 1);
  set(
    "E17",
    [e.serial, e.asset_id || e.tag, e.location].filter(Boolean).join(" / "),
  );
  set(
    "E18",
    [e.brand, e.model, e.specification_size].filter(Boolean).join(" / "),
  );
  set("E19", e.measurement_range);
  set("E20", request.resolution_class);
  set("E21", request.notes);
  set("E23", request.request_kind === "repair" ? "Perbaikan" : "Kalibrasi");
  set("E24", request.laboratory);
  s.getCell("E29").value = null;
  s.getCell("E31").value = null;
  s.getCell("E32").value = null;
  set(
    "B42",
    request.supervisor_name
      ? `(${request.supervisor_name})`
      : "(................................)",
  );
  set("G42", `(${request.requester_name || ""})`);
  set("G43", "NPP. " + String(request.requester_npp || "Non-NPP"));
  const date = draftBusinessDate(request.created_at);
  if (date) {
    s.getCell("G36").value = new Date(date + "T00:00:00Z");
    s.getCell("G36").numFmt = "dd/mm/yyyy";
  }
  s.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    printArea: "A1:H44",
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.3,
      bottom: 0.3,
      header: 0.1,
      footer: 0.1,
    },
  };
  s.views = [{ showGridLines: false }];
  book.creator = "VALIDA";
  return book.xlsx.writeBuffer();
}
