export type ExpiringItem = {
  domain: string;
  id: string;
  entity_name: string;
  title: string | null;
  expiry_date: string;
  validity_status: string;
  is_example: boolean;
  portfolio_code?: string | null;
  location?: string | null;
  reference_number?: string | null;
  certificate_kind?: string | null;
  responsible_id?: string | null;
  responsible_name?: string | null;
};
export const PRIORITY_CATEGORIES: Record<
  string,
  { label: string; className: string }
> = {
  calibrations: {
    label: "Kalibrasi Alat",
    className: "bg-teal-50 text-teal-800 ring-teal-200",
  },
  personnel: {
    label: "Kompetensi Personil",
    className: "bg-purple-50 text-purple-800 ring-purple-200",
  },
  clients: {
    label: "Sertifikat Klien",
    className: "bg-blue-50 text-blue-800 ring-blue-200",
  },
};
export function filterPriorities(
  items: ExpiringItem[],
  query: string,
  domain: string,
  portfolio: string,
) {
  const terms = query
    .toLocaleLowerCase("id")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return items.filter(
    (item) =>
      (!domain || item.domain === domain) &&
      (!portfolio || item.portfolio_code === portfolio) &&
      terms.every((term) =>
        [
          item.entity_name,
          item.title,
          item.reference_number,
          item.certificate_kind,
          item.responsible_name,
          item.portfolio_code,
          item.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("id")
          .includes(term),
      ),
  );
}
