import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { EASE } from "./ui";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Cancel01 } from "./animate-ui/icons/hugeicons/cancel-01";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Mientras una acción está en curso no se puede cerrar (Esc, clic afuera ni la X). */
  locked?: boolean;
  /** "alert" para confirmaciones que piden una decisión (cerrar sesión). */
  role?: "dialog" | "alertdialog";
  className?: string;
};

/* Ventana modal del panel de cliente: se monta en <body>, se cierra con Esc o clic afuera
   y devuelve el foco al botón que la abrió. */
export function Modal({ open, onClose, title, description, children, locked, role = "dialog", className }: ModalProps) {
  const { c } = usePrefs();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // en refs para que el efecto no se repita (y robe el foco) cada vez que el padre se vuelve a pintar
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  closeRef.current = onClose;
  lockedRef.current = locked;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? dialogRef.current;
      first?.focus();
    });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !lockedRef.current && closeRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="dlg-backdrop"
          onPointerDown={(e) => e.target === e.currentTarget && !locked && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            ref={dialogRef}
            className={"dlg" + (className ? ` ${className}` : "")}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="dlg__head">
              <h2 id={titleId} className="dlg__title">
                {title}
              </h2>
              <AnimateIcon animateOnHover asChild>
                <button type="button" className="dlg__close" onClick={onClose} disabled={locked} aria-label={c.dashboard.nav.close}>
                  <Cancel01 size={16} />
                </button>
              </AnimateIcon>
            </div>
            {description && (
              <p id={descId} className="dlg__desc">
                {description}
              </p>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
