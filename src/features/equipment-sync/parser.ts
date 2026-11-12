import "server-only";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { checkZip, MAX_IMPORT_BYTES } from "@/features/imports/parser";
import { addMonths, validDate } from "@/lib/domain/validity";
import { normalizeCalibrationLaboratory, calibrationLaboratories } from "@/features/operations/calibration-laboratories";
import { normalizeEquipmentUnit } from "@/features/operations/equipment-units";

type Values = Record<string, string>;
export type SyncRow = {sheet:string;row:number;portfolio:string;name:string;tag:string;serial?:string;asset:Record<string,unknown>;calibration:Record<string,unknown>;raw:Values};
export class UmaImportError extends Error {
  constructor(public issues:string[]) {super("Impor belum diterapkan. Perbaiki baris berikut lalu unggah ulang.");}
}
const label = (value:unknown) => String(value??"").toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (value:unknown) => String(value??"").replace(/\r\n/g,"\n").trim();
const cellText = (cell:ExcelJS.Cell) => cell.master.value == null ? '' : cell.master.text;
const aliases:Record<string,string[]> = {
  name:["Nama Barang","Nama Alat"],tag:["Tag-Number","Tag Number","Tag"],serial:["Serial Number","Nomor Seri"],
  brand:["Merk/Type","Merek/Type","Merek","Brand"],color:["Warna"],specification_size:["Ukuran","Ukuran / spesifikasi"],
  item_condition:["Kondisi Barang"],item_status:["Status Barang"],certificate_number:["No. Sertifikat Kalibrasi/Perijinan","No. Sertifikat Kalibrasi/Perizinan","Nomor Sertifikat"],
  interval_months:["Interval Kalibrasi/Perijinan","Interval Kalibrasi/Perizinan","Interval (bulan)","Interval"],
  issue_date:["Tgl Kalibrasi/Perijinan","Tgl Kalibrasi/Perizinan","Tanggal Kalibrasi","Tanggal terbit sertifikat"],
  due_date:["Tgl berakhirnya masa Kalibrasi/Perijinan","Tgl berakhirnya masa Kalibrasi/Perizinan","Tanggal Berakhir"],
  unit:["Sub Unit Kerja Pemilik","Sub Unit Kerja Pemilik*","Subunit Pemilik"],laboratory:["Lembaga Kalibrasi/Perijinan","Lembaga Kalibrasi/Perizinan","Lembaga Kalibrasi"],
  calibration_internal:["Internal"],calibration_external:["Eksternal"],measurement_range:["Range / Kapasitas","Rentang ukur / kapasitas"],
  correction_factor:["Faktor Koreksi"],significant_yes:["Ya","Signifikan Ya"],significant_no:["Tidak","Signifikan Tidak"],
  notes:["Keterangan","Catatan"],portfolio:["Portofolio","Portfolio"],location:["Lokasi"],result:["Hasil Kalibrasi"],
  calibration_kind:["Jenis Kalibrasi"],significant:["Signifikan"],
};
function key(value:string) {
  const normalized=label(value).replace(/perizinan/g,'perijinan');
  const exact=Object.keys(aliases).find(k=>aliases[k].some(a=>label(a).replace(/perizinan/g,'perijinan')===normalized));
  if(exact)return exact;
  // Match meaningful header words, independently of punctuation, line breaks and spelling.
  if(/^(tag|nomor(inventaris|aset)|kode(inventaris|alat))/.test(normalized))return 'tag';
  if(/^(nama)(barang|alat|peralatan)/.test(normalized))return 'name';
  if(/^(serial|nomorseri|noseri)/.test(normalized))return 'serial';
  if(/^(no|nomor)sertifikat/.test(normalized))return 'certificate_number';
  if(/^(tgl|tanggal).*(akhir|berlaku)/.test(normalized))return 'due_date';
  if(/^(tgl|tanggal).*(kalibrasi|terbit)/.test(normalized))return 'issue_date';
  if(/^interval/.test(normalized))return 'interval_months';
  if(/^(lembaga|laboratorium).*(kalibrasi|perijinan)/.test(normalized))return 'laboratory';
  if(/^subunit.*(pemilik|kerja)/.test(normalized))return 'unit';
  if(/^(range|rentang).*(kapasitas|ukur)/.test(normalized))return 'measurement_range';
  if(/^faktorkoreksi/.test(normalized))return 'correction_factor';
}
export function umaDate(value:string):string|null {
  if (/^(n\/?a|not recorded|-)$/i.test(value)) return null;
  if(validDate(value)) return value;
  let m=value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if(m){const y=m[3].length===2?`20${m[3]}`:m[3];const d=`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;if(validDate(d))return d;}
  m=value.match(/^(\d{1,2})[ -]([A-Za-z]+)[ -](\d{2}|\d{4})$/);
  if(m){const months=[['jan'],['feb'],['mar'],['apr'],['may','mei'],['jun'],['jul'],['aug','agu'],['sep'],['oct','okt'],['nov'],['dec','des']];const mon=months.findIndex(ns=>ns.includes(m![2].slice(0,3).toLowerCase()));const d=`${m[3].length===2?'20':''}${m[3]}-${String(mon+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;if(mon>=0&&validDate(d))return d;}
  throw Error(`Tanggal “${value}” tidak valid; gunakan tanggal Excel atau dd/mm/yyyy.`);
}
function interval(value:string):number|null {
  value=value.replace(/^'/,'');
  if(/^(n\/?a|-)$/i.test(value))return null;
  const m=value.toLowerCase().match(/^(\d+)\s*(bulan|bln|month[s]?|tahun|thn|year[s]?)?$/);
  const n=m?Number(m[1])*(/^(tahun|thn|year)/.test(m[2]||'')?12:1):0;
  if(n<1||n>600)throw Error(`Interval “${value}” tidak valid; isi bulan atau tahun, misalnya 12 bulan / 1 tahun.`);
  return n;
}
function mark(value:string):string {
  value=value.replace(/^'/,'');
  if(/^(√|✓|✔|ya|true|1)$/i.test(value))return "√";
  if(/^(–|-|tidak|false|0|n\/?a)$/i.test(value))return "-";
  throw Error(`Tanda “${value}” tidak dikenali; gunakan centang atau strip.`);
}
const codes=['IND','PIK','SERCO','KSP','HMPM','AEBT','LAB','MIN','BBR','LSI'];
function portfolio(value:string) {
  const s=value.trim().toUpperCase();
  if(codes.includes(s))return s;
  if(s==='SCE')return 'SERCO';
  if(/^(MINERAL\s*INSPEKSI|INSPEKSI\s*MINERAL)$/.test(s))return 'MIN';
  if(/^(BTB|BATUBARA)/.test(s))return 'BBR';
  return '';
}
function normalizeRow(v:Values,sheet:string,row:number,fallback:string):SyncRow {
  const name=text(v.name),tag=text(v.tag),p=portfolio(v.portfolio||'')||portfolio(sheet)||portfolio(fallback);
  if(!p)throw Error("Portofolio tidak terbaca. Pilih portofolio file atau isi kolom Portofolio.");
  if(!name||!tag)throw Error("Nama Barang dan Tag-Number wajib diisi untuk pencocokan alat.");
  if(v.correction_factor&&!/^(n\/?a|-)$/i.test(v.correction_factor)&&!v.measurement_range)throw Error("Isi Range / Kapasitas untuk menentukan pasangan Faktor Koreksi.");
  const asset:Record<string,unknown>={},calibration:Record<string,unknown>={};
  for(const k of ['serial','brand','color','specification_size','item_condition','item_status','unit','location','notes'])if(v[k])asset[k]=v[k]==='[KOSONGKAN]'?null:v[k];
  if(v.brand)asset.model=null; // UMA stores Merk/Type in one column; do not append the old model twice.
  if(typeof asset.unit==='string')asset.unit=normalizeEquipmentUnit(asset.unit);
  for(const k of ['certificate_number','laboratory','notes'])if(v[k])calibration[k]=v[k]==='[KOSONGKAN]'?null:v[k];
  if(/^(n\/?a|-)$/i.test(v.certificate_number||''))calibration.certificate_number=null;
  for(const k of ['issue_date','due_date'])if(v[k])calibration[k]=umaDate(v[k]);
  if(v.issue_date)calibration.calibration_date=calibration.issue_date;
  if(v.interval_months)calibration.interval_months=interval(v.interval_months);
  if(v.calibration_kind){if(!/^(internal|eksternal)$/i.test(v.calibration_kind))throw Error("Jenis kalibrasi harus Internal atau Eksternal.");calibration.calibration_internal=/^internal$/i.test(v.calibration_kind)?'√':'-';calibration.calibration_external=calibration.calibration_internal==='√'?'-':'√';}
  for(const [a,b] of [['calibration_internal','calibration_external'],['significant_yes','significant_no']]){
    if(v[a])calibration[a]=mark(v[a]);if(v[b])calibration[b]=mark(v[b]);
    if(calibration[a]&&!calibration[b])calibration[b]=calibration[a]==='√'?'-':'√';
    if(calibration[b]&&!calibration[a])calibration[a]=calibration[b]==='√'?'-':'√';
    if(calibration[a]==='√'&&calibration[b]==='√')throw Error(`${a.startsWith('calibration')?'Internal/Eksternal':'Signifikan Ya/Tidak'} tidak boleh sama-sama dicentang.`);
  }
  if(v.significant){calibration.significant_yes=mark(v.significant);calibration.significant_no=calibration.significant_yes==='√'?'-':'√';}
  // A source laboratory is evidence; retain it even for historical internal entries.
  if(typeof calibration.laboratory==='string')calibration.laboratory=normalizeCalibrationLaboratory(calibration.laboratory);
  if(calibration.calibration_internal==='√'&&!calibration.laboratory)calibration.laboratory=calibrationLaboratories[0];
  if(v.result){if(!/^(layak|tidak layak|tidak_layak)$/i.test(v.result))throw Error("Hasil kalibrasi harus Layak atau Tidak layak.");calibration.result=v.result.toLowerCase().replace(' ','_');}
  if(calibration.issue_date&&calibration.interval_months&&!v.due_date)calibration.due_date=addMonths(String(calibration.issue_date),Number(calibration.interval_months));
  if(calibration.issue_date&&calibration.due_date&&String(calibration.due_date)<String(calibration.issue_date))throw Error("Tanggal berakhir mendahului tanggal terbit.");
  if(v.measurement_range){asset.measurement_ranges=[v.measurement_range];asset.measurement_range=v.measurement_range;calibration.monitoring_measurements=[{measurement_range:v.measurement_range,correction_factor:v.correction_factor||''}];if(v.correction_factor)calibration.correction_factor=v.correction_factor;}
  return {sheet,row,portfolio:p,name,tag,serial:v.serial,asset,calibration,raw:v};
}
export async function parseUma(name:string,bytes:Buffer,fallback='') {
  if(bytes.length<1||bytes.length>MAX_IMPORT_BYTES)throw new UmaImportError(['Berkas harus berukuran 1 byte sampai 5 MiB.']);
  const rows:SyncRow[]=[],issues:string[]=[],ignored:string[]=[];
  const add=(v:Values,s:string,r:number)=>{try{rows.push(normalizeRow(v,s,r,fallback));}catch(e){issues.push(`${s} baris ${r}: ${(e as Error).message}`);}};
  if(/\.csv$/i.test(name)){
    const records=parse(bytes,{bom:true,skip_empty_lines:true,max_record_size:64000,delimiter:bytes.subarray(0,4000).toString().split('\n')[0].includes(';')?';':','}) as string[][];
    if(records.length>251)throw new UmaImportError(['Maksimum 250 baris alat/peristiwa per unggahan. Bagi file per portofolio.']);
    const headers=(records.shift()||[]).map(h=>key(h)||'');
    if(!headers.includes('name')||!headers.includes('tag'))throw new UmaImportError(['Header Nama Barang dan Tag-Number tidak ditemukan.']);
    if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new UmaImportError(['Kolom CSV duplikat; gunakan satu kolom untuk setiap parameter UMA.']);
    records.forEach((r,i)=>add(Object.fromEntries(headers.flatMap((h,j)=>h?[[h,text(r[j])]]:[])), 'CSV',i+2));
  }else if(/\.xlsx$/i.test(name)){
    checkZip(bytes);const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
    for(const sheet of book.worksheets){
      if(sheet.state!=='visible'||/ringkasan|summary|arsip|riwayat/i.test(sheet.name)){ignored.push(sheet.name);continue;}
      if(sheet.rowCount>20000||sheet.columnCount>100)throw new UmaImportError([`${sheet.name}: maksimum 20.000 baris fisik dan 100 kolom.`]);
      let start=0,cols:Record<string,number>={};
      for(let n=1;n<=Math.min(100,sheet.rowCount);n++){
        const found:Record<string,number>={};sheet.getRow(n).eachCell((c,i)=>{const k=key(cellText(c));if(k)found[k]=i;});
        if(found.name&&found.tag){start=n;cols=found;break;}
      }
      if(!start){ignored.push(sheet.name);continue;}
      const titleCodes=new Set<string>();
      for(let n=1;n<start;n++)sheet.getRow(n).eachCell(c=>{
        const title=text(cellText(c)).toUpperCase();
        if(!/UNIT\s*KERJA|CABANG|PORTOFOLIO|PORTFOLIO/.test(title))return;
        for(const code of title.match(/\b(?:IND|PIK|SERCO|SCE|KSP|HMPM|AEBT|LAB|MIN|BBR|LSI)\b/g)||[])titleCodes.add(portfolio(code));
        if(/MINERAL\s*INSPEKSI|INSPEKSI\s*MINERAL/.test(title))titleCodes.add('MIN');
      });
      const inferredPortfolio=portfolio(sheet.name)||(titleCodes.size===1?[...titleCodes][0]:'');
      let end=start;
      for(const m of sheet.model.merges||[]){const parts=m.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);if(parts&&Number(parts[1])<=start&&Number(parts[2])<=start+4)end=Math.max(end,Number(parts[2]));}
      // Leaf labels in multi-level UMA headers supersede section labels.
      cols={};for(let n=start;n<=end;n++)sheet.getRow(n).eachCell((c,i)=>{const k=key(cellText(c));if(k)cols[k]=i;});
      if(cols.calibration_internal||cols.calibration_external)delete cols.calibration_kind;
      if(cols.significant_yes||cols.significant_no)delete cols.significant;
      // Original UMA/198 sheets sometimes leave V's header blank but contain notes below it.
      // Recognize that native layout by its actual column identities, never by sheet name.
      if(!cols.notes&&cols.name===2&&cols.tag===3&&cols.correction_factor===19&&cols.significant_no===21)cols.notes=22;
      let current:{v:Values;row:number;master:string;groups:Map<string,{measurement_range:string;factors:string[]}>}|undefined;
      const flush=()=>{if(!current)return;const before=rows.length;add(current.v,sheet.name,current.row);if(rows.length>before&&current.groups.size){const groups=[...current.groups.values()].map(g=>({measurement_range:g.measurement_range,correction_factor:g.factors.join('\n')}));const out=rows.at(-1)!;out.asset.measurement_ranges=groups.map(g=>g.measurement_range);out.asset.measurement_range=groups.map(g=>g.measurement_range).join('\n');out.calibration.monitoring_measurements=groups;out.calibration.correction_factor=groups.map(g=>g.correction_factor).join('\n');}current=undefined;};
      for(let n=end+1;n<=sheet.rowCount;n++){
        const r=sheet.getRow(n);const first=[1,2,3].map(i=>text(cellText(r.getCell(i)))).join(' ');
        if(/Diketahui oleh|Disiapkan oleh|Keterangan\s*:|FOR\/SCI|Nama barang\s*=/i.test(first)){flush();break;}
        const nameCell=r.getCell(cols.name),nameValue=text(cellText(nameCell));
        if(!nameValue){if(current&&r.values.toString().replace(/,/g,'').trim()==='')flush();continue;}
        if(!current||current.master!==nameCell.master.address){flush();const v:Values={};for(const [k,i]of Object.entries(cols)){const c=r.getCell(i);const raw=c.value;if(raw&&typeof raw==='object'&&'formula'in raw&&raw.result===undefined){issues.push(`${sheet.name} baris ${n}: formula tanpa hasil tersimpan.`);}v[k]=raw instanceof Date?raw.toISOString().slice(0,10):text(cellText(c));}
          if(!v.portfolio&&inferredPortfolio)v.portfolio=inferredPortfolio;
          current={v,row:n,master:nameCell.master.address,groups:new Map()};
        }
        if(cols.measurement_range){const range=r.getCell(cols.measurement_range);const rv=text(cellText(range));if(rv){const id=range.master.address;let g=current.groups.get(id);if(!g){g={measurement_range:rv,factors:[]};current.groups.set(id,g);}if(cols.correction_factor){const f=r.getCell(cols.correction_factor);if(f.master.address===f.address&&text(cellText(f)))g.factors.push(text(cellText(f)));}}}
      }
      flush();
    }
  }else throw new UmaImportError(['Gunakan XLSX atau CSV. Untuk XLS lama, simpan sebagai XLSX terlebih dahulu.']);
  const merged=new Map<string,SyncRow>();
  for(const r of rows){
    const id=[r.portfolio,label(r.tag),label(r.name),label(r.serial),label(r.calibration.certificate_number),r.calibration.issue_date||''].join('|');const previous=merged.get(id);
    for(const v of Object.values(r.raw))if(v.length>12000)issues.push(`${r.sheet} baris ${r.row}: isi sel terlalu panjang.`);
    if(!previous){merged.set(id,r);continue;}
    if(r.sheet!==previous.sheet){issues.push(`${r.sheet} baris ${r.row}: alat berulang pada sheet berbeda. Pilih data terbaru saja.`);continue;}
    const groupKeys=['measurement_range','measurement_ranges','monitoring_measurements','correction_factor'];
    let conflict=false;
    for(const part of ['asset','calibration'] as const)for(const [k,v]of Object.entries(r[part])){
      if(groupKeys.includes(k))continue;
      if(k in previous[part]&&JSON.stringify(previous[part][k])!==JSON.stringify(v)){issues.push(`${r.sheet} baris ${r.row}: alat berulang dengan nilai ${k} berbeda. Gunakan data terbaru yang konsisten.`);conflict=true;}else previous[part][k]=v;
    }
    const groups=[...(previous.calibration.monitoring_measurements as Record<string,string>[]||[]),...(r.calibration.monitoring_measurements as Record<string,string>[]||[])];
    const unique=[...new Map(groups.map(g=>[JSON.stringify(g),g])).values()];
    if(!conflict&&unique.length){previous.calibration.monitoring_measurements=unique;previous.asset.measurement_ranges=unique.map(g=>g.measurement_range);previous.asset.measurement_range=unique.map(g=>g.measurement_range).join('\n');previous.calibration.correction_factor=unique.map(g=>g.correction_factor).join('\n');}
    else if(!unique.length)issues.push(`${r.sheet} baris ${r.row}: alat berulang dalam file. Satukan data terbarunya.`);
  }
  const result=[...merged.values()];
  if(result.length>250)issues.push('Maksimum 250 baris alat/peristiwa per unggahan. Bagi file per portofolio.');
  if(!rows.length&&!issues.length)issues.push('Tidak ada tabel UMA yang ditemukan. Gunakan header Nama Barang dan Tag-Number.');
  if(issues.length)throw new UmaImportError(issues.slice(0,100));
  return {rows:result,ignored,hash:createHash('sha256').update(bytes).update(fallback).digest('hex')};
}
