"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
const months = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60, 120];
export function IntervalInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  disabled,
}: {
  id: string;
  value: unknown;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const [custom, setCustom] = useState(false);
  const text = value === null || value === undefined ? "" : String(value),
    other = custom || (!!text && !months.includes(Number(text)));
  return (
    <div className="space-y-2">
      <select
        id={id}
        value={other ? "custom" : text}
        onChange={(e) => {
          setCustom(e.target.value === "custom");
          onChange(e.target.value === "custom" ? "" : e.target.value);
        }}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
      >
        <option value="">Belum ditentukan</option>
        {months.map((n) => (
          <option value={n} key={n}>
            {n} bulan{n % 12 === 0 ? " (" + n / 12 + " tahun)" : ""}
          </option>
        ))}
        <option value="custom">Interval lain…</option>
      </select>
      {other && (
        <Input
          type="number"
          min={1}
          max={600}
          aria-label="Interval khusus (bulan)"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
