function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function calibrationRequestHtml(r: Record<string, unknown>) {
  const e = (r.equipment_snapshot || {}) as Record<string, unknown>,
    v = (x: unknown) => escapeHtml(x) || "…………………………………………………………";
  const line = (n: string, label: string, value: unknown) =>
    `<tr><td class="number">${n}</td><td>${escapeHtml(label)}</td><td>: ${v(value)}</td></tr>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FOR/SCI-UMA/197 — ${escapeHtml(r.request_number || "Draf")}</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font:12px Arial,sans-serif;color:#111;margin:0 auto;max-width:180mm;line-height:1.5}h1{font-size:16px;text-align:center;margin:18px 0 28px}table{width:100%;border-collapse:collapse}td{padding:6px 4px;vertical-align:top}.number{width:9%}td:nth-child(2){width:43%}.section{font-weight:bold;padding-top:22px}.sig{height:78px}.toolbar{margin:15px 0;padding:12px;background:#f0f4f8;display:flex;gap:20px}a,button{color:#102d50}footer{margin-top:26px;border-top:1px solid #555;font-size:10px;padding-top:5px}.note{font-size:10px}@media print{.toolbar{display:none}body{max-width:none}tr{break-inside:avoid}}</style></head><body>
 <div class="toolbar"><button onclick="window.print()">Cetak / Simpan PDF</button><a href="?id=${escapeHtml(r.id)}&download=1">Unduh formulir HTML</a></div>
 <h1>PERMINTAAN PERBAIKAN/KALIBRASI PERALATAN</h1><p>No. : ${v(r.request_number)}<br><span class="note">(diisi oleh pengguna)</span></p>
 <table><tr><td><b>KEPADA :</b><br>Fungsi Umum / PTK</td><td><b>DARI :</b><br>Unit Kerja / Bagian : ${v(r.unit_name)}</td></tr></table>
 <table><tr><td class="section">A.</td><td class="section" colspan="2">PERBAIKAN/KALIBRASI <span class="note">(diisi oleh Pengguna / User)</span></td></tr>
 ${line("1.0", "Nama Peralatan", e.name)}${line("2.0", "Jumlah Peralatan", r.quantity)}${line("3.0", "No. Seri / No. Inventaris / Lokasi", [e.serial, e.asset_id || e.tag, e.location].filter(Boolean).join(" / "))}${line("4.0", "Spesifikasi", [e.brand, e.model, e.specification_size].filter(Boolean).join(" / "))}${line("", "– Range / Kapasitas", e.measurement_range)}${line("", "– Resolusi / Klas", r.resolution_class)}${line("5.0", "Keterangan / Informasi lainnya", r.notes)}${line("6.0", "Jenis Perawatan", "Kalibrasi")}${line("7.0", "Lembaga Perbaikan / Kalibrasi*", r.laboratory)}
 <tr><td class="section">B.</td><td class="section" colspan="2">WAKTU &amp; BIAYA</td></tr>${line("1.0", "Perkiraan waktu penyelesaian", r.estimated_days == null ? null : r.estimated_days + " hari kerja")}${line("2.0", "Perkiraan biaya", r.estimated_cost == null ? null : "Rp. " + Number(r.estimated_cost).toLocaleString("id-ID"))}<tr><td></td><td colspan="2" class="note">(diisi oleh Fungsi Umum)</td></tr></table>
 <table style="margin-top:25px;text-align:center"><tr><td>Mengetahui,</td><td>……… / ……… / …………<br>Pengguna / Pengaju,</td></tr><tr><td class="sig"></td><td class="sig"></td></tr><tr><td>(${v(r.supervisor_name)})<br><span class="note">Kadiv/Kabag/Kabid/Kasubag/Kasubid**</span></td><td>(${v(r.requester_name)})<br>NPP. …………………</td></tr></table>
 <footer>FOR/SCI-UMA/197 · Rev. 02<span style="float:right">Halaman 1</span><p class="note">Formulir isian VALIDA mengikuti bagian A, B, dan blok tanda tangan pada template sumber. Nama tercetak bukan tanda tangan; cetak lalu lengkapi tanda tangan basah dan unggah PDF.</p></footer></body></html>`;
}
