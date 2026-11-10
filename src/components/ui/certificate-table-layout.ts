export function certificateFrozenColumn(entity: string, column: string) {
  const keys = entity === "sertifikat-klien"
    ? ["number", "selection", "validity_status", "expiry_date", "client_name"]
    : entity === "kompetensi-personil"
      ? ["number", "selection", "validity_status", "original_title", "employee_name"] : [];
  return keys.includes(column) ? column : undefined;
}

export function certificateColumnWidth(column: string) {
  const widths: Record<string, string> = {
    number: "var(--record-number)", selection: "var(--record-selection)",
    original_title: "var(--record-title)", employee_name: "var(--record-person)",
    validity_status: "var(--record-status)", expiry_date: "var(--record-date)",
    client_name: "var(--record-client)", actions: "10rem",
    certificate_number: "14rem", certificate_type_name: "14rem", object_type: "14rem",
  };
  return widths[column] || "10rem";
}
