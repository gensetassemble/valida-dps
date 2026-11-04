import { formatBusinessDate } from "@/lib/format";
import { remainingDays } from "@/lib/domain/validity";
export type RenewalEmailDetails = {
  certificateType: string; object: string; serial?: string;
  location: string; expiryDate: string; orderReference?: string;
};
export function renewalEmail(customer: string, number: string, pic: string, details: RenewalEmailDetails, today?: string) {
  const type = details.certificateType || "sertifikat inspeksi";
  const days = remainingDays(details.expiryDate, today);
  const reminder = days === null ? "Mohon konfirmasi tanggal berakhir sertifikat."
    : days < 0 ? `Masa berlaku sertifikat telah berakhir ${Math.abs(days)} hari yang lalu.`
    : days === 0 ? "Masa berlaku sertifikat berakhir hari ini."
    : `Masa berlaku sertifikat akan berakhir dalam ${days} hari.`;
  const test = pic.startsWith("[UJI]");
  return {
    subject: `${test ? "[UJI] " : ""}[PT SUCOFINDO] Perpanjangan ${type} - ${customer} - ${number}`.slice(0,200),
    body: [
      ...(test ? ["[UJI INTERNAL — draft pengujian, bukan penawaran resmi kepada pelanggan]", ""] : []),
      `Yth. ${pic || "Bapak/Ibu PIC"},`, `Tim ${customer}`, "", "Dengan hormat,", "",
      `Kami dari PT SUCOFINDO Cabang Denpasar menghubungi Bapak/Ibu untuk menindaklanjuti perpanjangan sertifikat dengan rincian berikut:`, "",
      `Pelanggan: ${customer}`,
      `Nama pekerjaan: Perpanjangan ${type}`,
      `Objek pekerjaan: ${details.object || "Belum tercatat"}`,
      ...(details.serial ? [`Nomor seri objek: ${details.serial}`] : []),
      `Jenis sertifikat: ${type}`,
      `Nomor sertifikat: ${number || "Belum tercatat"}`,
      `Lokasi pekerjaan: ${details.location || "Belum tercatat"}`,
      ...(details.orderReference ? [`Referensi SPK: ${details.orderReference}`] : []),
      `Tanggal berakhir: ${formatBusinessDate(details.expiryDate)}`, "", reminder, "",
      "Mohon konfirmasi kebutuhan perpanjangan, jadwal pelaksanaan yang diharapkan, serta PIC yang dapat kami hubungi untuk koordinasi pekerjaan.", "",
      "Ruang lingkup, jadwal, dan biaya akan kami sampaikan melalui penawaran resmi setelah kebutuhan pekerjaan dikonfirmasi.", "",
      "Terima kasih atas perhatian dan kerja sama Bapak/Ibu.", "", "Hormat kami,", "Tim Account Manager", "PT SUCOFINDO Cabang Denpasar",
    ].join("\n"),
  };
}
