import {afterEach,describe,expect,it,vi} from "vitest";
import {renderRenewalEmail,DEFAULT_EMAIL_TEMPLATE,EMAIL_SIGNATURE,EMAIL_TEST_NOTICE,EMAIL_TEST_DISCLAIMER,emailHtml,validateEmailTemplate} from "@/features/operations/renewal-email";
const context={customer:"Transnusa",pic:"Ratna",serviceName:"Residual Disinsection",certificateType:"Jenis Sertifikat Sumber",object:"Pesawat Airbus A320",serial:"PK-TLO",number:"E0034/AOCAAT",location:"Bandara Ngurah Rai",expiryDate:"2026-11-30"};
afterEach(()=>vi.useRealTimers());
describe("renewal coordination email",()=>{
 it("uses the prescribed subject, source identifiers, formal date and organizational signature",()=>{
  const email=renderRenewalEmail(context,DEFAULT_EMAIL_TEMPLATE,"official","2026-11-04");
  expect(email.subject).toBe("Konfirmasi Kebutuhan Perpanjangan Layanan Residual Disinsection – Transnusa");
  for(const value of ["Yth. Bapak/Ibu Ratna,","Jenis layanan: Residual Disinsection","Jenis sertifikat: Jenis Sertifikat Sumber","Objek pekerjaan: Pesawat Airbus A320","PK-TLO","E0034/AOCAAT","Bandara Ngurah Rai","30 November 2026","26 hari"])expect(email.body).toContain(value);
  expect(email.body).toContain("Apakah layanan tersebut masih diperlukan?");
  expect(email.body.endsWith(EMAIL_SIGNATURE)).toBe(true);expect(email.body).not.toContain("Tim Account Manager");expect(email.subject).not.toContain("Penawaran");
 });
 it("calculates the WITA day even when the UTC date is still yesterday",()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-03T16:30:00Z"));
  expect(renderRenewalEmail(context).daysRemaining).toBe(26);
 });
 it("handles due today, expired and invalid dates without negative countdowns",()=>{
  expect(renderRenewalEmail(context,DEFAULT_EMAIL_TEMPLATE,"official","2026-11-30").body).toContain("berakhir pada hari ini, 30 November 2026.");
  const expired=renderRenewalEmail(context,DEFAULT_EMAIL_TEMPLATE,"official","2026-12-02");
  expect(expired.body).toContain("telah berakhir pada 30 November 2026.");expect(expired.daysRemaining).toBe(0);expect(expired.body).not.toContain("-2");
  const invalid=renderRenewalEmail({...context,expiryDate:"2026-02-30"});expect(invalid.daysRemaining).toBeNull();expect(invalid.body).not.toContain("Tanggal berakhir sertifikat:");
 });
 it("omits optional empty fields and greets the client team if the PIC is missing",()=>{
  const email=renderRenewalEmail({...context,pic:"",serial:"",location:"null",object:"undefined"});
  expect(email.body).toContain("Yth. Tim Transnusa,");
  for(const value of ["Nomor seri/identifikasi objek:","Lokasi pekerjaan:","Objek pekerjaan:","undefined","null","NaN","{nama_"])expect(email.body).not.toContain(value);
 });
 it("does not assume service name equals certificate type or object",()=>{
  const email=renderRenewalEmail({...context,serviceName:""});expect(email.missing).toContain("Nama layanan belum dikonfirmasi");expect(email.body).not.toContain("Jenis layanan: Jenis Sertifikat Sumber");
 });
 it("separates test labels and disclaimers from genuine client content",()=>{
  const test=renderRenewalEmail(context,DEFAULT_EMAIL_TEMPLATE,"test");
  expect(test.subject).toMatch(/^\[UJI INTERNAL\]/);expect(test.body).toContain(EMAIL_TEST_NOTICE);expect(test.body.endsWith(EMAIL_TEST_DISCLAIMER)).toBe(true);
  const official=renderRenewalEmail(context);expect(official.subject+official.body).not.toContain("UJI INTERNAL");
 });
 it("escapes all markup and preserves readable HTML paragraph spacing",()=>{
  const html=emailHtml('A <img src=x onerror="alert(1)"> & B\n\nSecond\nline');
  expect(html).not.toContain("<img");expect(html).toContain("&lt;img");expect(html).toContain("&amp;");expect(html).toContain("<br>");expect(html.match(/<p /g)).toHaveLength(2);
 });
 it("validates template tokens, required context, signature and test-mode boundaries",()=>{
  const {subject,body}=DEFAULT_EMAIL_TEMPLATE;
  expect(validateEmailTemplate(subject,body)).toBeNull();
  for(const bad of [body+" {secret_token}",body.replace("{nomor_sertifikat}",""),body+" Tim Account Manager",body+" [UJI INTERNAL]",body+" {broken",body+" Hormat kami"])
    expect(validateEmailTemplate(subject,bad)).not.toBeNull();
  expect(validateEmailTemplate(subject+"\r\nBcc: external",body)).not.toBeNull();
 });
});
