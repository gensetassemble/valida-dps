import { remainingDays, validDate } from "@/lib/domain/validity";

export const EMAIL_SIGNATURE = "Hormat kami,\n\nBidang Penjualan dan Dukungan Operasi\nPT SUCOFINDO Cabang Denpasar";
export const EMAIL_TEST_NOTICE = "[UJI INTERNAL — SIMULASI PENGIRIMAN EMAIL VALIDA, BUKAN PENAWARAN RESMI]";
export const EMAIL_TEST_DISCLAIMER = "Email ini merupakan simulasi pengujian internal sistem VALIDA dan bukan pemberitahuan atau penawaran resmi kepada pelanggan.";
export const EMAIL_PLACEHOLDERS = ["nama_pic_pelanggan", "sapaan_pic", "nama_pelanggan", "nama_layanan", "jenis_sertifikat", "objek_pekerjaan", "nomor_seri_objek", "nomor_sertifikat", "lokasi_pekerjaan", "tanggal_berakhir", "sisa_hari", "kalimat_masa_berlaku"] as const;
export type EmailTemplate = { subject: string; body: string; version: number };
export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  version: 0,
  subject: "Konfirmasi Kebutuhan Perpanjangan Layanan {nama_layanan} – {nama_pelanggan}",
  body: `Yth. {sapaan_pic},

Dengan hormat,

Sehubungan dengan pemantauan masa berlaku sertifikat atas layanan yang sebelumnya dilaksanakan oleh PT SUCOFINDO Cabang Denpasar, bersama ini kami bermaksud melakukan koordinasi awal terkait kebutuhan perpanjangan layanan {nama_layanan} dengan rincian sebagai berikut:

Pelanggan: {nama_pelanggan}
Jenis layanan: {nama_layanan}
Jenis sertifikat: {jenis_sertifikat}
Objek pekerjaan: {objek_pekerjaan}
Nomor seri/identifikasi objek: {nomor_seri_objek}
Nomor sertifikat: {nomor_sertifikat}
Lokasi pekerjaan: {lokasi_pekerjaan}
Tanggal berakhir sertifikat: {tanggal_berakhir}

{kalimat_masa_berlaku}

Untuk mendukung perencanaan pelaksanaan pekerjaan, kami mohon kesediaan Bapak/Ibu untuk mengonfirmasi beberapa hal berikut:

1. Apakah layanan tersebut masih diperlukan?
2. Apabila diperlukan, kapan perkiraan jadwal pelaksanaan pekerjaan yang diharapkan?
3. Siapa PIC yang dapat kami hubungi untuk koordinasi lebih lanjut?

Informasi tersebut akan menjadi dasar bagi kami untuk menindaklanjuti kebutuhan teknis, rencana pelaksanaan, dan penyusunan penawaran resmi apabila diperlukan.

Demikian kami sampaikan. Atas perhatian dan kerja sama Bapak/Ibu, kami mengucapkan terima kasih.`,
};
const required = ["nama_pelanggan", "nama_layanan", "nomor_sertifikat", "tanggal_berakhir", "kalimat_masa_berlaku"];
export function validateEmailTemplate(subject: string, body: string) {
  if (subject.trim().length < 8 || subject.length > 300 || /[\r\n]/.test(subject)) return "Subjek harus 8–300 karakter dalam satu baris.";
  if (body.trim().length < 80 || body.length > 8000) return "Isi template harus 80–8.000 karakter.";
  const names = [...(subject + "\n" + body).matchAll(/\{([^{}]+)\}/g)].map(m => m[1]);
  if (names.some(name => !(EMAIL_PLACEHOLDERS as readonly string[]).includes(name)) || /[{}]/.test((subject + body).replace(/\{[^{}]+\}/g,"")))
    return "Gunakan hanya placeholder yang tercantum.";
  if (required.some(name => !body.includes("{" + name + "}"))) return "Isi wajib memuat pelanggan, layanan, nomor sertifikat, tanggal berakhir, dan kalimat masa berlaku.";
  if (!subject.includes("{nama_layanan}")) return "Subjek wajib memuat {nama_layanan}.";
  if (/\[UJI|Tim Account Manager|Hormat kami|Bidang Penjualan dan Dukungan Operasi/i.test(subject + body))
    return "Label uji dan tanda tangan organisasi ditambahkan otomatis; jangan dimasukkan ke template.";
  return null;
}
export type RenewalEmailDetails = {
  certificateType: string; object: string; serial?: string;
  location: string; expiryDate: string; orderReference?: string; serviceName?: string;
};
export type RenewalEmailContext = RenewalEmailDetails & { customer: string; number: string; pic: string };
export function formalEmailDate(value: string) {
  return validDate(value) ? new Intl.DateTimeFormat("id-ID", {day:"2-digit",month:"long",year:"numeric",timeZone:"Asia/Makassar"}).format(new Date(value+"T00:00:00Z")) : "";
}
const clean = (value: unknown) => typeof value === "string" && !["undefined","null","NaN"].includes(value.trim()) ? value : "";
export function renderRenewalEmail(context: RenewalEmailContext, template = DEFAULT_EMAIL_TEMPLATE, mode: "official" | "test" = "official", today?: string) {
  const c = Object.fromEntries(Object.entries(context).map(([k,v])=>[k,clean(v)])) as Record<keyof RenewalEmailContext,string>;
  const days = remainingDays(c.expiryDate,today), date = formalEmailDate(c.expiryDate);
  const reminder = days === null ? "" : days < 0
    ? `Berdasarkan data pemantauan kami, masa berlaku sertifikat tersebut telah berakhir pada ${date}.`
    : days === 0 ? `Masa berlaku sertifikat tersebut berakhir pada hari ini, ${date}.`
    : `Berdasarkan data pemantauan kami, masa berlaku sertifikat tersebut akan berakhir dalam ${days} hari.`;
  const values: Record<string,string> = {
    nama_pic_pelanggan:c.pic || (c.customer ? `Tim ${c.customer}` : "Bapak/Ibu"),
    sapaan_pic:c.pic ? `Bapak/Ibu ${c.pic}` : c.customer ? `Tim ${c.customer}` : "Bapak/Ibu",
    nama_pelanggan:c.customer,nama_layanan:c.serviceName || "",jenis_sertifikat:c.certificateType,
    objek_pekerjaan:c.object,nomor_seri_objek:c.serial || "",nomor_sertifikat:c.number,
    lokasi_pekerjaan:c.location,tanggal_berakhir:date,sisa_hari:days === null ? "" : String(Math.max(0,days)),kalimat_masa_berlaku:reminder,
  };
  const replace = (line:string) => line.replace(/\{([a-z_]+)\}/g,(_,key:string)=>values[key] || "");
  const content = template.body.split("\n").filter(line=>
    ![...line.matchAll(/\{([a-z_]+)\}/g)].some(m=>!values[m[1]])
  ).map(replace).join("\n").replace(/\n{3,}/g,"\n\n").trim();
  const subject = replace(template.subject).replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim();
  return {
    subject:(mode === "test" ? "[UJI INTERNAL] " : "")+subject,
    body:[...(mode === "test" ? [EMAIL_TEST_NOTICE,`Konteks simulasi pelanggan: ${c.customer}`,""] : []),content,"",EMAIL_SIGNATURE,
      ...(mode === "test" ? ["",EMAIL_TEST_DISCLAIMER] : [])].join("\n"),
    daysRemaining: days === null ? null : Math.max(0,days),
    missing:[...(!c.serviceName ? ["Nama layanan belum dikonfirmasi"] : []),...(!c.number ? ["Nomor sertifikat belum tersedia"] : []),...(days === null ? ["Tanggal berakhir belum tersedia"] : [])],
  };
}
export function emailHtml(text: string) {
  const escape = (value:string) => value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
  return '<div style="font-family:Public Sans,Arial,sans-serif;font-size:14px;line-height:1.65;color:#0B2545;max-width:680px">'+
    text.split(/\n\n+/).map(p=>'<p style="margin:0 0 16px">'+escape(p).replaceAll("\n","<br>")+"</p>").join("")+"</div>";
}
export function renewalEmail(customer:string,number:string,pic:string,details:RenewalEmailDetails,today?:string) {
  return renderRenewalEmail({...details,customer,number,pic},DEFAULT_EMAIL_TEMPLATE,"official",today);
}
