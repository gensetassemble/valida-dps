import ExcelJS from "exceljs";
import type { DataRow } from "@/features/master-data/server";
import { todayWita } from "@/lib/domain/validity";
export function addClientSheet(book: ExcelJS.Workbook, rows: DataRow[]) {
  const sheet=book.addWorksheet("Sertifikat Klien");
  const columns:[string,string,number][]=[
    ["portfolio_code","Portfolio",14],["client_name","Nama Pelanggan",30],
    ["certificate_type_name","Jenis Sertifikat",32],["certificate_number","Nomor Sertifikat",36],
    ["object_type","Objek Inspeksi",34],["object_serial","Nomor Seri (opsional)",24],
    ["installation_location","Lokasi",32],["work_area_name","Wilayah",18],
    ["issue_date","Tanggal Terbit",18],["interval_label","Interval",18],
    ["expiry_date","Tanggal Berakhir",18],["previous_order_value","Nilai Kontrak (IDR)",24],
    ["order_reference","Nomor SPK",30],["pic_name","PIC Perusahaan",28],
    ["pic_email","Email PIC",36],["account_manager_name","Account Manager (AM)",30],
    ["validity_status","Status Masa Berlaku",24],["days_remaining","Sisa Hari",16],
    ["pic_is_test","Kontak Uji",16],
  ];
  sheet.columns=columns.map(([key,header,width])=>({key,header,width}));
  for(const row of rows){
    const values=Object.fromEntries(columns.map(([key])=>[key,row[key]??""]));
    for(const key of ["issue_date","expiry_date"])
      if(typeof row[key]==="string")values[key]=new Date(String(row[key])+"T00:00:00Z");
    values.previous_order_value=row.previous_order_value==null?"":Number(row.previous_order_value);
    values.pic_is_test=row.pic_is_test?"Ya — penerima internal":"Tidak";
    sheet.addRow(values);
  }
  sheet.getColumn("previous_order_value").numFmt='"Rp "#,##0.00';
  for(const key of ["issue_date","expiry_date"])sheet.getColumn(key).numFmt="dd mmm yyyy";
  sheet.eachRow((row,index)=>{
    row.alignment={vertical:"middle",wrapText:true};row.height=index===1?34:54;
    if(index===1){row.font={bold:true,color:{argb:"FFFFFFFF"}};row.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0B2545"}};}
  });
  sheet.views=[{state:"frozen",xSplit:2,ySplit:1}];
  sheet.autoFilter={from:"A1",to:{row:1,column:columns.length}};
  return `Arsip Sertifikat Klien - Cabang Denpasar ${todayWita()}.xlsx`;
}
