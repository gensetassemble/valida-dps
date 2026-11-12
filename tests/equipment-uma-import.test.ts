import { describe,it,expect,vi } from "vitest";
import ExcelJS from "exceljs";
vi.mock('server-only',()=>({}));
import { parseUma,umaDate,UmaImportError } from "@/features/equipment-sync/parser";
import { monitoringXlsx } from "@/features/operations/monitoring-xlsx";
import { readFile } from 'node:fs/promises';
describe('UMA monitoring import',()=>{
  if(process.env.UMA_SOURCE_PATH)it('inspects the supplied PTK workbook without changing any data',async()=>{
    const data=await readFile(process.env.UMA_SOURCE_PATH!);
    try{const result=await parseUma('source.xlsx',data);console.log(JSON.stringify({tools:result.rows.length,notes:result.rows.filter(r=>r.asset.notes).length,ignored:result.ignored}));}
    catch(e){expect(e).toBeInstanceOf(UmaImportError);expect((e as UmaImportError).issues.every(s=>s.includes('sama-sama dicentang'))).toBe(true);console.log(JSON.stringify({rejectedConflictingMarks:(e as UmaImportError).issues}));}
  });
  it('reads native exported UMA headers, merged physical rows, notes and paired correction groups',async()=>{
    const bytes=await monitoringXlsx([{id:'a',name:'Heat Stress Analysis',tag:'LAB-001',portfolio_code:'LAB',notes:'Patah',latest_calibration_date:'2026-11-01',latest_due_date:'2027-11-01',monitoring_interval:'1 Tahun',monitoring_certificate:'CERT-1',calibration_internal:'√',calibration_external:'-',significant_yes:'√',significant_no:'-',monitoring_measurements:[{measurement_range:'0–100 °C',correction_factor:'0\n-1\n2'},{measurement_range:'0–99 % RH',correction_factor:'0,1\n0,2'}]}],'DPS','2026-11-12');
    const parsed=await parseUma('monitoring.xlsx',bytes);
    expect(parsed.rows).toHaveLength(1);
    const row=parsed.rows[0];expect(row.portfolio).toBe('LAB');expect(row.asset.notes).toBe('Patah');
    expect(row.calibration.issue_date).toBe('2026-11-01');expect(row.calibration.due_date).toBe('2027-11-01');
    expect(row.calibration.interval_months).toBe(12);
    expect(row.calibration.monitoring_measurements).toEqual([{measurement_range:'0–100 °C',correction_factor:'0\n-1\n2'},{measurement_range:'0–99 % RH',correction_factor:'0,1\n0,2'}]);
  });
  it('reads CSV, preserves blank fields, honors explicit note clearing and derives expiry',async()=>{
    const r=await parseUma('x.csv',Buffer.from('Nama Barang;Tag-Number;Portofolio;Tanggal terbit sertifikat;Interval;Keterangan;Jenis Kalibrasi;Signifikan\nAlat A;A001;PIK;31/01/2026;1 bulan;[KOSONGKAN];Internal;Tidak'));
    expect(r.rows[0].calibration.due_date).toBe('2026-02-28');expect(r.rows[0].asset.notes).toBeNull();
    expect(r.rows[0].calibration.calibration_internal).toBe('√');expect(r.rows[0].calibration.significant_no).toBe('√');expect(r.rows[0].asset).not.toHaveProperty('location');
    const na=await parseUma('x.csv',Buffer.from('Nama Barang,Tag-Number,Nomor Sertifikat,Tanggal terbit sertifikat,Tanggal Berakhir\nPump,PIK-001,N/A,N/A,N/A'),'PIK');
    expect(na.rows[0].calibration.certificate_number).toBeNull();expect(na.rows[0].calibration.issue_date).toBeNull();
  });
  it('rejects invalid dates, conflicting marks and duplicate tools instead of guessing',async()=>{
    expect(()=>umaDate('31/02/2026')).toThrow();expect(umaDate('N/A')).toBeNull();expect(umaDate('12-Nov-26')).toBe('2026-11-12');
    await expect(parseUma('x.csv',Buffer.from('Nama Barang,Tag-Number,Internal,Eksternal\nAlat A,A001,√,√'),'PIK')).rejects.toMatchObject({issues:[expect.stringContaining('sama-sama')]});
    await expect(parseUma('x.csv',Buffer.from('Nama Barang,Tag-Number\nAlat A,A001\nAlat A,A001'),'PIK')).rejects.toMatchObject({issues:[expect.stringContaining('berulang')]});
  });
  it('handles multi-portfolio sheets and skips management summaries without inventing a portfolio',async()=>{
    const book=new ExcelJS.Workbook();for(const code of ['LAB','PIK']){const s=book.addWorksheet(code);s.addRow(['Nama Barang','Tag-Number','Keterangan']);s.addRow(['Alat A',code+'001','Siap']);}book.addWorksheet('Ringkasan Manajemen').addRow(['Jumlah',2]);
    const r=await parseUma('x.xlsx',Buffer.from(await book.xlsx.writeBuffer()));expect(r.rows.map(v=>v.portfolio)).toEqual(['LAB','PIK']);expect(r.ignored).toContain('Ringkasan Manajemen');
    await expect(parseUma('x.csv',Buffer.from('Nama Barang,Tag-Number\nAlat A,A001'))).rejects.toMatchObject({issues:[expect.stringContaining('Portofolio')]});
  });
  it('combines repeated measurement blocks, while retaining separate certificates on one instrument',async()=>{
    const book=new ExcelJS.Workbook();const s=book.addWorksheet('LAB');s.addRow(['Nama Barang','Tag-Number','Nomor Sertifikat','Tanggal terbit sertifikat','Range / Kapasitas','Faktor Koreksi']);
    s.addRow(['Pump','LAB-001','A','01/01/2026','0–1 L','0,1']);s.addRow(['Pump','LAB-001','A','01/01/2026','1–10 L','0,2']);s.addRow(['Pump','LAB-001','B','01/01/2026','10–20 L','0,3']);
    const r=await parseUma('x.xlsx',Buffer.from(await book.xlsx.writeBuffer()));expect(r.rows).toHaveLength(2);expect(r.rows[0].calibration.monitoring_measurements).toHaveLength(2);expect(r.rows[1].calibration.certificate_number).toBe('B');
  });
});
