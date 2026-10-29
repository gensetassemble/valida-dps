"use client";
import { useCallback, useRef, useState } from "react";
import type { DataRow } from "./server";
export type TableData = {
  rows: DataRow[];
  labels: Record<string, Record<string, string>>;
  total: number;
  page: number;
  size: number;
  sort: string;
  dir: string;
};

export function useScrollRecords(base: TableData, query: string) {
  const [state, setState] = useState({
    base,
    data: base,
    busy: false,
    error: "",
  });
  const lock = useRef<{ base: TableData; controller: AbortController } | null>(
    null,
  );
  if (state.base !== base)
    setState({ base, data: base, busy: false, error: "" });
  const current =
    state.base === base ? state : { base, data: base, busy: false, error: "" };
  const load = useCallback(async () => {
    if (
      lock.current?.base === base ||
      current.data.rows.length >= current.data.total
    )
      return;
    lock.current?.controller.abort();
    const controller = new AbortController();
    lock.current = { base, controller };
    setState((s) => ({ ...s, busy: true, error: "" }));
    try {
      const params = new URLSearchParams(query);
      params.set("page", String(current.data.page + 1));
      const response = await fetch("/api/master-data/records?" + params, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw Error("load");
      const next: TableData = await response.json();
      setState((s) => {
        if (s.base !== base) return s; // Discard a response from an earlier filter or refresh.
        const labels = { ...s.data.labels };
        for (const [field, values] of Object.entries(next.labels))
          labels[field] = { ...labels[field], ...values };
        const known = new Set(s.data.rows.map((r) => String(r.id || r.code)));
        return {
          ...s,
          busy: false,
          data: {
            ...next,
            rows: [
              ...s.data.rows,
              ...next.rows.filter((r) => !known.has(String(r.id || r.code))),
            ],
            labels,
          },
        };
      });
    } catch {
      setState((s) =>
        s.base === base
          ? {
              ...s,
              busy: false,
              error: "Pemuatan terhenti. Baris sebelumnya tetap tersedia.",
            }
          : s,
      );
    } finally {
      if (lock.current?.controller === controller) lock.current = null;
    }
  }, [
    base,
    current.data.page,
    current.data.rows.length,
    current.data.total,
    query,
  ]);
  return { data: current.data, busy: current.busy, error: current.error, load };
}
