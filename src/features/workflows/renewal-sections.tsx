"use client";

import { useState, type ReactNode } from "react";
import { SectionNavigation } from "@/components/ui/record-sections";

export function RenewalSections({ process, history, count }: {
  process: ReactNode;
  history: ReactNode;
  count: number;
}) {
  const [active, setActive] = useState("current");
  return <div className="mt-2">
    <SectionNavigation items={[
      { id: "current", label: "Proses saat ini" },
      { id: "history", label: `Riwayat (${count})` },
    ]} value={active} onChange={setActive} />
    <div hidden={active !== "current"} className="pt-3">{process}</div>
    <div hidden={active !== "history"} className="pt-3">{history}</div>
  </div>;
}
