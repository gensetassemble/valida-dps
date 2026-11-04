import { expect,it } from "vitest";
import { readFileSync } from "node:fs";
it("contains the complete province and regency/city snapshot with unique searchable labels",()=>{
 const rows=JSON.parse(readFileSync(new URL('../data/indonesia-regions/regions.json',import.meta.url),'utf8')) as {code:string;label:string;province:string}[];
 expect(rows).toHaveLength(552);expect(rows.filter(r=>r.code.length===2)).toHaveLength(38);
 expect(new Set(rows.map(r=>r.code)).size).toBe(552);expect(new Set(rows.map(r=>r.label)).size).toBe(552);
 expect(rows.every(r=>r.label.length<=120&&!!r.province)).toBe(true);
 expect(rows.find(r=>r.code==='51.71')?.label).toContain('Denpasar');
});
