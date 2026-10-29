"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Modal } from "./modal";
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
      >
        <div className="mb-4 flex justify-end">
          <a
            className="text-xs underline"
            href={pathname + (params.size ? "?" + params : "")}
            target="_blank"
            rel="noreferrer"
          >
            Buka tautan langsung ↗
          </a>
        </div>
        {children}
      </Modal>
    </ModalRouteContext.Provider>
  );
}
