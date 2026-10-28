import type { ReactNode } from "react";
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
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
