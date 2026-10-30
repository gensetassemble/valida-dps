"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog } from "radix-ui";
import {
  Archive,
  Bell,
  LayoutDashboard,
  FileCheck2,
  Workflow,
  UserRoundCheck,
  Gauge,
  Users,
  Database,
  ShieldCheck,
  ChartNoAxesCombined,
  History,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import {
  ROLE_LABELS,
  ALL_ROLES,
  hasPermission,
  type Role,
  type Scope,
} from "@/lib/auth/permissions";
import { LogoutButton } from "@/components/shared/logout-button";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "./breadcrumbs";
import { cn } from "@/lib/utils";
type Item = {
  label: string;
  href?: string;
  icon: typeof Archive;
  roles: readonly Role[];
  future?: boolean;
};
const groups: { label: string; items: Item[] }[] = [
  {
    label: "Utama",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ALL_ROLES,
      },
      {
        label: "Notifikasi",
        href: "/notifikasi",
        icon: Bell,
        roles: ALL_ROLES,
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        label: "Sertifikat Klien",
        href: "/sertifikat-klien",
        icon: FileCheck2,
        roles: ["admin", "account_manager", "qshe", "branch_head"],
      },
      {
        label: "Pipeline Perpanjangan",
        href: "/pipeline-perpanjangan",
        icon: Workflow,
        roles: ["admin", "account_manager", "branch_head"],
      },
      {
        label: "Kompetensi Personil",
        href: "/kompetensi-personil",
        icon: UserRoundCheck,
        roles: [
          "admin",
          "hrga",
          "coordinator",
          "qshe",
          "inspector",
          "branch_head",
        ],
      },
      {
        label: "Kalibrasi Alat",
        href: "/kalibrasi-alat",
        icon: Gauge,
        roles: [
          "admin",
          "equipment_manager",
          "coordinator",
          "qshe",
          "branch_head",
        ],
      },
    ],
  },
  {
    label: "Data",
    items: [
      {
        label: "Pelanggan",
        href: "/pelanggan",
        icon: Users,
        roles: ["admin", "account_manager", "qshe", "branch_head"],
      },
      {
        label: "Master Data",
        href: "/master-data",
        icon: Database,
        roles: ALL_ROLES,
      },
      {
        label: "Impor Data",
        href: "/impor-data",
        icon: Database,
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Manajemen",
    items: [
      {
        label: "Monitoring QSHE",
        icon: ShieldCheck,
        roles: ["admin", "qshe", "branch_head"],
        future: true,
      },
      {
        label: "Laporan",
        icon: ChartNoAxesCombined,
        roles: ["admin", "branch_head"],
        future: true,
      },
      { label: "Audit Trail", href: "/audit", icon: History, roles: ["admin"] },
    ],
  },
  {
    label: "Sistem",
    items: [
      {
        label: "Pengaturan",
        href: "/pengaturan",
        icon: Settings,
        roles: ALL_ROLES,
      },
    ],
  },
];
export type ShellUser = {
  name: string;
  email: string;
  branch: string;
  scopes: Scope[];
  branches: { code: string; name: string }[];
};
export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const branch = user.branches.some(
    (item) => item.code === search.get("branch"),
  )
    ? search.get("branch")!
    : user.branches.some((item) => item.code === user.branch)
      ? user.branch
      : user.branches[0]?.code || user.branch;
  const roles = [
    ...new Set(
      user.scopes
        .filter((scope) => scope.branch_code === branch)
        .map((scope) => scope.role_code),
    ),
  ];
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "V";
  function nav(compact: boolean) {
    return (
      <div className="flex h-full flex-col">
        <div
          className={cn(
            "flex h-20 shrink-0 items-center gap-2 px-4",
            compact && "justify-center px-2",
          )}
        >
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className="flex min-w-0 items-center gap-2.5"
            aria-label="VALIDA — Dashboard"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy text-white">
              <Archive size={19} />
            </span>
            {!compact && (
              <div>
                <span className="text-lg font-bold tracking-tight text-brand-navy">
                  VALIDA<span className="text-primary">.</span>
                </span>
                <p className="text-[9px] font-medium text-muted-foreground">
                  Validity Alert &amp; Data Archive
                </p>
              </div>
            )}
          </Link>
        </div>
        <nav
          aria-label="Navigasi utama"
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        >
          {groups.map((group) => {
            const items = group.items.filter((item) =>
              hasPermission(user.scopes, branch, item.roles),
            );
            if (!items.length) return null;
            return (
              <div key={group.label} className="mb-5">
                <p
                  className={cn(
                    "mb-2 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground",
                    compact && "sr-only",
                  )}
                >
                  {group.label}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      !!item.href &&
                      (pathname === item.href ||
                        pathname.startsWith(item.href + "/"));
                    const cls = cn(
                      "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-xs font-semibold transition-colors",
                      compact && "justify-center px-0",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-slate-600 hover:bg-slate-100",
                      item.future && "hover:bg-transparent",
                    );
                    return item.future ? (
                      <span
                        key={item.label}
                        aria-disabled="true"
                        title={`${item.label} — Belum tersedia`}
                        className={cls}
                      >
                        <Icon size={18} className="shrink-0" aria-hidden />
                        {!compact && (
                          <>
                            <span className="flex-1">{item.label}</span>
                            <span className="text-[9px] font-medium">
                              Nanti
                            </span>
                          </>
                        )}
                      </span>
                    ) : (
                      <Link
                        key={item.label}
                        href={`${item.href}?branch=${branch}`}
                        title={item.label}
                        aria-label={compact ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cls}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Icon size={18} className="shrink-0" aria-hidden />
                        {!compact && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          {!compact && (
            <p className="mb-3 px-1 text-[10px] leading-5 text-muted-foreground">
              <strong className="block tracking-wider text-brand-navy">
                SUCOFINDO
              </strong>
              Cabang {branch} · Bali, NTB, NTT
            </p>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="hidden w-full md:flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Perluas sidebar" : "Ringkas sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <>
                <PanelLeftClose size={17} />
                <span>Ringkas navigasi</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#konten-utama"
        className="sr-only fixed left-4 top-4 z-[100] rounded bg-white p-3 focus:not-sr-only"
      >
        Lewati ke konten utama
      </a>
      <aside
        data-testid="desktop-sidebar"
        data-collapsed={collapsed}
        style={{ width: collapsed ? 68 : 240 }}
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-white transition-[width] duration-200 md:block"
      >
        {nav(collapsed)}
      </aside>
      <div
        className={cn(
          "min-w-0 transition-[margin] duration-200",
          collapsed ? "md:ml-[68px]" : "md:ml-[240px]",
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <Dialog.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label="Buka navigasi"
                >
                  <Menu />
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-brand-navy/50 md:hidden" />
                <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-white md:hidden">
                  <Dialog.Title className="sr-only">
                    Navigasi VALIDA
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Pilih halaman sesuai kewenangan akun Anda.
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute right-2 top-2 z-10"
                      aria-label="Tutup navigasi"
                    >
                      <X />
                    </Button>
                  </Dialog.Close>
                  {nav(false)}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <Breadcrumbs />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {user.branches.length > 1 ? (
              <select
                aria-label="Cabang aktif"
                className="h-8 max-w-24 rounded border border-input bg-white px-2 text-xs"
                value={branch}
                onChange={(event) =>
                  router.push(`${pathname}?branch=${event.target.value}`)
                }
              >
                {user.branches.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.code}
                  </option>
                ))}
              </select>
            ) : (
              <span className="hidden rounded border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground sm:block">
                {branch}
              </span>
            )}
            <Link
              href="/profil"
              className="flex items-center gap-2"
              aria-label="Profil saya"
            >
              <div className="hidden max-w-48 text-right sm:block">
                <p className="truncate text-xs font-bold">{user.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {roles.map((role) => ROLE_LABELS[role]).join(" · ") ||
                    user.email}
                </p>
              </div>
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-900">
                {initials}
              </span>
            </Link>
            <LogoutButton />
          </div>
        </header>
        <main
          id="konten-utama"
          className="mx-auto min-w-0 w-full max-w-[1600px] p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
        <footer className="mx-4 mt-6 flex items-center justify-between border-t border-border py-5 text-[10px] text-muted-foreground sm:mx-6">
          <span>VALIDA · PT SUCOFINDO Cabang Denpasar</span>
          <span className="flex items-center gap-1">
            VALIDA <ChevronRight size={11} /> DPS
          </span>
        </footer>
      </div>
    </div>
  );
}
