import{describe,it,expect,vi}from'vitest';
import ExcelJS from'exceljs';
vi.mock('server-only',()=>({}));
import{rotameterComponent,componentReportRow}from'@/features/operations/calibration-components';
import{monitoringXlsx}from'@/features/operations/monitoring-xlsx';
import{parseUma}from'@/features/equipment-sync/parser';
describe('one instrument with valve certificates',()=>{
 it('uses only an explicit certificate letter for legacy Rotameter valves',()=>{
  expect(rotameterComponent('Rotameter Impinger','K - 1236C / KL / 2025')).toBe('Katup C');
  expect(rotameterComponent('Pump','K-1236C / KL')).toBeNull();
  expect(rotameterComponent('Rotameter','CERT-1')).toBeNull();
 });
 it('exports each valve separately, merges only equipment identity and reimports the same certificates',async()=>{
  const equipment={id:'tool',name:'Rotameter Impinger',tag:'LAB-001',serial:'S1',portfolio_code:'LAB'};
  const parts=[
   {id:'a',component_label:'Katup A',certificate_number:'K-1236 A / KL',issue_date:'2025-12-10',due_date:'2026-12-10',monitoring_measurements:[{measurement_range:'0–15 L/min',correction_factor:'0,1\n0,2'}]},
   {id:'b',component_label:'Katup B',certificate_number:'K-1236 B / KL',issue_date:'2025-12-10',due_date:'2026-12-20',monitoring_measurements:[{measurement_range:'0–15 L/min',correction_factor:'-0,3'}]},
  ];
  const bytes=await monitoringXlsx([{...equipment,calibration_components:parts.map(p=>componentReportRow(equipment,p))}],'DPS','2026-11-13');
  const b=new ExcelJS.Workbook();await b.xlsx.load(Uint8Array.from(bytes).buffer);const s=b.getWorksheet('LAB')!;
  expect(s.getCell('B11').master.address).toBe('B9');expect(s.getCell('A11').value).toBe(1);
  expect(s.getCell('J9').text).toBe('Bagian: Katup A\nK-1236 A / KL');expect(s.getCell('J11').text).toBe('Bagian: Katup B\nK-1236 B / KL');
  expect(s.getCell('J10').master.address).toBe('J9');expect(s.getCell('J11').master.address).toBe('J11');
  expect(s.getCell('M9').value).toEqual(new Date('2026-12-10T00:00:00Z'));expect(s.getCell('M11').value).toEqual(new Date('2026-12-20T00:00:00Z'));
  expect(s.getCell('S9').text).toBe('0,1');expect(s.getCell('S10').text).toBe('0,2');expect(s.getCell('S11').text).toBe('-0,3');
  const imported=await parseUma('valves.xlsx',bytes);expect(imported.rows).toHaveLength(2);
  expect(imported.rows.map(r=>r.calibration.component_label)).toEqual(['Katup A','Katup B']);
  expect(imported.rows.map(r=>r.calibration.certificate_number)).toEqual(['K-1236 A / KL','K-1236 B / KL']);
 });
});
