import Link from 'next/link';
import {Card} from '@/components/ui/card';
import {formatBusinessDate} from '@/lib/format';
import {measurementInputs} from './measurement-groups';
import type {DataRow} from '@/features/master-data/server';
export function CalibrationComponentsTable({rows,branch}:{rows:DataRow[];branch:string}){
 return <Card className="mb-4 overflow-x-auto p-4"><h2 className="text-sm font-bold">Sertifikat per bagian / katup · {rows.length}</h2><p className="mb-3 text-xs text-muted-foreground">Satu alat; sertifikat dan faktor koreksi dicatat untuk setiap bagian. Status alat mengikuti tanggal berakhir terdekat.</p>
 <table className="w-full min-w-[650px] text-left text-xs"><thead><tr>{['Bagian / katup','Nomor sertifikat','Terbit','Berakhir','Range / Kapasitas','Faktor koreksi'].map(h=><th key={h} className="border-b p-2">{h}</th>)}</tr></thead><tbody>
 {rows.flatMap(part=>measurementInputs(part).map((m,i)=><tr key={`${part.id}-${i}`}>
 <td className="border-b p-2 align-top">{i===0?String(part.component_label):''}</td><td className="border-b p-2 align-top">{i===0?<Link className="font-semibold text-primary underline" href={`/peristiwa-kalibrasi/${part.id}?branch=${branch}`}>{String(part.certificate_number||'Belum dicatat')}</Link>:''}</td>
 <td className="border-b p-2 align-top whitespace-nowrap">{i===0?formatBusinessDate((part.issue_date||part.calibration_date) as string|null):''}</td><td className="border-b p-2 align-top whitespace-nowrap">{i===0?formatBusinessDate(part.due_date as string|null):''}</td>
 <td className="border-b p-2 align-top whitespace-pre-wrap">{m.measurement_range||'—'}</td><td className="border-b p-2 align-top whitespace-pre-wrap">{m.correction_factor||'—'}</td></tr>))}
 </tbody></table></Card>;
}
