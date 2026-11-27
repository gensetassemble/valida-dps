"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { RecordQueryStore, type TableData } from "./record-query-store";
export type { TableData } from "./record-query-store";

export function useScrollRecords(base: TableData, query: string) {
  const [source, setSource] = useState(() => ({ base, store: new RecordQueryStore(base, query) }));
  let store = source.store;
  if (source.base !== base) {
    store = new RecordQueryStore(base, query);
    setSource({ base, store });
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.activate(query); }, [store, query]);
  useEffect(() => () => store.cancel(), [store]);
  return { ...state, load: store.load, prefetch: store.prefetch, retrySort: store.retrySort };
}
