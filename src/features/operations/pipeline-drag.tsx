"use client";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type DragEvent,
} from "react";
import { GripVertical } from "lucide-react";
import { allowedRenewalTargets } from "@/lib/domain/renewal";

type Move = (target: string) => void;
const Context = createContext<{
  register: (id: string, move: Move) => () => void;
  request: (id: string, target: string) => void;
} | null>(null);
export function PipelineDragProvider({ children }: { children: ReactNode }) {
  const handlers = useRef(new Map<string, Move>());
  const register = useCallback((id: string, move: Move) => {
    handlers.current.set(id, move);
    return () => {
      handlers.current.delete(id);
    };
  }, []);
  const request = useCallback(
    (id: string, target: string) => handlers.current.get(id)?.(target),
    [],
  );
  return (
    <Context.Provider value={{ register, request }}>
      {children}
    </Context.Provider>
  );
}
export function usePipelineDrag() {
  return useContext(Context);
}
export function PipelineDropColumn({
  stage,
  label,
  children,
}: {
  stage: string;
  label: string;
  children: ReactNode;
}) {
  const context = usePipelineDrag();
  const [over, setOver] = useState(false),
    [message, setMessage] = useState("");
  function drop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    try {
      const card = JSON.parse(
        e.dataTransfer.getData("application/x-valida-renewal"),
      );
      if (!allowedRenewalTargets(card.stage).includes(stage)) {
        setMessage(
          "Tahap ini tidak dapat dilewati. Ikuti urutan gate pada kartu.",
        );
        return;
      }
      setMessage("");
      context?.request(card.id, stage);
    } catch {
      setMessage("Gunakan pegangan pada kartu untuk memindahkan.");
    }
  }
  return (
    <section
      aria-label={label}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-valida-renewal")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={drop}
      className={
        "min-w-0 rounded-lg " +
        (over ? "outline-2 outline-offset-2 outline-primary" : "")
      }
    >
      {message && (
        <p
          role="status"
          className="mb-2 rounded bg-amber-50 p-2 text-xs text-amber-900"
        >
          {message}
        </p>
      )}
      {children}
    </section>
  );
}
export function PipelineDragHandle({
  id,
  stage,
  customer,
  canWrite,
}: {
  id: string;
  stage: string;
  customer: string;
  canWrite: boolean;
}) {
  if (!canWrite || !allowedRenewalTargets(stage).length) return null;
  return (
    <button
      type="button"
      draggable
      aria-label={"Angkat kartu " + customer}
      title="Seret ke tahap tujuan. Gunakan Status untuk memindahkan dengan keyboard atau ponsel."
      className="mb-1 flex w-full cursor-grab justify-end text-muted-foreground active:cursor-grabbing"
      onDragStart={(e) => {
        e.dataTransfer.setData(
          "application/x-valida-renewal",
          JSON.stringify({ id, stage }),
        );
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <GripVertical size={16} />
    </button>
  );
}
