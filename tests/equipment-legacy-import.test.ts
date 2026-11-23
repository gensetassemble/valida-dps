import {it,expect,vi} from 'vitest';
import {utils,write} from 'xlsx';
vi.mock('server-only',()=>({}));
import {parseUma} from '@/features/equipment-sync/parser';
for(const format of ['xls','xlsb'] as const)it(`reads ${format} merged correction rows, dates, leading zero serials and notes`,async()=>{
 const book=utils.book_new();
 const s=utils.aoa_to_sheet([
  ['Nama Barang','Tag-Number','Serial Number','Nomor Sertifikat','Tanggal terbit sertifikat','Tanggal Berakhir','Range / Kapasitas','Faktor Koreksi','Keterangan'],
  ['Rotameter Impinger','LAB-001','00123','K-1236 A / KL',new Date('2026-01-10T00:00:00Z'),new Date('2027-01-10T00:00:00Z'),'0–15 L/min','0,1','Posisi katup A'],
  [null,null,null,null,null,null,null,'-0,2'],
  ['Rotameter Impinger','LAB-001','00123','K-1236 B / KL',new Date('2026-01-10T00:00:00Z'),new Date('2027-01-20T00:00:00Z'),'0–15 L/min','0,3','Posisi katup B'],
 ]);
 s['!merges']=Array.from({length:7},(_,c)=>({s:{r:1,c},e:{r:2,c}}));utils.book_append_sheet(book,s,'LAB');
 const parsed=await parseUma(`fixture.${format}`,Buffer.from(write(book,{type:'buffer',bookType:format})));
 expect(parsed.rows).toHaveLength(2);expect(parsed.rows[0].serial).toBe('00123');expect(parsed.rows[0].asset.notes).toBe('Posisi katup A');
 expect(parsed.rows[0].calibration.issue_date).toBe('2026-01-10');expect(parsed.rows[1].calibration.due_date).toBe('2027-01-20');
 expect(parsed.rows[0].calibration.monitoring_measurements).toEqual([{measurement_range:'0–15 L/min',correction_factor:'0,1\n-0,2'}]);
});
it('skips exact repeated rows across sheets, but refuses conflicting updates',async()=>{
 const b=utils.book_new();for(const title of ['LAB','Rev 03'])utils.book_append_sheet(b,utils.aoa_to_sheet([['Nama Barang','Tag-Number','Keterangan'],['Pump','LAB-001','Patah']]),title);
 const bytes=Buffer.from(write(b,{type:'buffer',bookType:'xlsb'}));const p=await parseUma('file.xlsb',bytes,'LAB');expect(p.rows).toHaveLength(1);expect(p.duplicates).toBe(1);
 await expect(parseUma('file.csv',Buffer.from('Nama Barang,Tag-Number,Keterangan\nPump,LAB-1,Patah\nPump,LAB-1,Baik'),'LAB')).rejects.toMatchObject({issues:expect.arrayContaining([expect.stringContaining('berbeda')])});
 await expect(parseUma('fake.xls',Buffer.from('not an Excel file'),'LAB')).rejects.toMatchObject({issues:[expect.stringContaining('Format XLS')]});
});
it('detects a legacy XLS container even when the filename says XLSX',async()=>{
 const b=utils.book_new();utils.book_append_sheet(b,utils.aoa_to_sheet([
  ['Nama Barang','Tag-Number','Lembaga Kalibrasi','Internal','Eksternal'],
  ['Pump','LAB-009','Laboratorium Cibitung','-','√'],
 ]),'LAB');
 const bytes=Buffer.from(write(b,{type:'buffer',bookType:'xls'}));
 const parsed=await parseUma('laporan-yang-salah-ekstensi.xlsx',bytes,'LAB');
 expect(parsed.rows).toHaveLength(1);
 expect(parsed.rows[0].calibration).toMatchObject({
  laboratory:'PT SUCOFINDO Laboratorium Cibitung',calibration_internal:'√',calibration_external:'-',
 });
});
