export async function boundedForm(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw Error("Ukuran unggah melampaui batas.");
  const reader = request.body?.getReader();
  if (!reader) throw Error("Isi unggah tidak tersedia.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw Error("Ukuran unggah melampaui batas.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {
    body.set(part, offset);
    offset += part.length;
  }
  return new Request(request.url, {
    method: "POST",
    headers: { "Content-Type": request.headers.get("content-type") || "" },
    body,
  }).formData();
}
