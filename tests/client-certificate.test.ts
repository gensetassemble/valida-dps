import { describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import ExcelJS from "exceljs";
import { clientExpiry } from "@/features/operations/client-certificate";
import { normalize } from "@/features/imports/normalize";
import { parseSource } from "@/features/imports/parser";
import { addClientSheet } from "@/features/operations/client-export";
describe("client source workbook",()=>{
  it("preserves day intervals and calendar month boundaries",()=>{
    expect(clientExpiry("2026-10-21",null,56)).toBe("2026-12-16");
    expect(clientExpiry("2026-01-31",1,null)).toBe("2026-02-28");
    expect(clientExpiry("2026-10-21",12,56)).toBeNull();
    expect(clientExpiry("invalid",null,56)).toBeNull();
  });
  it("reads row-four headers, Indonesian dates, text identifiers and raw money",async()=>{
    const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Sertifikat_Klien");
    sheet.getCell("A2").value="Data Archive";
    sheet.getRow(4).values=["Portfolio","Nama Pelanggan","Jenis Sertifikat","Nomor Sertifikat","Objek Inspeksi","Tanggal Terbit","Interval (bulan)","Tanggal Berakhir","Nilai Kontrak (IDR)","Nomor SPK"];
    sheet.getRow(5).values=["KSP","Perusahaan uji","Residual","CERT-001","Pesawat",new Date("2026-10-21T00:00:00Z"),"56 Hari",new Date("2026-12-16T00:00:00Z"),2250000,"000019"];
    const parsed=await parseSource("clients.xlsx",Buffer.from(await book.xlsx.writeBuffer()),"clients");
    expect(parsed.rows).toHaveLength(1);expect(parsed.rows[0].row).toBe(5);
    expect(parsed.rows[0].normalized).toMatchObject({interval_days:"56",interval_months:"",order_reference:"000019",issue_date:"2026-10-21"});
    const row=normalize("clients",{"Tanggal Terbit":"11 Des 2025","Tanggal Berakhir":"11 Des 2028","Nilai Kontrak (IDR)":"13333333.333333334"});
    expect(row.normalized).toMatchObject({issue_date:"2025-12-11",expiry_date:"2028-12-11",previous_order_value:"13333333.33"});
    expect(row.issues.some(i=>i.includes("client_id"))).toBe(true);
  });
  it("exports source column labels, typed dates, text references and test-contact label",()=>{
    const book=new ExcelJS.Workbook();addClientSheet(book,[{client_name:"Perusahaan uji",issue_date:"2026-10-21",interval_label:"56 hari",previous_order_value:"2250000.00",order_reference:"000019",pic_name:"[UJI] Adli",pic_is_test:true}]);
    const s=book.worksheets[0];expect(s.getRow(2).getCell("issue_date").value).toBeInstanceOf(Date);
    expect(s.getRow(2).getCell("order_reference").value).toBe("000019");expect(s.getRow(2).getCell("pic_is_test").value).toMatch(/penerima internal/);
    expect(s.getRow(2).getCell("previous_order_value").value).toBe(2250000);
  });
});
