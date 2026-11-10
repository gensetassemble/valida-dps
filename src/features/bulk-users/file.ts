import { roleCodes, MAX_BULK_USERS, type BulkInput } from "./model";
export function checkWorkbookZip(bytes:Uint8Array) {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error("File XLSX tidak valid.");const count=v.getUint16(end+10,true);let pos=v.getUint32(end+16,true),total=0;
 if(count>300||!count)throw Error("Workbook terlalu kompleks. Gunakan template VALIDA.");
 for(let i=0;i<count;i++){
  if(pos+46>bytes.length||v.getUint32(pos,true)!==0x02014b50)throw Error("Struktur XLSX tidak valid.");
  if(v.getUint16(pos+8,true)&1)throw Error("Workbook berpassword tidak didukung.");
  total+=v.getUint32(pos+24,true);if(total>10*1024*1024)throw Error("Isi workbook terlalu besar. Gunakan template maksimal 100 baris.");
  pos+=46+v.getUint16(pos+28,true)+v.getUint16(pos+30,true)+v.getUint16(pos+32,true);
 }
}
export function importGrid(grid:string[][]):BulkInput[] {
 const normalized=(s:string)=>s.replace(/^\ufeff/,"").trim().toLowerCase().replace(/[ _-]+/g," ");
 const headers=grid[0]?.map(normalized)||[];const aliases:Record<string,string>={nama:"name","nama pegawai":"name",npp:"npp",email:"email",peran:"roles",role:"roles"};
 if(headers.some(h=>h&&!aliases[h])||new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error("Kolom tidak sesuai template. Gunakan Nama, NPP, Email, Peran; jangan sertakan password.");
 for(const h of ["npp","email"])if(!headers.includes(h))throw Error("Kolom "+h.toUpperCase()+" wajib tersedia.");
 if(!headers.some(h=>aliases[h]==="roles")||!headers.some(h=>aliases[h]==="name"))throw Error("Kolom Nama dan Peran wajib tersedia.");
 const data=grid.slice(1).filter(row=>row.some(cell=>cell.trim()));if(!data.length||data.length>MAX_BULK_USERS)throw Error("Isi 1–100 pegawai per file.");
 return data.map((cells,index)=>{
  if(cells.slice(headers.length).some(s=>s.trim()))throw Error(`Baris ${index+2}: ada kolom di luar template.`);
  const row:Record<string,string>={};headers.forEach((h,i)=>{if(h)row[aliases[h]]=String(cells[i]||"").trim();});
  try{return {name:row.name||"",npp:row.npp||"",email:row.email||"",roles:roleCodes(row.roles||"")};}
  catch(error){throw Error(`Baris ${index+2}: ${error instanceof Error?error.message:"Peran tidak valid"}`,{cause:error});}
 });
}
export async function readBulkFile(file:File) {
 if(file.size>512*1024)throw Error("Maksimum file 512 KB dan 100 pegawai.");
 if(file.name.toLowerCase().endsWith(".csv")) {
  const {parse}=await import("csv-parse/browser/esm/sync");
  const text=await file.text();const header=text.split(/\r?\n/,1)[0];
  return importGrid(parse(text,{bom:true,delimiter:header.includes(";")&&!header.includes(",")?";":",",skip_empty_lines:true,relax_column_count:true,max_record_size:4000}) as string[][]);
 }
 if(!file.name.toLowerCase().endsWith(".xlsx"))throw Error("Gunakan CSV atau XLSX sesuai template, bukan XLS.");
 const bytes=new Uint8Array(await file.arrayBuffer());checkWorkbookZip(bytes);
 const ExcelJS=(await import("exceljs")).default;const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 const sheet=book.worksheets.find(s=>s.name==="Pengguna")||book.worksheets[0];if(!sheet||sheet.rowCount>102||sheet.columnCount>8)throw Error("Gunakan template dengan maksimal 100 pegawai dan empat kolom.");
 const grid:string[][]=[];sheet.eachRow({includeEmpty:true},(row,rowIndex)=>{
  const cells:string[]=[];for(let i=1;i<=sheet.columnCount;i++){
   const cell=row.getCell(i);if(cell.value!==null&&typeof cell.value!=="string"&&typeof cell.value!=="number")throw Error(`Baris ${rowIndex}: gunakan teks biasa, tanpa formula/link.`);
   if(rowIndex>1&&String(sheet.getRow(1).getCell(i).value||"").trim().toLowerCase()==="npp"&&typeof cell.value==="number")throw Error(`Baris ${rowIndex}: ubah format NPP menjadi Teks agar nol di depan tidak hilang.`);
   cells.push(cell.value===null?"":String(cell.value));
  }grid.push(cells);
 });return importGrid(grid);
}
export function csvReport(rows:string[][]){return "\ufeff"+rows.map(row=>row.map(value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"').join(",")).join("\r\n");}
