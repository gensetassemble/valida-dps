import type { ReactNode } from "react";
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
  layout = "standard",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  layout?: "standard" | "table";
}) {
  if (layout === "table")
    return (
      <div
        role="row"
        className="grid min-w-0 gap-2 border-b border-border p-3 last:border-b-0 sm:grid-cols-[minmax(160px,0.35fr)_minmax(0,1fr)] sm:gap-5"
      >
        <div role="rowheader" className="text-xs font-semibold sm:pt-3">
          <label htmlFor={id}>
            {label}
            {required && (
              <span className="ml-1 text-red-700" aria-hidden>
                *
              </span>
            )}
          </label>
        </div>
        <div role="cell" className="min-w-0 space-y-1.5">
          {children}
          {hint && !error && (
            <p
              id={`${id}-hint`}
              className="text-[11px] leading-5 text-muted-foreground"
            >
              {hint}
            </p>
          )}
          {error && (
            <p id={`${id}-error`} role="alert" className="text-xs text-red-800">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
        <label htmlFor={id}>{label}</label>
        {required && (
          <span className="text-red-700" aria-hidden>
            *
          </span>
        )}
      </div>
      {children}
      {hint && !error && (
        <p
          id={`${id}-hint`}
          className="text-[11px] leading-5 text-muted-foreground"
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
