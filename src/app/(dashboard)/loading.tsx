import { FilterLoading, ListLoading } from "@/components/ui/list-loading";
export default function Loading() {
  return <div className="space-y-3">
    <div className="mb-4 h-8 w-56 rounded-lg bg-slate-200/60 motion-safe:animate-pulse" aria-hidden="true" />
    <FilterLoading />
    <ListLoading />
  </div>;
}
