export function ListLoading({ rows = 6 }: { rows?: number }) {
  return <section role="status" aria-label="Memuat daftar" className="overflow-hidden rounded-xl border border-border bg-white">
    <span className="sr-only">Memuat data terbaru…</span>
    <div className="flex h-16 items-center justify-between border-b border-border px-4">
      <div className="h-4 w-36 rounded bg-slate-100 motion-safe:animate-pulse" />
      <div className="h-8 w-28 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
    </div>
    <div className="h-11 border-b border-border bg-slate-50" />
    {Array.from({length:rows},(_,i) => <div key={i} className="flex h-16 items-center gap-6 border-b border-border/60 px-4 last:border-0" aria-hidden="true">
      <div className="h-3 w-8 rounded bg-slate-100" />
      <div className="h-3 w-1/3 rounded bg-slate-100 motion-safe:animate-pulse" />
      <div className="h-3 w-1/5 rounded bg-slate-100 motion-safe:animate-pulse" />
    </div>)}
  </section>;
}

export function FilterLoading() {
  return <div role="status" aria-label="Memuat filter" className="mb-2 flex h-16 items-center gap-3 rounded-xl border border-border bg-white p-3">
    <div className="h-9 w-1/3 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
    <div className="h-9 w-24 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
    <div className="h-9 w-24 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
  </div>;
}
