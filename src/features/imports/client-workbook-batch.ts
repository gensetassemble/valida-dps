// One source explicitly authorized for operational import. Other production
// batches remain blocked by the existing development-only import action.
export function approvedClientWorkbook(batch: Record<string, unknown>) {
  return batch.id === "50b0a76a-bb9b-5e1a-ad78-039d6a750d5e" &&
    batch.branch_code === "DPS" && batch.domain === "clients" &&
    batch.source_count === 19 &&
    batch.file_hash === "cad16977f7e8c3fdf6b8ff56142ef2d90440b9609e3714de20947e516c574770";
}
