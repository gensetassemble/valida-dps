import type { DataRow } from "./server";
export type TableData = {
  rows: DataRow[]; labels: Record<string, Record<string, string>>;
  total: number; page: number; size: number; sort: string; dir: string;
};
type Snapshot = { data: TableData; busy: boolean; sorting: boolean; error: string; sortError: string };
type PageLoader = (query: string, signal: AbortSignal) => Promise<TableData>;
export function recordQueryKey(query: string) {
  const params = new URLSearchParams(query); params.delete("page"); params.sort(); return params.toString();
}
async function fetchRecords(query: string, signal: AbortSignal): Promise<TableData> {
  const response = await fetch("/api/master-data/records?" + query, { cache: "no-store", signal });
  if (!response.ok) throw Error("Records unavailable");
  return response.json();
}
// One short-lived cache per mounted table; never shared across users or server refreshes.
export class RecordQueryStore {
  private snapshot: Snapshot;
  private key: string;
  private dataKey: string;
  private epoch = 0;
  private generation = 0;
  private listeners = new Set<() => void>();
  private cache = new Map<string, { data: TableData; at: number }>();
  private requests = new Map<string, { controller: AbortController; promise: Promise<TableData> }>();
  constructor(base: TableData, query: string, private loader: PageLoader = fetchRecords, private now = Date.now) {
    this.key = this.dataKey = recordQueryKey(query);
    this.snapshot = { data: base, busy: false, sorting: false, error: "", sortError: "" };
    this.remember(this.key, base);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener());
  }
  private remember(key: string, data: TableData) {
    this.cache.delete(key); this.cache.set(key, { data, at: this.now() });
    while (this.cache.size > 6) this.cache.delete(this.cache.keys().next().value!);
  }
  private cached(key: string) {
    const hit = this.cache.get(key);
    return hit && this.now() - hit.at < 15_000 ? hit.data : null;
  }
  private request(key: string, page: number) {
    const params = new URLSearchParams(key); params.set("page", String(page));
    const requestKey = params.toString(), pending = this.requests.get(requestKey);
    if (pending) return pending.promise;
    const controller = new AbortController(), generation = this.generation;
    const promise = this.loader(requestKey, controller.signal).then(data => {
      if (controller.signal.aborted || generation !== this.generation) throw Error("Cancelled");
      if (page === 1) this.remember(key, data);
      return data;
    }).finally(() => {
      if (this.requests.get(requestKey)?.controller === controller) this.requests.delete(requestKey);
    });
    this.requests.set(requestKey, { controller, promise });
    return promise;
  }
  async activate(query: string, force = false) {
    const key = recordQueryKey(query);
    if (!force && this.key === key && (this.dataKey === key || this.snapshot.sorting)) return;
    this.key = key;
    const epoch = ++this.epoch;
    const cached = force ? null : this.cached(key);
    if (cached) { this.dataKey = key; this.publish({ data: cached, busy: false, sorting: false, error: "", sortError: "" }); return; }
    this.publish({ busy: false, sorting: true, error: "", sortError: "" });
    try {
      const next = await this.request(key, 1);
      if (epoch !== this.epoch) return;
      this.dataKey = key;
      this.publish({ data: next, sorting: false });
    } catch {
      if (epoch === this.epoch) this.publish({ sorting: false, sortError: "Urutan belum diperbarui. Silakan coba lagi." });
    }
  }
  prefetch = async (query: string) => {
    const key = recordQueryKey(query);
    if (this.cached(key) || this.requests.size >= 4) return;
    try { await this.request(key, 1); } catch { /* Optional warm-up must not interrupt the table. */ }
  };
  retrySort = () => this.activate(this.key, true);
  load = async () => {
    if (this.snapshot.sorting || this.snapshot.busy || this.dataKey !== this.key || this.snapshot.data.rows.length >= this.snapshot.data.total) return;
    const key = this.key, epoch = this.epoch, data = this.snapshot.data;
    this.publish({ busy: true, error: "" });
    try {
      const next = await this.request(key, data.page + 1);
      if (epoch !== this.epoch) return;
      const labels = { ...data.labels };
      for (const [field, values] of Object.entries(next.labels)) labels[field] = { ...labels[field], ...values };
      const known = new Set(data.rows.map(row => String(row.id || row.code)));
      const merged = { ...next, rows: [...data.rows, ...next.rows.filter(row => !known.has(String(row.id || row.code)))], labels };
      this.remember(key, merged); this.publish({ data: merged, busy: false });
    } catch {
      if (epoch === this.epoch) this.publish({ busy: false, error: "Pemuatan terhenti. Baris sebelumnya tetap tersedia." });
    }
  };
  cancel = () => {
    ++this.epoch; ++this.generation;
    this.requests.forEach(request => request.controller.abort()); this.requests.clear();
    this.snapshot = { ...this.snapshot, busy: false, sorting: false };
  };
}
