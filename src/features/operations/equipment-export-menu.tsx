"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Popover } from "radix-ui";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { equipmentExportQuery } from "./equipment-export-scope";

export function EquipmentExportMenu({ branch, portfolios, unavailable = false }: {
  branch: string; portfolios: { id: string; code: string; count: number }[]; unavailable?: boolean;
}) {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const current = portfolios.some(p => p.id === params.get("portfolio")) ? params.get("portfolio")! : "";
  const [mode, setMode] = useState<"all" | "selected">(current ? "selected" : "all");
  const [selected, setSelected] = useState<string[]>(current ? [current] : []);
  const source = new URLSearchParams(params.toString()); source.set("branch", branch);
  const href = mode === "selected" && !selected.length ? null : "/api/operations/export?" + equipmentExportQuery(source, mode, selected);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild><Button type="button" variant="outline" disabled={unavailable} title={unavailable ? "Pilihan ekspor belum dapat dimuat. Gunakan Refresh." : undefined}><Download/>Ekspor XLSX<ChevronDown/></Button></Popover.Trigger>
    <Popover.Portal><Popover.Content align="end" sideOffset={8} collisionPadding={12} aria-label="Pilih portofolio untuk ekspor" className="z-[80] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-white p-4 shadow-xl">
      <h2 className="text-sm font-bold">Ekspor laporan kalibrasi</h2>
      <fieldset className="mt-3 space-y-2 text-xs"><legend className="sr-only">Cakupan portofolio</legend>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="equipment-export-scope" checked={mode === "all"} onChange={() => setMode("all")} className="mt-0.5 accent-primary"/><span>Seluruh portofolio<span className="mt-1 block text-[10px] text-muted-foreground">Hanya alat yang dapat Anda akses.</span></span></label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" name="equipment-export-scope" checked={mode === "selected"} onChange={() => setMode("selected")} className="accent-primary"/>Pilih beberapa portofolio</label>
      </fieldset>
      {mode === "selected" && <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">{selected.length} dipilih</span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(selected.length === portfolios.length ? [] : portfolios.map(p => p.id))}>{selected.length === portfolios.length ? "Kosongkan" : "Pilih semua"}</Button></div>
        <div className="grid max-h-52 grid-cols-2 gap-1 overflow-y-auto">{portfolios.map(p => <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-primary/5"><input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(old => e.target.checked ? [...old, p.id] : old.filter(id => id !== p.id))} className="accent-primary"/><span>{p.code}<span className="ml-1 text-[10px] text-muted-foreground">({p.count})</span></span></label>)}</div>
        {!portfolios.length && <p className="text-xs text-muted-foreground">Belum ada portofolio alat sesuai akses.</p>}
      </div>}
      <p className="mt-3 text-[10px] leading-5 text-muted-foreground">Filter lain seperti masa berlaku, pencarian, dan subunit tetap digunakan. Setiap portofolio menjadi sheet terpisah.</p>
      <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>{href ? <Button asChild><a href={href} onClick={() => setOpen(false)}><Download/>Unduh XLSX</a></Button> : <Button disabled>Pilih portofolio</Button>}</div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
