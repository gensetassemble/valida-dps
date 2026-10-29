"use client";
import { useEffect, useRef } from "react";
import { Button } from "./button";

export function ScrollLoader({
  hasMore,
  busy,
  error,
  load,
}: {
  hasMore: boolean;
  busy: boolean;
  error?: string;
  load: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasMore || busy || error || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) load();
      },
      { rootMargin: "180px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasMore, busy, error, load]);
  return (
    <div
      ref={ref}
      className="py-3 text-center text-xs text-muted-foreground"
      aria-live="polite"
    >
      {busy ? (
        "Memuat baris berikutnya…"
      ) : error ? (
        <>
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            Coba lagi
          </Button>
        </>
      ) : hasMore ? (
        "Scroll untuk memuat berikutnya"
      ) : (
        "Seluruh rekaman sudah ditampilkan"
      )}
    </div>
  );
}
