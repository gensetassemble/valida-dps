"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
export function ClientIntervalInput({ months, days, onChange }: {
  months: unknown; days: unknown; onChange: (months: string, days: string) => void;
}) {
  const [unit, setUnit] = useState(days ? "days" : "months");
  const value = String((unit === "days" ? days : unit === "years" ? Number(months || 0) / 12 : months) || "");
  return <div className="flex gap-2">
    <Input id="interval_months" type="number" min={1} step={1} max={unit === "days" ? 36500 : unit === "years" ? 50 : 600}
      aria-label="Jumlah interval sertifikat" value={value}
      onChange={e => onChange(unit === "months" ? e.target.value : unit === "years" && e.target.value ? String(Number(e.target.value)*12) : "", unit === "days" ? e.target.value : "")} />
    <select aria-label="Satuan interval sertifikat" value={unit} className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
      onChange={e => { setUnit(e.target.value); onChange("", ""); }}>
      <option value="days">Hari</option><option value="months">Bulan</option><option value="years">Tahun</option>
    </select>
  </div>;
}
