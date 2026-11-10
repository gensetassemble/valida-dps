"use client";
import { useRef, type ReactNode } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { Button } from "./button";
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "default",
  className = "",
  headerActions,
  footer,
  bodyClassName = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "default" | "large";
  className?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="valida-modal-overlay fixed inset-0 z-50" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            if (previousFocus.current?.isConnected) {
              event.preventDefault();
              previousFocus.current.focus();
            }
          }}
          className={
            "valida-modal fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-white " +
            (size === "large" ? "max-w-[1080px]" : "max-w-[640px]") + " " + className
          }
        >
          <div className="valida-modal-header flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <Dialog.Title className="break-words text-lg font-bold tracking-tight text-brand-navy">
                {title}
              </Dialog.Title>
              <Dialog.Description
                className={
                  description
                    ? "mt-1.5 max-w-3xl text-xs leading-5 text-muted-foreground"
                    : "sr-only"
                }
              >
                {description ||
                  "Periksa detail dan konfirmasikan pilihan Anda."}
              </Dialog.Description>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {headerActions}
              <Dialog.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Tutup dialog"
                >
                  <X />
                </Button>
              </Dialog.Close>
            </div>
          </div>
          <div className={"valida-modal-body min-h-0 overflow-y-auto overscroll-contain p-6 " + bodyClassName}>
            {children}
          </div>
          {footer && (
            <div className="valida-modal-footer flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-white px-6 py-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
  pending,
  error,
  confirmLabel = "Konfirmasi perubahan",
  destructive = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
      title={title}
      footer={
        <>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button variant={destructive ? "danger" : "default"} disabled={pending} onClick={onConfirm}>
            {pending ? "Memproses…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-6">{children}</div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </Modal>
  );
}
