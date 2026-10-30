"use client";
import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { SI_UNITS, ACCEPTED_UNITS, splitMeasurement, joinMeasurement } from "./measurement-units";

export function MeasurementRangeInput({ id, value, branch, onChange, invalid, describedBy }: { id: string; value: string; branch: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string }) {
  const [parts, setParts] = useState(() => splitMeasurement(value));
  const [custom, setCustom] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const historyId = useId();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/operations/measurement-units?branch=" + encodeURIComponent(branch), { signal: controller.signal })
      .then(async (r) => r.ok ? r.json() : null)
      .then((data) => { if (Array.isArray(data?.units)) setHistory(data.units); })
      .catch(() => { /* Standard symbols and manual input remain available. */ });
    return () => controller.abort();
  }, [branch]);
  const legacy = [...new Set([...history, ...(parts.unit && !SI_UNITS.includes(parts.unit) && !ACCEPTED_UNITS.includes(parts.unit) ? [parts.unit] : [])])];
  function update(next: { range: string; unit: string }) { setParts(next); onChange(joinMeasurement(next.range, next.unit)); }
  return <div className="space-y-2">
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.65fr)]">
      <Input id={id} value={parts.range} onChange={(e) => update({ ...parts, range: e.target.value })} maxLength={1900} placeholder="Contoh: 0–2000 / 1" aria-invalid={invalid} aria-describedby={describedBy}/>
      <select aria-label="Simbol satuan ukur" value={custom ? "__other" : parts.unit} onChange={(e) => { if (e.target.value === "__other") setCustom(true); else { setCustom(false); update({ ...parts, unit: e.target.value }); } }} className="h-10 min-w-0 w-full rounded-lg border border-input bg-white px-2 text-sm">
        <option value="">Tanpa / sudah tercantum</option>
        <optgroup label="Simbol SI">{SI_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</optgroup>
        <optgroup label="Diterima bersama SI / turunan">{ACCEPTED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</optgroup>
        {!!legacy.length && <optgroup label="Histori / satuan non-SI">{legacy.map((u) => <option key={u} value={u}>{u}</option>)}</optgroup>}
        <option value="__other">Satuan lain…</option>
      </select>
    </div>
    {custom && <Input aria-label="Satuan ukur lain" value={parts.unit} onChange={(e) => update({ ...parts, unit: e.target.value })} maxLength={24} placeholder="Tulis simbol satuan" list={historyId}/>}
    <datalist id={historyId}>{history.map((unit) => <option key={unit} value={unit}/>)}</datalist>
  </div>;
}
