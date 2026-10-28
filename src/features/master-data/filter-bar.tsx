"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EntityConfig } from "./registry";
export function FilterBar({ entity }: { entity: EntityConfig }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  function remove(keys: string[]) {
    const next = new URLSearchParams(params.toString());
    keys.forEach((key) => next.delete(key));
    next.delete("page");
    router.push(`${pathname}?${next}`);
  }
  const active = params.get("active");
  const filter = entity.fields.find(
    (field) => field.key === params.get("filter"),
  );
  const value = params.get("value");
  return (
    <div className="border-b border-border">
      <form
        key={params.toString()}
        className="flex flex-wrap items-end gap-3 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams(params.toString());
          next.delete("page");
          for (const key of ["q", "active", "filter", "value"]) {
            const value = String(data.get(key) || "").trim();
            if (value) next.set(key, value);
            else next.delete(key);
          }
          router.push(`${pathname}?${next}`);
        }}
      >
        <div className="min-w-44 flex-1">
          <label htmlFor={`search-${entity.key}`} className="sr-only">
            Cari {entity.title.toLowerCase()}
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-3 text-muted-foreground"
              size={15}
              aria-hidden
            />
            <Input
              className="pl-9"
              id={`search-${entity.key}`}
              name="q"
              defaultValue={params.get("q") || ""}
              placeholder={`Cari ${entity.title.toLowerCase()}…`}
              maxLength={100}
            />
          </div>
        </div>
        {entity.fields.some((field) => field.key === "is_active") && (
          <label className="space-y-1 text-[11px] text-muted-foreground">
            <span className="block">Status</span>
            <select
              name="active"
              defaultValue={active || ""}
              className="h-10 rounded-lg border border-input bg-white px-3 text-xs"
            >
              <option value="">Semua status</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </label>
        )}
        {entity.fields.some((field) => field.kind === "select") && (
          <>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              <span className="block">Kolom filter</span>
              <select
                name="filter"
                defaultValue={params.get("filter") || ""}
                className="h-10 max-w-40 rounded-lg border border-input bg-white px-2 text-xs"
              >
                <option value="">Pilih kolom</option>
                {entity.fields
                  .filter((field) => field.kind === "select")
                  .map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              <span className="block">Nilai filter</span>
              <select
                name="value"
                defaultValue={value || ""}
                className="h-10 max-w-44 rounded-lg border border-input bg-white px-2 text-xs"
              >
                <option value="">Semua nilai</option>
                {entity.fields
                  .filter((field) => field.kind === "select")
                  .flatMap((field) => field.options || [])
                  .filter(
                    (option, index, array) =>
                      array.findIndex(
                        (value) => value.value === option.value,
                      ) === index,
                  )
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        <Button type="submit" variant="outline">
          Terapkan
        </Button>
      </form>
      {(params.get("q") || active || filter) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-muted px-4 py-2 text-[11px]">
          {params.get("q") && (
            <button
              className="flex items-center gap-1 rounded-full border border-input bg-white px-2 py-1"
              onClick={() => remove(["q"])}
            >
              Pencarian: {params.get("q")}
              <X size={11} />
            </button>
          )}
          {active && (
            <button
              className="flex items-center gap-1 rounded-full border border-input bg-white px-2 py-1"
              onClick={() => remove(["active"])}
            >
              Status: {active === "true" ? "Aktif" : "Nonaktif"}
              <X size={11} />
            </button>
          )}
          {filter && (
            <button
              className="flex items-center gap-1 rounded-full border border-input bg-white px-2 py-1"
              onClick={() => remove(["filter", "value"])}
            >
              {filter.label}:{" "}
              {filter.options?.find((option) => option.value === value)
                ?.label || value}
              <X size={11} />
            </button>
          )}
          <button
            className="ml-auto font-semibold text-primary-hover underline"
            onClick={() => remove(["q", "active", "filter", "value"])}
          >
            Hapus semua filter
          </button>
        </div>
      )}
    </div>
  );
}
