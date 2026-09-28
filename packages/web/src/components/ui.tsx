import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useMessages } from "../i18n/index.tsx";

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button type="button" className={`btn btn-${variant} ${className}`} {...props} />;
}

/** A full-page screen with a back button and a title. */
export function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const t = useMessages();
  return (
    <div className="page">
      <header className="page-header">
        <Button variant="ghost" onClick={onBack} aria-label={t.common.back}>
          ← {t.common.back}
        </Button>
        <h1>{title}</h1>
      </header>
      <main className="page-body">{children}</main>
    </div>
  );
}

/** Modal dialog built on the native <dialog> element (focus trapping and Esc for free). */
export function Dialog({ open, title, onClose, children }: { open: boolean; title?: string; onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.();
      }}
    >
      {open && (
        <div className="dialog-body">
          {title && <h2>{title}</h2>}
          {children}
        </div>
      )}
    </dialog>
  );
}
