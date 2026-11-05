// These are database columns, never raw URL input. Ordering happens before range().
export function operationalOrder(entity: string, sort?: string, dir?: string) {
  if (!["kalibrasi-alat", "kompetensi-personil"].includes(entity)) return null;
  const equipment = entity === "kalibrasi-alat";
  const date = equipment ? "latest_due_date" : "expiry_date";
  const name = equipment ? "name" : "original_title";
  const column = sort === "alphabet" ? name
    : sort === "portfolio" ? (equipment ? "portfolio_code" : "portfolio_sort_key")
    : sort === "employee" && !equipment ? "employee_name"
    : (sort === "unit" || sort === "owner_unit") && equipment ? "owner_unit"
    : !sort || sort === "priority" ? "validity_priority" : null;
  if (!column) return null; // Keep existing table column sorting.
  const ascending = column === "validity_priority" || dir !== "desc";
  return [
    { column, ascending },
    ...(column === "validity_priority" ? [{ column: date, ascending: true }] : []),
    ...(column !== name ? [{ column: name, ascending: true }] : []),
  ];
}
