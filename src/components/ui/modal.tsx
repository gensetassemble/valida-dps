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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "default" | "large";
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-navy/50" />
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
            "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-white p-5 shadow-xl " +
            (size === "large" ? "max-w-[1400px] sm:w-[92vw]" : "max-w-2xl")
          }
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-bold text-brand-navy">
                {title}
              </Dialog.Title>
              <Dialog.Description
                className={
                  description
                    ? "mt-2 text-xs leading-5 text-muted-foreground"
                    : "sr-only"
                }
              >
                {description ||
                  "Periksa detail dan konfirmasikan pilihan Anda."}
              </Dialog.Description>
            </div>
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
          {children}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!pending) onOpenChange(value);
      }}
      title={title}
    >
      <div className="text-sm leading-6">{children}</div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          Batal
        </Button>
        <Button disabled={pending} onClick={onConfirm}>
          {pending ? "Menyimpan…" : "Konfirmasi perubahan"}
        </Button>
      </div>
    </Modal>
  );
}
