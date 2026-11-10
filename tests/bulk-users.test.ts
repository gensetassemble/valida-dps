import {describe,expect,it} from "vitest";
import ExcelJS from "exceljs";
import {reviewBulkRows,roleCodes,type Employee} from "@/features/bulk-users/model";
import {importGrid,readBulkFile,csvReport} from "@/features/bulk-users/file";
const employee:Employee={id:"ef200000-0000-4000-8000-000000000001",full_name:"Nama Pegawai",npp:"04125",employment_status:"active",is_active:true,updated_at:"2026-11-10T00:00:00Z"};
const input={name:"NAMA PEGAWAI",npp:"04125",email:"staff@example.invalid",roles:["tester"]};
describe("bulk employee matching",()=>{
 it("resolves authoritative names and text NPP",()=>{expect(reviewBulkRows([input],[employee],[],new Set())[0]).toMatchObject({status:"ready",name:"Nama Pegawai",npp:"04125",employeeId:employee.id});});
 it("does not fabricate Non-NPP identifiers or merge ambiguous names",()=>{const e={...employee,npp:null};expect(reviewBulkRows([{...input,npp:""}],[e],[],new Set())[0]).toMatchObject({status:"ready",npp:""});expect(reviewBulkRows([{...input,npp:""}],[e,{...e,id:"other"}],[],new Set())[0].status).toBe("error");});
 it("blocks mismatched names, inactive employees and duplicate inputs",()=>{
  expect(reviewBulkRows([{...input,name:"Other"}],[employee],[],new Set())[0].status).toBe("error");
  expect(reviewBulkRows([input],[{...employee,employment_status:"inactive"}],[],new Set())[0].status).toBe("error");
  expect(reviewBulkRows([input,{...input,email:"other@example.invalid"}],[employee],[],new Set()).every(r=>r.status==="error")).toBe(true);
  expect(reviewBulkRows([input,input],[employee],[],new Set()).every(r=>r.status==="error")).toBe(true);
 });
 it("skips existing emails and rejects a second identity account",()=>{
  expect(reviewBulkRows([input],[employee],[{email:input.email,employee_id:employee.id}],new Set())[0].status).toBe("skip");
  expect(reviewBulkRows([input],[employee],[{email:"other@example.invalid",employee_id:employee.id}],new Set())[0].status).toBe("error");
 });
 it("keeps coordinator access dependent on existing portfolio assignments",()=>{
  expect(reviewBulkRows([{...input,roles:["coordinator"]}],[employee],[],new Set())[0].status).toBe("error");
  expect(reviewBulkRows([{...input,roles:["coordinator"]}],[employee],[],new Set([employee.id]))[0].status).toBe("ready");
  expect(roleCodes("HRGA | PTK;Tester (Baca Saja)")).toEqual(["hrga","equipment_manager","tester"]);
 });
});
describe("bounded bulk file parsing",()=>{
 it("rejects unexpected/password columns and accepts text NPP",()=>{
  expect(importGrid([["Nama","NPP","Email","Peran"],["Nama Pegawai","04125",input.email,"tester"]])[0].npp).toBe("04125");
  expect(()=>importGrid([["Nama","NPP","Email","Peran","Password"]])).toThrow(/Kolom/);
 });
 it("accepts CSV with Indonesian semicolon delimiter and quoted role lists",async()=>{
  expect((await readBulkFile(new File(['Nama;NPP;Email;Peran\nNama Pegawai;04125;staff@example.invalid;"hrga|tester"'],'test.csv')))[0].roles).toEqual(["hrga","tester"]);
 });
 it("reads XLSX and refuses numeric NPP before leading zeros can be guessed",async()=>{
  const book=new ExcelJS.Workbook();const s=book.addWorksheet("Pengguna");s.addRow(["Nama","NPP","Email","Peran"]);s.addRow(["Nama Pegawai","04125",input.email,"tester"]);
  const file=async()=>new File([new Uint8Array(await book.xlsx.writeBuffer())],'test.xlsx');expect((await readBulkFile(await file()))[0].npp).toBe("04125");
  s.getCell("B2").value=4125;await expect(readBulkFile(await file())).rejects.toThrow(/format NPP/);
 });
 it("rejects oversized files and escapes CSV report formulas",async()=>{
  await expect(readBulkFile(new File([new Uint8Array(512*1024+1)],'large.csv'))).rejects.toThrow(/512/);
  expect(csvReport([["=HYPERLINK(1)","Normal"]])).toContain("'=HYPERLINK(1)");
 });
});
