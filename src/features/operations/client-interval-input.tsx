"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
export function ClientIntervalInput({ months, days, onChange }: {
  months: unknown; days: unknown; onChange: (months: string, days: string) => void;
}) {
  const [unit, setUnit] = useState(days ? "days" : "months");
  const value = String((unit === "days" ? days : months) || "");
  return <div className="flex gap-2">
    <Input id="interval_months" type="number" min={1} max={unit === "days" ? 36500 : 600}
      aria-label="Jumlah interval sertifikat" value={value}
      onChange={e => onChange(unit === "months" ? e.target.value : "", unit === "days" ? e.target.value : "")} />
    <select aria-label="Satuan interval sertifikat" value={unit} className="h-10 rounded-lg border border-input bg-white px-3 text-sm"
      onChange={e => { setUnit(e.target.value); onChange("", ""); }}>
      <option value="months">Bulan</option><option value="days">Hari</option>
    </select>
  </div>;
}
