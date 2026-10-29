"use client";
import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScrollLoader } from "./scroll-loader";
// Server-rendered review and summary tables grow cumulatively; filters remain in the URL.
export function ScrollMore({
  href,
  shown,
  total,
}: {
  href: string;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const [busy, transition] = useTransition();
  const load = useCallback(
    () => transition(() => router.replace(href, { scroll: false })),
    [href, router],
  );
  if (shown >= total) return null;
  return <ScrollLoader hasMore={shown < total} busy={busy} load={load} />;
}
