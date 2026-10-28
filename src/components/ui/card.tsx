import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-lg border-2 border-border bg-card text-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
