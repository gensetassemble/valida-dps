"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Popover } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { personnelFilterOptions } from "./personnel-filter-options";
type Choice = { value: string; label: string };
type Group = { key: string; label: string; options: Choice[] };
export function FilterChoices({
  group,
  value,
  onChange,
  disabled = false,
}: {
  group: Group;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const selected = group.options.find((o) => o.value === value);
  return (
    <Popover.Root>
      <Popover.Trigger
        disabled={disabled}
        className={
          "inline-flex h-9 max-w-64 items-center gap-2 rounded-lg border px-3 text-xs font-medium " +
          (value
            ? "border-primary bg-emerald-50 text-emerald-900"
            : "border-input bg-white")
        }
        aria-label={group.label}
      >
        <span className="truncate">
          {group.label}
          {value ? ": " + (selected?.label || value) : ""}
        </span>
        <ChevronDown size={13} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          className="z-[80] w-72 rounded-xl border border-border bg-white p-3 shadow-xl"
          collisionPadding={12}
          aria-label={group.label}
        >
          {group.options.length > 8 && (
            <input
              autoFocus
              aria-label={"Cari " + group.label}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari pilihan…"
              className="mb-2 h-9 w-full rounded-md border border-input px-2 text-xs"
            />
          )}
          <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
            {[
              { value: "", label: "Semua" },
              ...group.options.filter((o) => o.value),
            ]
              .filter((o) =>
                o.label
                  .toLocaleLowerCase("id")
                  .includes(search.toLocaleLowerCase("id")),
              )
              .map((o) => (
                <Popover.Close key={o.value} asChild>
                  <button
                    type="button"
                    aria-pressed={value === o.value}
                    onClick={() => onChange(o.value)}
                    className={
                      "rounded-lg border px-3 py-2 text-xs " +
                      (value === o.value
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-input hover:bg-slate-50")
                    }
                  >
                    {o.label}
                  </button>
                </Popover.Close>
              ))}
          </div>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function CompactOperationalFilters({
  entity,
  branch,
  options,
}: {
  entity: string;
  branch: string;
  options: Group[];
}) {
  const params = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const [pending, start] = useTransition();
  const groups: Group[] =
    entity === "kompetensi-personil"
      ? personnelFilterOptions.map((g) => ({
          ...g,
          options: g.options.map(([value, label]) => ({ value, label })),
        }))
      : [
          {
            key: "validity",
            label: "Masa berlaku",
            options: [
              "Expired",
              "Kritis",
              "Perhatian",
              "Pantau",
              "Aman",
              "Tanggal Belum Diisi",
            ].map((value) => ({ value, label: value })),
          },
          {
            key: "eligibility",
            label: "Kelayakan",
            options: [
              "Layak Pakai",
              "Tidak Layak Pakai",
              "Hasil Belum Diisi",
              "Tanggal Belum Diisi",
              "Belum Ada Kalibrasi",
            ].map((value) => ({ value, label: value })),
          },
          {
            key: "active",
            label: "Rekaman",
            options: [
              { value: "true", label: "Aktif" },
              { value: "false", label: "Nonaktif" },
            ],
          },
        ];
  function change(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "kind") {
      next.delete("filter");
      next.delete("value");
    }
    start(() => router.replace(path + "?" + next, { scroll: false }));
  }
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-3 shadow-sm"
      aria-busy={pending}
    >
      <AutoFilterForm keys={["q"]} className="min-w-44 flex-1">
        <input
          aria-label="Cari rekaman"
          name="q"
          defaultValue={params.get("q") || ""}
          placeholder="Cari nama, nomor sertifikat, tag…"
          maxLength={100}
          className="h-9 w-full rounded-lg border border-input px-3 text-xs"
        />
      </AutoFilterForm>
      {[...groups, ...options].map((group) => (
        <FilterChoices
          key={group.key}
          group={group}
          value={
            params.get(group.key) ||
            (group.key === "kind" && params.get("filter") === "validity_kind"
              ? params.get("value") || ""
              : "")
          }
          onChange={(v) => change(group.key, v)}
          disabled={pending}
        />
      ))}
      <Popover.Root>
        <Popover.Trigger className="h-9 rounded-lg border border-input px-3 text-xs">
          Rentang tanggal{params.get("from") || params.get("until") ? " •" : ""}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            collisionPadding={12}
            className="z-[80] rounded-xl border border-border bg-white p-4 shadow-xl"
          >
            <AutoFilterForm
              keys={["from", "until"]}
              className="grid gap-3 text-xs"
            >
              <label>
                Akhir mulai
                <input
                  type="date"
                  name="from"
                  defaultValue={params.get("from") || ""}
                  className="mt-1 block rounded-md border border-input p-2"
                />
              </label>
              <label>
                Akhir sampai
                <input
                  type="date"
                  name="until"
                  defaultValue={params.get("until") || ""}
                  className="mt-1 block rounded-md border border-input p-2"
                />
              </label>
            </AutoFilterForm>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(() =>
            router.replace(path + "?branch=" + branch, { scroll: false }),
          )
        }
        className="h-9 px-2 text-xs underline"
      >
        Reset
      </button>
      <span role="status" className="sr-only">
        {pending ? "Memfilter data…" : ""}
      </span>
    </div>
  );
}
