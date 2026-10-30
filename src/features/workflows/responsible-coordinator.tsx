"use client";
import { useEffect, useState } from "react";
export function ResponsibleCoordinator({
  portfolio,
  branch,
}: {
  portfolio: string;
  branch: string;
}) {
  const [state, setState] = useState<{
    portfolio: string;
    name: string;
    linked: boolean;
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!portfolio) return;
    const controller = new AbortController();
    void fetch(
      "/api/workflows/coordinator?" +
        new URLSearchParams({ portfolio, branch }),
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        const d = await r.json();
        setState({
          portfolio,
          name: d.coordinator?.name || "",
          linked: !!d.coordinator?.employee_id,
          error: false,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ portfolio, name: "", linked: false, error: true });
      });
    return () => controller.abort();
  }, [portfolio, branch]);
  const current = state?.portfolio === portfolio ? state : null;
  return (
    <div
      role="status"
      className="rounded-md border border-input bg-slate-50 px-3 py-2 text-sm"
    >
      <strong>
        {!portfolio
          ? "Pilih portofolio terlebih dahulu"
          : !current
            ? "Memuat koordinator…"
            : current.error
              ? "Koordinator belum dapat dimuat"
              : current.name || "Koordinator portofolio belum ditetapkan."}
      </strong>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {current?.name
          ? "Terisi otomatis berdasarkan penetapan koordinator portofolio. " +
            (!current.linked
              ? "Identitas pegawai belum ditautkan; tidak memberikan hak akses akun."
              : "")
          : "Administrator dapat menetapkan koordinator pada Master Data → Penetapan Koordinator."}
      </p>
    </div>
  );
}
