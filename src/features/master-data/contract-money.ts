// Keep NUMERIC(20,2) values as strings: Number would round large contracts.
export function contractDisplay(value: unknown) {
  const raw = String(value ?? "");
  if (!/^\d{1,18}(\.\d{1,2})?$/.test(raw)) return raw;
  const [whole, fraction = ""] = raw.split(".");
  return "IDR " + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    (Number(fraction) ? "," + fraction.padEnd(2, "0") : ",-");
}
export function contractInput(value: string) {
  const raw = value.trim().replace(/^(?:IDR|Rp)\s*/i, "").replace(/,-$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw) || /^\d+(,\d{1,2})?$/.test(raw))
    return raw.replaceAll(".", "").replace(",", ".");
  return raw; // Invalid values remain visible and are rejected by the schema.
}

// Only numeric drafts reach the controlled input; formatted pasted amounts
// are reduced to digits and a decimal comma without converting to Number.
export function contractNumericDraft(value: string): string | null {
  const parsed = contractInput(value);
  return /^(?:\d{1,18}(?:[.,]\d{0,2})?|)$/.test(parsed)
    ? parsed.replace(".", ",")
    : null;
}
