"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Modal } from "./modal";
import { ExternalLink } from "lucide-react";
const ModalRouteContext = createContext(false);
export function useModalRoute() {
  return useContext(ModalRouteContext);
}
export function RouteModal({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  return (
    <ModalRouteContext.Provider value={true}>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) router.back();
        }}
        title={title}
        size="large"
        bodyClassName="valida-route-body"
        headerActions={<a className="valida-direct-link inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold text-primary-hover hover:bg-muted" href={pathname + (params.size ? "?" + params : "")} target="_blank" rel="noreferrer" aria-label="Buka tautan langsung di tab baru"><span className="hidden sm:inline">Buka halaman</span><ExternalLink size={14}/></a>}
      >
        {children}
      </Modal>
    </ModalRouteContext.Provider>
  );
}
