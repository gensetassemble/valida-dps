import ExcelJS from "exceljs";
import type { DataRow } from "@/features/master-data/server";
import { todayWita,remainingDays,validityLabel,validDate,validityDisplayLabel } from "@/lib/domain/validity";
export function addClientSheet(book: ExcelJS.Workbook, rows: DataRow[], today = todayWita()) {
  const sheet=book.addWorksheet("Sertifikat Klien");
  const columns:[string,string,number][]=[
    ["validity_status","Status Masa Berlaku",24],["days_remaining","Sisa Hari",18],
    ["portfolio_code","Portfolio",14],["client_name","Nama Pelanggan",30],
    ["certificate_type_name","Jenis Sertifikat",32],["certificate_number","Nomor Sertifikat",36],
    ["object_type","Objek Inspeksi",34],["object_serial","Nomor Seri (opsional)",24],
    ["installation_location","Lokasi",32],["work_area_name","Wilayah",18],
    ["issue_date","Tanggal Terbit",22],["interval_label","Interval",18],
    ["expiry_date","Tanggal Berakhir",22],["previous_order_value","Nilai Kontrak (IDR)",24],
    ["order_reference","Nomor SPK",30],["pic_name","PIC Perusahaan",28],
    ["pic_email","Email PIC",36],["account_manager_name","Account Manager (AM)",30],
    ["pic_is_test","Kontak Uji",16],
  ];
  sheet.columns=columns.map(([key,header,width])=>({key,header,width}));
  for(const row of rows){
    const values=Object.fromEntries(columns.map(([key])=>[key,row[key]??""]));
    for(const key of ["issue_date","expiry_date"])
      if(typeof row[key]==="string" && validDate(String(row[key])))values[key]=new Date(String(row[key])+"T00:00:00Z");
    const expiry=typeof row.expiry_date === "string" ? row.expiry_date : "";
    values.days_remaining=remainingDays(expiry,today) ?? "";
    values.validity_status=validityDisplayLabel(validityLabel(expiry || null,true,false,today));
    values.previous_order_value=row.previous_order_value==null?"":Number(row.previous_order_value);
    values.pic_is_test=row.pic_is_test?"Ya — penerima internal":"Tidak";
    sheet.addRow(values);
  }
  sheet.getColumn("previous_order_value").numFmt='"Rp "#,##0.00';
  for(const key of ["issue_date","expiry_date"])sheet.getColumn(key).numFmt="dd mmmm yyyy";
  sheet.getColumn("days_remaining").numFmt='0" hari";"Lewat "0" hari";"Hari ini"';
  const colors:Record<string,[string,string]>={Expired:["FFFEE2E2","FF991B1B"],Kritis:["FFFFEDD5","FF9A3412"],Perhatian:["FFFEF3C7","FF854D0E"],Pantau:["FFE0F2FE","FF075985"],Aman:["FFDCFCE7","FF166534"]};
  sheet.eachRow((row,index)=>{
    row.alignment={vertical:"middle",wrapText:true};row.height=index===1?36:48;
    row.font={name:"Calibri",size:11,color:{argb:"FF0B2545"}};
    row.eachCell({includeEmpty:true},cell=>{cell.border={bottom:{style:"thin",color:{argb:"FFE2E8F0"}}};});
    if(index===1){row.font={name:"Calibri",size:11,bold:true,color:{argb:"FFFFFFFF"}};row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0B2545"}};}
    else {
      row.fill={type:"pattern",pattern:"solid",fgColor:{argb:index%2 === 0 ? "FFFFFFFF" : "FFF8FAFC"}};
      const [background,foreground]=colors[String(row.getCell("validity_status").value)] || ["FFF1F5F9","FF475569"];
      for(const key of ["validity_status","days_remaining"]){const cell=row.getCell(key);cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:background}};cell.font={name:"Calibri",size:11,bold:true,color:{argb:foreground}};cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};}
      const lines=Math.max(...columns.map(([key,,width])=>String(row.getCell(key).text).split("\n").reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/(width-3))),0)));
      row.height=Math.max(48,lines*15+12);
    }
  });
  sheet.views=[{state:"frozen",xSplit:4,ySplit:1,showGridLines:false}];
  sheet.pageSetup={orientation:"landscape",paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0};
  sheet.autoFilter={from:"A1",to:{row:1,column:columns.length}};
  return `Arsip Sertifikat Klien - Cabang Denpasar ${today}.xlsx`;
}
