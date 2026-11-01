"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      aria-label="Refresh data aplikasi"
      onClick={() => start(() => router.refresh())}
    >
      <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
      <span className="hidden sm:inline">
        {pending ? "Memuat…" : "Refresh"}
      </span>
    </Button>
  );
}
