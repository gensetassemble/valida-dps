import {afterEach,expect,it,vi} from "vitest";
import ExcelJS from "exceljs";
import {addClientSheet} from "@/features/operations/client-export";
afterEach(()=>vi.useRealTimers());
it("puts colored status and days first, keeps numeric days and source identifiers after an XLSX round trip",async()=>{
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-04T03:00:00Z"));
 const book=new ExcelJS.Workbook();
 addClientSheet(book,[{client_name:"Test",expiry_date:"2026-11-03",certificate_number:"00001/A",order_reference:"000019"},{client_name:"Critical",expiry_date:"2026-11-30"},{client_name:"Unknown"}]);
 const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await book.xlsx.writeBuffer());const sheet=reopened.worksheets[0];
 expect(sheet.getCell("A1").value).toBe("Status Masa Berlaku");expect(sheet.getCell("B1").value).toBe("Sisa Hari");
 expect(sheet.getCell("A2").value).toBe("Expired");expect(sheet.getCell("B2").value).toBe(-1);
 expect(sheet.getCell("A3").value).toBe("Kritis");expect(sheet.getCell("B3").value).toBe(26);
 expect(sheet.getCell("A2").fill).toMatchObject({fgColor:{argb:"FFFEE2E2"}});expect(sheet.getCell("B3").fill).toMatchObject({fgColor:{argb:"FFFFEDD5"}});
 expect(sheet.getCell("B4").value || "").toBe("");expect(sheet.getCell("A4").value).toBe("Not Recorded");
 expect(sheet.getRow(2).values).toContain("00001/A");expect(sheet.getRow(2).values).toContain("000019");
 expect(sheet.views[0]).toMatchObject({xSplit:4,ySplit:1});expect(sheet.getCell("D2").alignment.wrapText).toBe(true);
});
