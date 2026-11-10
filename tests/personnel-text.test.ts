import {describe,expect,it} from "vitest";
import {personnelText,personnelRow,positionText,processNotes,verificationNotes} from "@/lib/personnel-text";
describe("personnel presentation",()=>{
 it("normalizes names and positions without modifying identifiers or source records",()=>{
  const source={full_name:"  ANDI QAULA MUSDANIA  ",position:"ASS SALES AND ACCOUNT OFFICER",npp:"04125",email:"NAME@example.invalid"};
  expect(personnelRow(source)).toEqual({...source,full_name:"Andi Qaula Musdania",position:"Ass Sales and Account Officer"});expect(source.full_name).toContain("ANDI");
  expect(personnelText("JULKARNAEN")).toBe("Julkarnaen");
 });
 it("uses lowercase connecting words only for positions",()=>{
  expect(positionText("LABORATORY TECHNICAL AND REFERENCE SPECIALIST 1")).toBe("Laboratory Technical and Reference Specialist 1");
  expect(positionText("HEAD OF QUALITY DAN PENGUJIAN UNTUK CABANG")).toBe("Head of Quality dan Pengujian untuk Cabang");
  expect(personnelText("ANDI SURYADI")).toBe("Andi Suryadi");
 });
 it("removes source hashes from business notes while retaining the reason",()=>{
  expect(processNotes("Konfirmasi aktif. Sumber SHA-256 "+"d".repeat(64))).toBe("Konfirmasi aktif.");
  expect(processNotes("Resign efektif 31 Oktober 2026")).toBe("Resign efektif 31 Oktober 2026");
  expect(verificationNotes("Konfirmasi Aktif dan Terverifikasi sesuai Demografi Pegawai.xlsx; disetujui pengguna 31 Oktober 2026. Sumber SHA-256 "+"d".repeat(64))).toBe("Diverifikasi oleh Super Admin berdasarkan master pegawai.");
 });
});
