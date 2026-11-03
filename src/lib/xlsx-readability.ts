import JSZip from "jszip";

function attribute(xml: string, name: string, fallback = "") {
  return xml.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? fallback;
}
function decode(value: string) {
  return value
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) =>
      String.fromCodePoint(
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : Number(code),
      ),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
function text(xml: string) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => decode(m[1]))
    .join("");
}
function columnNumber(letters: string) {
  return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
}
/** Conservative line estimate includes padding and proportional-font / word-break slack. */
export function wrappedLineCount(value: string, width: number, fontSize = 11) {
  const capacity = Math.max(2, ((width - 2) * 11) / fontSize);
  return value
    .split(/\r?\n/)
    .reduce(
      (total, line) =>
        total +
        Math.max(
          1,
          Math.ceil(
            ([...line].reduce(
              (n, c) =>
                n + (/[MW@%]/.test(c) ? 1.5 : /[il.,' ]/.test(c) ? 0.5 : 1),
              0,
            ) *
              1.12) /
              capacity,
          ),
        ),
      0,
    );
}
type RowRanges = Record<string, { first: number; last: number }>;
/** Wrap selected table rows and fit their heights; preserve native layout outside the range. */
export async function applyXlsxReadability(zip: JSZip, ranges?: RowRanges) {
  const file = zip.file("xl/styles.xml");
  if (!file) return;
  let styles = await file.async("string");
  const fonts = [
    ...(styles.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/)?.[1] || "").matchAll(
      /<font\b[^>]*>[\s\S]*?<\/font>/g,
    ),
  ].map((m) => Number(m[0].match(/<sz\b[^>]*val="([^"]+)"/)?.[1] || 11));
  const sizes: number[] = [];
  let originalStyleCount = 0;
  styles = styles.replace(
    /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/,
    (whole, body: string) => {
      const wrapped = body.replace(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g, (xf) => {
          sizes.push(fonts[Number(attribute(xf, "fontId", "0"))] || 11);
          let open = xf
            .match(/^<xf\b[^>]*?\/?>/)![0]
            .replace(/\s+applyAlignment="[^"]*"/g, "")
            .replace(/\/?>(?=$)/, ' applyAlignment="1">');
          const inside = xf.endsWith("/>")
            ? ""
            : xf.slice(xf.indexOf(">") + 1, -5);
          const alignment = inside.match(/<alignment\b[^>]*\/?>/);
          const wrapped = alignment
            ? inside.replace(
                alignment[0],
                alignment[0]
                  .replace(/\s+(?:wrapText|shrinkToFit)="[^"]*"/g, "")
                  .replace(/\/?>(?=$)/, ' wrapText="1"/>'),
              )
            : inside + '<alignment wrapText="1"/>';
          open += wrapped + "</xf>";
          return open;
        });
      originalStyleCount = sizes.length;
      if (!ranges) return whole.replace(body, wrapped);
      // Shared styles may also be used by the title or signature. Clone instead
      // of changing those original styles in place.
      sizes.push(...sizes);
      return whole.replace(body, body + wrapped).replace(/\bcount="\d+"/, `count="${originalStyleCount * 2}"`);
    },
  );
  zip.file("xl/styles.xml", styles);
  const sharedFile = zip.file("xl/sharedStrings.xml");
  const shared = sharedFile
    ? [
        ...(await sharedFile.async("string")).matchAll(
          /<si\b[^>]*>([\s\S]*?)<\/si>/g,
        ),
      ].map((m) => text(m[1]))
    : [];
  for (const name of Object.keys(zip.files).filter((n) =>
    /^xl\/worksheets\/sheet\d+\.xml$/.test(n),
  )) {
    const range = ranges?.[name];
    if (ranges && !range) continue;
    let xml = await zip.file(name)!.async("string");
    if (range)
      xml = xml.replace(/<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (row, n: string) => {
        if (+n < range.first || +n > range.last) return row;
        return row.replace(/<c\b[^>]*\/?>/g, (cell) => {
          const index = Number(attribute(cell, "s", "0")) + originalStyleCount;
          return cell.replace(/\s+s="[^"]*"/, "").replace(/(\/?>)$/, ` s="${index}"$1`);
        });
      });
    const widths = new Map<number, number>();
    for (const m of xml.matchAll(/<col\b[^>]*\/>/g))
      for (
        let c = Number(attribute(m[0], "min"));
        c <= Number(attribute(m[0], "max"));
        c++
      )
        widths.set(c, Number(attribute(m[0], "width", "12")));
    const merges = new Map<string, { endCol: number; endRow: number }>();
    for (const m of xml.matchAll(
      /<mergeCell\b[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g,
    ))
      merges.set(m[1] + m[2], {
        endCol: columnNumber(m[3]),
        endRow: Number(m[4]),
      });
    const rows = [
      ...xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g),
    ].map((m) => ({ n: Number(m[1]), xml: m[0] }));
    const heights = new Map(
      rows.map((r) => [
        r.n,
        Number(attribute(r.xml.match(/^<row[^>]*>/)![0], "ht", "15")),
      ]),
    );
    for (const row of rows) {
      if (range && (row.n < range.first || row.n > range.last)) continue;
      for (const m of row.xml.matchAll(
        /<c\b([^>]*?\br="([A-Z]+)(\d+)"[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        if (!m[4]) continue;
        const value =
          attribute(m[1], "t") === "s"
            ? shared[Number(m[4].match(/<v>([^<]*)<\/v>/)?.[1])]
            : text(m[4]);
        if (!value) continue;
        const startCol = columnNumber(m[2]),
          merge = merges.get(m[2] + m[3]);
        let width = 0;
        for (let c = startCol; c <= (merge?.endCol || startCol); c++)
          width += widths.get(c) || 12;
        const size = sizes[Number(attribute(m[1], "s", "0"))] || 11;
        const needed = wrappedLineCount(value, width, size) * (size * 1.4) + 8;
        const end = merge?.endRow || row.n,
          span = end - row.n + 1;
        let available = 0;
        for (let r = row.n; r <= end; r++) available += heights.get(r) || 15;
        if (needed > available)
          for (let r = row.n; r <= end; r++)
            heights.set(
              r,
              Math.min(
                409,
                (heights.get(r) || 15) + (needed - available) / span,
              ),
            );
      }
    }
    xml = xml.replace(
      /<row\b[^>]*\br="(\d+)"[^>]*?\/?>/g,
      (open, n: string) => {
        if (
          (heights.get(Number(n)) || 15) <= Number(attribute(open, "ht", "15"))
        )
          return open;
        return open
          .replace(/\s+(?:ht|customHeight)="[^"]*"/g, "")
          .replace(
            /(\/?>)$/,
            (end: string) =>
              ` ht="${Math.ceil((heights.get(Number(n)) || 15) * 10) / 10}" customHeight="1"${end}`,
          );
      },
    );
    zip.file(name, xml);
  }
}
export async function readableXlsx(bytes: Uint8Array | ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes);
  await applyXlsxReadability(zip);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
