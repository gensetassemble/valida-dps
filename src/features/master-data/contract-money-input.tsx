"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { contractDisplay, contractInput } from "./contract-money";
export function ContractMoneyInput({id,value,onChange,invalid}: {
  id: string; value: unknown; onChange: (value: string) => void; invalid?: boolean;
}) {
  const [draft,setDraft] = useState<string | null>(null);
  return <Input id={id} inputMode="decimal" aria-invalid={invalid}
    placeholder="IDR 170.000.000,-" value={draft ?? contractDisplay(value)}
    onFocus={() => setDraft(String(value ?? "").replace(".", ","))}
    onChange={e => {setDraft(e.target.value); onChange(contractInput(e.target.value));}}
    onBlur={() => setDraft(null)} />;
}
