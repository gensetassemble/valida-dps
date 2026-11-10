import {describe,expect,it} from "vitest";
import {personnelText,personnelRow,processNotes} from "@/lib/personnel-text";
describe("personnel presentation",()=>{
 it("normalizes names and positions without modifying identifiers or source records",()=>{
  const source={full_name:"  ANDI QAULA MUSDANIA  ",position:"ASS SALES AND ACCOUNT OFFICER",npp:"04125",email:"NAME@example.invalid"};
  expect(personnelRow(source)).toEqual({...source,full_name:"Andi Qaula Musdania",position:"Ass Sales And Account Officer"});expect(source.full_name).toContain("ANDI");
  expect(personnelText("JULKARNAEN")).toBe("Julkarnaen");
 });
 it("removes source hashes from business notes while retaining the reason",()=>{
  expect(processNotes("Konfirmasi aktif. Sumber SHA-256 "+"d".repeat(64))).toBe("Konfirmasi aktif.");
  expect(processNotes("Resign efektif 31 Oktober 2026")).toBe("Resign efektif 31 Oktober 2026");
 });
});
