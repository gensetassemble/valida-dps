import { z } from "zod";

export function portfolioIds(value: string) {
  if (value.length > 4000) throw Error("Terlalu banyak portofolio.");
  return [...new Set(z.array(z.uuid()).min(1).max(100).parse(value.split(",")))];
}

export function equipmentExportQuery(source: URLSearchParams, mode: "all" | "selected", ids: string[]) {
  const next = new URLSearchParams(source);
  for (const key of ["portfolio", "portfolios", "page", "portfolio_selection"])
    next.delete(key);
  next.set("entity", "kalibrasi-alat");
  next.set("portfolio_selection", mode);
  if (mode === "selected") next.set("portfolios", portfolioIds(ids.join(",")).join(","));
  return next;
}

// Explicit export scope replaces the table's single-portfolio filter only.
export function normalizeEquipmentExport(source: URLSearchParams) {
  const mode = source.get("portfolio_selection");
  if (mode === null) return new URLSearchParams(source);
  if (mode !== "all" && mode !== "selected") throw Error("Pilihan ekspor tidak valid.");
  return equipmentExportQuery(source, mode, mode === "selected" ? portfolioIds(source.get("portfolios") || "") : []);
}
