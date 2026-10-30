import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type Row = Record<string, unknown>;

/** Wrap by measured glyph width, including identifiers without spaces. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const character of paragraph) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        const space = line.lastIndexOf(" ");
        if (space > 0) {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1) + character;
        } else {
          lines.push(line);
          line = character;
        }
      } else line += character;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function calibrationRequestFilename(request: Row) {
  const reference = String(request.request_number || request.id || "draf")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .slice(0, 64);
  return `FOR-SCI-UMA-197-${reference}.pdf`;
}

export async function calibrationRequestPdf(request: Row): Promise<Uint8Array> {
  const [templateBytes, fontBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "src/assets/forms/FOR-SCI-UMA-197-Rev-02.pdf")),
    readFile(path.join(process.cwd(), "src/assets/fonts/Vera.ttf")),
  ]);
  const template = await PDFDocument.load(templateBytes);
  const pdf = await PDFDocument.create();
  const [page] = await pdf.copyPages(template, [0]);
  pdf.addPage(page);
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const printable = (value: unknown) => Array.from(String(value ?? "")
    .replace(/\r\n?/g, "\n").replace(/\t/g, " "))
    .filter((c) => c === "\n" || c.codePointAt(0)! >= 32)
    .map((c) => c === "\n" || supported.has(c.codePointAt(0)!) ? c : `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`).join("");
  const equipment = (request.equipment_snapshot || {}) as Row;
  const overflow: { label: string; value: string }[] = [];
  const size = 9.1, leading = 12;
  function write(target: PDFPage, text: string, x: number, top: number, fontSize = size) {
    target.drawText(text, { x, y: target.getHeight() - top - fontSize, size: fontSize, font, color: rgb(0.03, 0.03, 0.03) });
  }
  function slot(label: string, value: unknown, x: number, top: number, width: number, maxLines = 1) {
    const text = printable(value).trim();
    if (!text) return; // Preserve unfilled lines; never fabricate optional amounts or dates.
    let lines = wrap(text, font, size, width - 4);
    if (lines.length > maxLines) {
      overflow.push({ label, value: text });
      lines = [`Lihat lampiran ${overflow.length}`];
    }
    page.drawRectangle({ x: x - 1, y: page.getHeight() - top - maxLines * leading, width: width + 1, height: maxLines * leading + 1, color: rgb(1, 1, 1) });
    lines.forEach((line, i) => write(page, line, x + 1, top + i * leading));
  }
  slot("Nomor permintaan", request.request_number, 66, 108.3, 270);
  slot("Unit kerja / bagian", request.unit_name, 447.5, 153.9, 126);
  const field = (label: string, value: unknown, top: number, lines = 1) => slot(label, value, 294, top, 279, lines);
  field("Nama peralatan", equipment.name, 240);
  field("Jumlah peralatan", request.quantity, 254.2);
  field("No. seri / inventaris / lokasi", [equipment.serial, equipment.asset_id || equipment.tag, equipment.location].filter(Boolean).join(" / "), 268.4);
  field("Spesifikasi", [equipment.brand, equipment.model, equipment.specification_size].filter(Boolean).join(" / "), 282.6);
  field("Range / kapasitas", equipment.measurement_range, 296.8);
  field("Resolusi / kelas", request.resolution_class, 311);
  field("Keterangan / informasi lainnya", request.notes, 325.2, 2);
  field("Jenis perawatan", "Kalibrasi", 353.6);
  field("Lembaga kalibrasi", request.laboratory, 367.8);
  slot("Perkiraan waktu penyelesaian", request.estimated_days == null ? null : `${request.estimated_days} hari kerja`, 292, 439.6, 281);
  slot("Perkiraan biaya", request.estimated_cost == null ? null : `Rp. ${Number(request.estimated_cost).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`, 292, 468, 281);
  slot("Nama Kabid / pejabat mengetahui", request.supervisor_name ? `(${request.supervisor_name})` : null, 59.6, 624.3, 210);
  slot("Nama pengaju / pengguna", request.requester_name ? `(${request.requester_name})` : null, 394.9, 624.3, 178);

  // Long values receive additional pages instead of being clipped or overlapping.
  if (overflow.length) {
    let appendix: PDFPage;
    let top = 0;
    function newAppendix() {
      appendix = pdf.addPage([595.2, 841.8]);
      write(appendix, "LAMPIRAN ISIAN FOR/SCI-UMA/197", 36, 36, 12);
      write(appendix, wrap(printable(request.request_number || "Draf"), font, size, 519)[0], 36, 56);
      top = 85;
    }
    newAppendix();
    for (const [index, item] of overflow.entries()) {
      if (top > 745) newAppendix();
      write(appendix!, `${index + 1}. ${item.label}`, 36, top, 10);
      top += 19;
      for (const line of wrap(item.value, font, 10, 519)) {
        if (top > 770) newAppendix();
        write(appendix!, line, 40, top, 10);
        top += 14;
      }
      top += 15;
    }
    pdf.getPages().forEach((p, i) => {
      p.drawRectangle({ x: 466, y: 12, width: 112, height: 20, color: rgb(1, 1, 1) });
      p.drawText(`Hal ${i + 1} dari ${pdf.getPageCount()} Hal`, { x: 470, y: 17, size: 8, font });
    });
  }
  pdf.setTitle(`FOR/SCI-UMA/197 - ${printable(request.request_number || "Draf")}`);
  pdf.setAuthor("PT SUCOFINDO Cabang Denpasar");
  pdf.setCreator("VALIDA");
  return pdf.save();
}
