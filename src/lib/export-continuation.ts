/** Excel limits one row to 409 points. Long table content continues on extra rows. */
export function exportContinuationRows<T>(
  values: T[],
  widths: number[],
): T[][] {
  const lines = values.map((value, index) => {
    const v = value as unknown;
    const raw =
      typeof v === "string"
        ? v
        : v && typeof v === "object" && "text" in v
          ? String(v.text)
          : null;
    if (raw === null) return null;
    const capacity = Math.max(4, Math.floor((widths[index] - 3) * 0.8));
    return raw.split(/\r?\n/).flatMap((line) => {
      const chars = [...line],
        out: string[] = [];
      do {
        out.push(chars.splice(0, capacity).join(""));
      } while (chars.length);
      return out;
    });
  });
  const count = Math.max(
    1,
    ...lines.map((v) => Math.ceil((v?.length || 1) / 22)),
  );
  if (count === 1) return [values];
  return Array.from({ length: count }, (_, part) =>
    values.map((value, index) => {
      const content = lines[index]
        ?.slice(part * 22, (part + 1) * 22)
        .join("\n");
      if (content === undefined) return part === 0 ? value : (null as T);
      if (value && typeof value === "object" && "text" in value)
        return { ...value, text: content } as T;
      return content as T;
    }),
  );
}
