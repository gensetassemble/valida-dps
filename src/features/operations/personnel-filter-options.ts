export const personnelFilterOptions = [
  {
    key: "validity",
    label: "Masa berlaku",
    options: [
      ["", "Semua masa berlaku"],
      ["Expired", "Expired"],
      ["Kritis", "Kritis"],
      ["Perhatian", "Perhatian"],
      ["Pantau", "Pantau"],
      ["Aman", "Aman"],
      ["Tanggal Belum Diisi", "Tanggal belum diisi"],
      ["Berlaku Seumur Hidup", "Berlaku seumur hidup"],
    ],
  },
  {
    key: "kind",
    label: "Jenis masa berlaku",
    options: [
      ["", "Semua jenis"],
      ["term", "Berjangka"],
      ["lifetime", "Seumur hidup"],
    ],
  },
  {
    key: "active",
    label: "Status rekaman",
    options: [
      ["", "Semua rekaman"],
      ["true", "Aktif"],
      ["false", "Nonaktif"],
    ],
  },
] as const;
export function personnelFilterQuery(
  search: string,
  key: string,
  value: string,
) {
  const next = new URLSearchParams(search);
  next.delete("page");
  if (next.get("filter") === "validity_kind") {
    const legacy = next.get("value");
    if (!next.has("kind") && (legacy === "term" || legacy === "lifetime"))
      next.set("kind", legacy);
    next.delete("filter");
    next.delete("value");
  }
  if (value) next.set(key, value);
  else next.delete(key);
  // A lifetime-only selection cannot also match a term-only validity bucket.
  if (key === "kind" && value === "lifetime") next.delete("validity");
  if (key === "validity" && value) {
    if (value === "Berlaku Seumur Hidup") next.set("kind", "lifetime");
    else if (next.get("kind") === "lifetime") next.delete("kind");
  }
  if (
    key === "kind" &&
    value === "term" &&
    next.get("validity") === "Berlaku Seumur Hidup"
  )
    next.delete("validity");
  return next;
}
