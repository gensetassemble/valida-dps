"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { ArrowUpRight, ChevronDown } from "lucide-react";

type Destination = { label: string; href: string };

export function DashboardStatusCard({
  status,
  className,
  hoverColor,
  destinations,
  children,
}: {
  status: string;
  className: string;
  hoverColor: string;
  destinations: Destination[];
  children: ReactNode;
}) {
  const classes = `relative block w-full rounded-xl border bg-white px-3 py-3 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy motion-reduce:transform-none ${className}`;
  const style = { "--action-hover-bg": hoverColor } as CSSProperties;
  if (destinations.length === 1)
    return (
      <Link href={destinations[0].href} className={classes} style={style}
        aria-label={`Lihat ${destinations[0].label} berstatus ${status}`}>
        {children}
        <ArrowUpRight aria-hidden="true" className="absolute right-3 top-3 size-3.5" />
      </Link>
    );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className={classes} style={style}
          aria-label={`Pilih modul untuk status ${status}`}>
          {children}
          <ChevronDown aria-hidden="true" className="absolute right-3 top-3 size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} collisionPadding={12} align="start"
          aria-label={`Daftar ${status} per kategori`}
          className="z-[80] w-64 rounded-xl border border-border bg-white p-2 shadow-xl">
          <p className="px-2 py-2 text-xs font-bold text-brand-navy">{status} · Pilih kategori</p>
          {destinations.map((destination) => (
            <Popover.Close asChild key={destination.href}>
              <Link href={destination.href}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs text-brand-navy hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-primary">
                {destination.label}<ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
