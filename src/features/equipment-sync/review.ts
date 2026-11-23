import type { SyncRow } from "./parser";

export type EquipmentSyncOutcome = {
  sheet: string;
  row: number;
  name: string;
  tag: string;
  equipment_id: string;
  equipment: string;
  calibration: string;
  match?: string;
};

export type CurrentCalibration = {
  equipment_id: string;
  component_label?: string | null;
  certificate_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
};

export type ImportChange = {
  field: "certificate_number" | "issue_date" | "due_date" | "calibration";
  label: string;
  before: string | null;
  after: string | null;
};

export type EquipmentImportPreviewRow = EquipmentSyncOutcome & {
  reviewKey: string;
  changes: ImportChange[];
  requiresReview: boolean;
};

const identity = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("id")
    .replace(/[^a-z0-9]/g, "");

function inferredComponent(row: SyncRow) {
  if (row.calibration.component_label)
    return String(row.calibration.component_label);
  if (!/rotameter/i.test(row.name)) return "";
  const match = String(row.calibration.certificate_number || "").match(
    /^\s*K\s*-\s*\d+\s*([A-Z])\s*\//i,
  );
  return match ? `Katup ${match[1].toUpperCase()}` : "";
}

function currentForRow(
  row: SyncRow,
  outcome: EquipmentSyncOutcome,
  current: CurrentCalibration[],
) {
  const candidates = current.filter(
    (item) => item.equipment_id === outcome.equipment_id,
  );
  const certificate = identity(row.calibration.certificate_number);
  if (certificate) {
    const exact = candidates.find(
      (item) => identity(item.certificate_number) === certificate,
    );
    if (exact) return exact;
  }
  const component = identity(inferredComponent(row));
  if (component) {
    const exact = candidates.find(
      (item) => identity(item.component_label) === component,
    );
    if (exact) return exact;
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function buildEquipmentImportPreview(
  rows: SyncRow[],
  outcomes: EquipmentSyncOutcome[],
  current: CurrentCalibration[],
): EquipmentImportPreviewRow[] {
  return outcomes.map((outcome, index) => {
    const row =
      rows.find(
        (candidate) =>
          candidate.sheet === outcome.sheet && candidate.row === outcome.row,
      ) || rows[index];
    const existing = row ? currentForRow(row, outcome, current) : undefined;
    const changes: ImportChange[] = [];
    const compare = (
      field: "certificate_number" | "issue_date" | "due_date",
      label: string,
    ) => {
      if (!row || !(field in row.calibration)) return;
      const before = existing?.[field] == null ? null : String(existing[field]);
      const after =
        row.calibration[field] == null ? null : String(row.calibration[field]);
      if (before !== after) changes.push({ field, label, before, after });
    };
    compare("certificate_number", "Nomor sertifikat");
    compare("issue_date", "Tanggal terbit / kalibrasi");
    compare("due_date", "Tanggal berakhir");
    if (outcome.calibration === "added" && !changes.length)
      changes.push({
        field: "calibration",
        label: "Peristiwa kalibrasi",
        before: null,
        after: "Peristiwa baru",
      });
    const certificate = row?.calibration.certificate_number || "tanpa-sertifikat";
    return {
      ...outcome,
      reviewKey: `${outcome.sheet}:${outcome.row}:${String(certificate)}`,
      changes,
      requiresReview: outcome.calibration === "added" || changes.length > 0,
    };
  });
}
