"use client";
import {
  useEffect,
  useRef,
  useTransition,
  type FormEvent,
  type ReactNode,
  type ChangeEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
export function AutoFilterForm({
  children,
  className,
  keys,
  searchLabel,
  onApply,
}: {
  children: ReactNode;
  className?: string;
  keys?: string[];
  searchLabel?: string;
  onApply?: (values: Record<string, string>) => void;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    current = useSearchParams(),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const applyHandler = useRef(onApply);
  useEffect(() => { applyHandler.current = onApply; }, [onApply]);
  const [pending, startTransition] = useTransition();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const node of Array.from(form.elements))
      if (
        (node instanceof HTMLInputElement ||
          node instanceof HTMLSelectElement) &&
        node.name &&
        node.type !== "hidden"
      ) {
        if (node instanceof HTMLInputElement && document.activeElement === node)
          continue;
        node.value = current.get(node.name) || "";
      }
  }, [current]);
  function apply(form: HTMLFormElement, changed?: string) {
    const data = new FormData(form);
    if (applyHandler.current) {
      const values = Object.fromEntries((keys || [...data.keys()]).map(key => [key,String(data.get(key) || "").trim()]));
      if (changed === "filter") values.value = "";
      applyHandler.current(values);
      return;
    }
    const next = keys
        ? new URLSearchParams(current.toString())
        : new URLSearchParams();
    next.delete("page");
    for (const key of keys || [...data.keys()]) {
      const value = String(data.get(key) || "").trim();
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (changed === "filter") next.delete("value");
    const url = pathname + (next.size ? "?" + next : "");
    if (url === pathname + (current.size ? "?" + current : "")) return;
    startTransition(() => router.replace(url, { scroll: false }));
  }
  function change(e: ChangeEvent<HTMLFormElement>) {
    if (timer.current) clearTimeout(timer.current);
    const form = e.currentTarget,
      target = e.target as HTMLElement;
    const delayed =
      target instanceof HTMLInputElement &&
      !["checkbox", "radio", "hidden"].includes(target.type);
    const name =
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
        ? target.name
        : undefined;
    if (delayed) timer.current = setTimeout(() => apply(form, name), 250);
    else apply(form, name);
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (timer.current) clearTimeout(timer.current);
    apply(e.currentTarget);
  }
  return (
    <form
      ref={formRef}
      role={searchLabel ? "search" : undefined}
      aria-label={searchLabel}
      className={className}
      onChange={change}
      onSubmit={submit}
      aria-busy={pending}
    >
      {children}
      <span role="status" className={pending ? "text-[11px] text-muted-foreground" : "sr-only"}>
        {pending ? "Memfilter data…" : ""}
      </span>
    </form>
  );
}
