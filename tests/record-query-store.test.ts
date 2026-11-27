import { describe, expect, it, vi } from "vitest";
import { RecordQueryStore, recordQueryKey, type TableData } from "@/features/master-data/record-query-store";

const page = (ids: string[], options: Partial<TableData> = {}): TableData => ({ rows: ids.map(id => ({ id })), labels: {}, total: 80, page: 1, size: 40, sort: "name", dir: "asc", ...options });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const asc = "branch=DPS&entity=kalibrasi-alat&sort=name&dir=asc";
const desc = asc.replace("asc", "desc");

describe("table-only ordering", () => {
  it("requests the complete server order instead of reversing a partial page; keeps existing rows during loading", async () => {
    const request = deferred<TableData>(), loader = vi.fn<(query: string, signal: AbortSignal) => Promise<TableData>>(() => request.promise);
    const store = new RecordQueryStore(page(["A"]), asc, loader);
    const change = store.activate(desc);
    expect(store.getSnapshot().sorting).toBe(true);
    expect(store.getSnapshot().data.rows).toEqual([{ id: "A" }]);
    expect(new URLSearchParams(loader.mock.calls[0][0]).get("page")).toBe("1");
    request.resolve(page(["Z"], { dir: "desc" })); await change;
    expect(store.getSnapshot().data.rows).toEqual([{ id: "Z" }]);
    expect(store.getSnapshot().sorting).toBe(false);
  });
  it("discards a slow older sort response after the user chooses another order", async () => {
    const first = deferred<TableData>(), second = deferred<TableData>();
    const loader = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = new RecordQueryStore(page(["A"]), asc, loader);
    const a = store.activate(desc), b = store.activate(asc + "&q=other");
    second.resolve(page(["Chosen"])); await b;
    first.resolve(page(["Stale"])); await a;
    expect(store.getSnapshot().data.rows).toEqual([{ id: "Chosen" }]);
  });
  it("does not append a stale page from the previous order", async () => {
    const pending = deferred<TableData>();
    const loader = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page(["Z"], { dir: "desc" }));
    const store = new RecordQueryStore(page(["A"]), asc, loader);
    const append = store.load(); await store.activate(desc);
    pending.resolve(page(["B"], { page: 2 })); await append;
    expect(store.getSnapshot().data.rows).toEqual([{ id: "Z" }]);
    expect(store.getSnapshot().busy).toBe(false);
  });
  it("reuses preloaded results and deduplicates simultaneous requests", async () => {
    const pending = deferred<TableData>(), loader = vi.fn(() => pending.promise);
    const store = new RecordQueryStore(page(["A"]), asc, loader);
    const warm = store.prefetch(desc), change = store.activate(desc);
    expect(loader).toHaveBeenCalledTimes(1);
    pending.resolve(page(["Z"], { dir: "desc" })); await Promise.all([warm, change]);
    await store.activate(asc); await store.activate(desc);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().data.rows).toEqual([{ id: "Z" }]);
  });
  it("keeps cache scoped to branch, filters and table instance, and expires after 15 seconds", async () => {
    let time = 0;
    const loader = vi.fn(async () => page(["Server"]));
    const store = new RecordQueryStore(page(["A"]), asc, loader, () => time);
    await store.activate(desc); await store.activate(asc);
    time = 15_001; await store.activate(desc);
    await store.activate(desc.replace("DPS", "OTHER"));
    await store.activate(desc + "&q=restricted");
    const otherUser = new RecordQueryStore(page(["Other user"]), asc, loader);
    await otherUser.activate(desc);
    expect(loader).toHaveBeenCalledTimes(5);
    expect(recordQueryKey(asc + "&page=2")).toBe(recordQueryKey(asc));
  });
  it("keeps old data after failure, blocks mixed pagination and supports retry", async () => {
    const loader = vi.fn().mockRejectedValueOnce(Error("Offline")).mockResolvedValueOnce(page(["Z"]));
    const store = new RecordQueryStore(page(["A"]), asc, loader);
    await store.activate(desc); await store.load();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().sortError).toBeTruthy();
    expect(store.getSnapshot().data.rows).toEqual([{ id: "A" }]);
    await store.retrySort();
    expect(store.getSnapshot().sortError).toBe("");
    expect(store.getSnapshot().data.rows).toEqual([{ id: "Z" }]);
  });
  it("merges pagination labels and excludes overlapping IDs", async () => {
    const loader = vi.fn(async () => page(["A", "B"], { page: 2, labels: { employee: { B: "Bob" } } }));
    const store = new RecordQueryStore(page(["A"], { labels: { employee: { A: "Ana" } } }), asc, loader);
    await store.load();
    expect(store.getSnapshot().data.rows).toEqual([{ id: "A" }, { id: "B" }]);
    expect(store.getSnapshot().data.labels.employee).toEqual({ A: "Ana", B: "Bob" });
  });
  it("aborts requests when leaving the table and cannot reuse late data", async () => {
    const request = deferred<TableData>(); let signal!: AbortSignal;
    const loader = vi.fn((_query: string, s: AbortSignal) => { signal = s; return request.promise; });
    const store = new RecordQueryStore(page(["A"]), asc, loader);
    const change = store.activate(desc); store.cancel();
    expect(signal.aborted).toBe(true);
    request.resolve(page(["Late"])); await change;
    expect(store.getSnapshot().data.rows).toEqual([{ id: "A" }]);
  });
});
