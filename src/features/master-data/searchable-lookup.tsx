"use client";
import {useState} from "react";
import {Popover} from "radix-ui";
import {Check,ChevronDown} from "lucide-react";
import {Input} from "@/components/ui/input";
export function SearchableLookup({id,label,value,options,query,onQuery,onChange,disabled,status}: {
  id:string; label:string; value:string; options:{value:string;label:string}[];
  query:string; onQuery:(value:string)=>void; onChange:(value:string)=>void;
  disabled?:boolean; status:string;
}) {
  const [open,setOpen]=useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger id={id} disabled={disabled} role="combobox" aria-expanded={open}
      aria-controls={id+"-list"} aria-label={label}
      className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-white px-3 py-2 text-left text-sm transition-colors hover:border-primary data-[state=open]:border-primary disabled:bg-muted">
      <span className="min-w-0 break-words">{options.find(o=>o.value===value)?.label || (value ? "Memuat pilihan…" : "Pilih "+label.toLowerCase())}</span><ChevronDown size={16} className="shrink-0"/>
    </Popover.Trigger>
    <Popover.Portal><Popover.Content sideOffset={5} collisionPadding={12}
      className="z-[100] max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-xl">
      <Input value={query} onChange={e=>onQuery(e.target.value)} placeholder={"Cari "+label.toLowerCase()+"…"}
        aria-label={"Cari "+label.toLowerCase()} maxLength={100}/>
      <div id={id+"-list"} role="listbox" aria-label={label} className="mt-2 max-h-64 overflow-y-auto">
        {[{value:"",label:"Pilih "+label.toLowerCase()},...options].map(o=><button key={o.value} type="button" role="option" aria-selected={value===o.value}
          onClick={()=>{onChange(o.value);setOpen(false);}}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/5 focus:bg-primary/5 aria-selected:bg-primary/10 aria-selected:font-semibold aria-selected:text-primary-hover">
          {o.label}{value===o.value && <Check size={14} className="shrink-0 text-primary"/>}
        </button>)}
      </div>
      <p role="status" className="px-3 py-1 text-[10px] text-muted-foreground">{status}</p>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
