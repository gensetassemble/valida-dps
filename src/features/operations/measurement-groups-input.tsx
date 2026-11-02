"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeasurementRangeInput } from "./measurement-range-input";
import type { MeasurementGroupInput } from "./measurement-groups";

export function MeasurementGroupsInput({
  value,
  onChange,
  branch,
  factors = false,
  error,
}: {
  value: MeasurementGroupInput[];
  onChange: (groups: MeasurementGroupInput[]) => void;
  branch: string;
  factors?: boolean;
  error?: string;
}) {
  const [keys, setKeys] = useState(() => value.map((_, i) => i));
  const [nextKey, setNextKey] = useState(value.length);
  const [removing, setRemoving] = useState<number | null>(null);
  function update(index: number, patch: Partial<MeasurementGroupInput>) {
    onChange(value.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] leading-5 text-muted-foreground">
        Satu baris untuk satu rentang/parameter.{" "}
        {factors
          ? "Faktor koreksi pada baris yang sama hanya untuk rentang tersebut; satu nilai per baris teks."
          : "Faktor koreksi diisi per rentang saat mencatat atau mengubah kalibrasi; hasil sertifikat lama tidak diubah lewat identitas alat."}
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div
          className={`hidden gap-3 bg-slate-50 p-2 text-xs font-semibold sm:grid ${factors ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]" : "sm:grid-cols-[minmax(0,1fr)_2rem]"}`}
        >
          <span>Rentang ukur / kapasitas</span>
          {factors && <span>Faktor koreksi</span>}
          <span className="sr-only">Hapus</span>
        </div>
        {value.map((group, index) => (
          <fieldset
            key={keys[index] ?? index}
            className={`relative grid min-w-0 gap-2 border-t border-border p-2 ${factors ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]" : "sm:grid-cols-[minmax(0,1fr)_2rem]"}`}
          >
            <legend className="sr-only">Kelompok ukur {index + 1}</legend>
            <div className="min-w-0">
              <label
                htmlFor={`range-${keys[index] ?? index}`}
                className="mb-1 block text-[11px] font-semibold"
              >
                [{index + 1}] Rentang ukur / kapasitas
              </label>
              <MeasurementRangeInput
                id={`range-${keys[index] ?? index}`}
                value={group.measurement_range}
                onChange={(measurement_range) =>
                  update(index, { measurement_range })
                }
                branch={branch}
              />
            </div>
            {factors && (
              <div className="min-w-0">
                <label
                  htmlFor={`factor-${keys[index] ?? index}`}
                  className="mb-1 block text-[11px] font-semibold"
                >
                  [{index + 1}] Faktor koreksi
                </label>
                <textarea
                  id={`factor-${keys[index] ?? index}`}
                  value={group.correction_factor.replace(/\\n/g, "\n")}
                  onChange={(e) =>
                    update(index, { correction_factor: e.target.value })
                  }
                  rows={3}
                  maxLength={10000}
                  placeholder={"Contoh: 0,022\n0,023\n0,024"}
                  className="min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm"
                />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={value.length === 1}
              aria-label={`Hapus kelompok ukur ${index + 1}`}
              onClick={() => {
                setRemoving(index);
              }}
            >
              <Trash2 size={15} />
            </Button>
          </fieldset>
        ))}
      </div>
      {removing !== null && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs"
        >
          <span>
            Hapus kelompok {removing + 1}
            {factors ? " beserta faktor koreksinya" : ""}? Perubahan berlaku
            setelah disimpan.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setKeys(keys.filter((_, i) => i !== removing));
              onChange(value.filter((_, i) => i !== removing));
              setRemoving(null);
            }}
          >
            Ya, hapus kelompok
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRemoving(null)}
          >
            Batal hapus kelompok
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length >= 200 || removing !== null}
        onClick={() => {
          setKeys([...keys, nextKey]);
          setNextKey(nextKey + 1);
          onChange([
            ...value,
            { measurement_range: "", correction_factor: "" },
          ]);
        }}
      >
        <Plus size={15} />
        Tambah rentang ukur / kapasitas
      </Button>
    </div>
  );
}
