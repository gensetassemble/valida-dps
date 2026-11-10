import { describe, expect, it } from "vitest";
import { equipmentExportQuery, normalizeEquipmentExport, portfolioIds } from "@/features/operations/equipment-export-scope";
const a="cf210000-0000-4000-8000-000000000001",b="cf210000-0000-4000-8000-000000000002";
describe("equipment export scope",()=>{
 it("replaces only portfolio/pagination and preserves other report filters",()=>{
  const p=equipmentExportQuery(new URLSearchParams(`branch=DPS&portfolio=${a}&page=4&q=meter&unit=Denpasar&validity=Expired&sort=priority`),"selected",[a,b,a]);
  expect(p.get('portfolios')).toBe(a+','+b);expect(p.has('portfolio')).toBe(false);expect(p.has('page')).toBe(false);
  expect(p.get('branch')).toBe('DPS');expect(p.get('q')).toBe('meter');expect(p.get('unit')).toBe('Denpasar');expect(p.get('validity')).toBe('Expired');
 });
 it("all portfolios clears the single selection and explicit IDs",()=>{
  const p=normalizeEquipmentExport(new URLSearchParams(`entity=kalibrasi-alat&portfolio=${a}&portfolios=${b}&portfolio_selection=all&branch=DPS`));
  expect(p.has('portfolio')).toBe(false);expect(p.has('portfolios')).toBe(false);expect(p.get('portfolio_selection')).toBe('all');
 });
 it("does not silently turn an empty/malformed selected scope into all",()=>{
  expect(()=>normalizeEquipmentExport(new URLSearchParams('portfolio_selection=selected'))).toThrow();
  expect(()=>portfolioIds(a+',not-a-uuid')).toThrow();expect(()=>portfolioIds(Array(101).fill(a).join(','))).toThrow();
 });
 it("keeps the existing export URL compatible",()=>{
  const p=new URLSearchParams(`entity=kalibrasi-alat&portfolio=${a}`);expect(normalizeEquipmentExport(p).toString()).toBe(p.toString());
 });
});
