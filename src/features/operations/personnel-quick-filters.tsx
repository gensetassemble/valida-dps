"use client";
import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  personnelFilterOptions,
  personnelFilterQuery,
} from "./personnel-filter-options";

export function PersonnelQuickFilters() {
  const params = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <div
      className="space-y-3 border-t border-border px-4 py-3"
      aria-busy={pending}
    >
      {personnelFilterOptions.map((group) => {
        const selected =
          params.get(group.key) ||
          (group.key === "kind" && params.get("filter") === "validity_kind"
            ? params.get("value")
            : "") ||
          "";
        return (
          <fieldset key={group.key} disabled={pending} className="min-w-0">
            <legend className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
              {group.label}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={selected === value}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 " +
                    (selected === value
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-input bg-white text-brand-navy hover:bg-slate-50")
                  }
                  onClick={() =>
                    startTransition(() =>
                      router.replace(
                        `${path}?${personnelFilterQuery(params.toString(), group.key, value)}`,
                        { scroll: false },
                      ),
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}
      <p role="status" className="text-[11px] text-muted-foreground">
        {pending
          ? "Memuat hasil…"
          : "Klik pilihan untuk langsung memfilter tabel."}
      </p>
    </div>
  );
}
