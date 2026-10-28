"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
type Notice = { id: number; message: string; tone: "success" | "error" };
const Context = createContext<
  ((message: string, tone?: "success" | "error") => void) | null
>(null);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const next = useRef(0);
  const notify = useCallback(
    (message: string, tone: "success" | "error" = "success") => {
      const id = next.current++;
      setNotices((current) => [...current, { id, message, tone }]);
      setTimeout(
        () => setNotices((current) => current.filter((item) => item.id !== id)),
        6000,
      );
    },
    [],
  );
  return (
    <Context.Provider value={notify}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[100] max-w-[calc(100vw-2.5rem)] space-y-2"
        aria-live="polite"
      >
        {notices.map((item) => (
          <div
            key={item.id}
            role={item.tone === "error" ? "alert" : "status"}
            className={`flex w-80 max-w-full items-start gap-3 rounded-lg border bg-white p-4 text-xs font-semibold shadow-lg ${item.tone === "error" ? "border-red-200 text-red-800" : "border-emerald-200 text-emerald-800"}`}
          >
            <p className="flex-1">{item.message}</p>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() =>
                setNotices((current) =>
                  current.filter((notice) => notice.id !== item.id),
                )
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
export function useToast() {
  const notify = useContext(Context);
  if (!notify) throw new Error("ToastProvider diperlukan.");
  return notify;
}
