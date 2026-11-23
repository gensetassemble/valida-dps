import "server-only";

export const OLE_WORKBOOK_MAGIC = "d0cf11e0a1b11ae1";

export function isOleWorkbook(bytes: Buffer) {
  return bytes.subarray(0, 8).toString("hex") === OLE_WORKBOOK_MAGIC;
}
export function isZipWorkbook(bytes: Buffer) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2])
  );
}

export function checkZip(bytes: Buffer) {
  // Read central-directory declared sizes before ExcelJS or SheetJS allocates
  // decompressed workbook parts. Entry names remain visible in the directory.
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > bytes.length)
    throw Error("Arsip Excel tidak valid.");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16),
    size = 0;
  if (count > 1000 || count === 65535) throw Error("Berkas Excel terlalu kompleks.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw Error("Direktori berkas Excel tidak valid.");
    const expanded = bytes.readUInt32LE(offset + 24),
      len = bytes.readUInt16LE(offset + 28),
      extra = bytes.readUInt16LE(offset + 30),
      comment = bytes.readUInt16LE(offset + 32);
    size += expanded;
    if (
      size > 20 * 1024 * 1024 ||
      expanded === 0xffffffff ||
      bytes.readUInt16LE(offset + 8) & 1
    )
      throw Error("Berkas Excel terkompresi berlebihan atau terenkripsi.");
    const entry = bytes.subarray(offset + 46, offset + 46 + len).toString();
    if (/vbaProject|\.\./i.test(entry))
      throw Error("Makro atau path berbahaya pada berkas Excel ditolak.");
    offset += 46 + len + extra + comment;
  }
}

