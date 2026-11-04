import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "../styles/mini-modal.css";

// Mantiene montado el contenido lo que dura la animación de salida.
function usePresence(open: boolean): boolean {
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) {
      setShown(true);
      return;
    }
    const t = window.setTimeout(() => setShown(false), 140);
    return () => window.clearTimeout(t);
  }, [open]);
  return open || shown;
}

// Mini ventana anclada al botón que la abre. Sin `anchor` queda debajo de su contenedor (.mini-anchor);
// con `anchor` (por ejemplo, el lápiz de una fila) se coloca junto a ese elemento y lo sigue al desplazar.
// Escape o un clic fuera la cierran, salvo con `locked` (mientras sube un archivo).
// Los botones que la abren llevan `data-mini-trigger`: la alternan ellos mismos.
export function MiniModal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  anchor?: HTMLElement | null;
  locked?: boolean;
  wide?: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const present = usePresence(props.open);
  if (!present) return null;
  return <MiniModalBody {...props} closing={!props.open} />;
}

function MiniModalBody({
  title,
  onClose,
  children,
  footer,
  anchor,
  locked = false,
  wide = false,
  className,
  bodyClassName,
  closing,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  anchor?: HTMLElement | null;
  locked?: boolean;
  wide?: boolean;
  className?: string;
  bodyClassName?: string;
  closing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    // al primer campo; si no tiene (la lista de claves), a la ventana para que Escape funcione
    // un instante después: anclada, la ventana nace oculta hasta tener posición y no acepta foco antes
    const timer = window.setTimeout(() => {
      const field = ref.current?.querySelector<HTMLElement>("input:not(:disabled), textarea");
      (field ?? ref.current)?.focus();
    });
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (lockedRef.current || !ref.current || ref.current.contains(target) || target.closest("[data-mini-trigger]")) return;
      closeRef.current();
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  // Junto al elemento ancla: alineada a su borde derecho, debajo; si no cabe abajo, se abre hacia arriba.
  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const el = ref.current;
      const w = el?.offsetWidth ?? 340;
      const h = el?.offsetHeight ?? 240;
      const below = r.bottom + 6;
      const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : below;
      const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      setPos({ top, left });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    // Solo se cierra esta ventana, no el panel o la página de atrás; con una lista abierta, solo esa lista.
    e.stopPropagation();
    if (ref.current?.querySelector(".select-field__list") || lockedRef.current) return;
    onClose();
  };

  const cls = ["mini-modal", wide && "mini-modal--wide", className, anchor && "mini-modal--fixed", closing && "is-closing"].filter(Boolean).join(" ");
  return (
    <div className={cls} role="dialog" aria-label={title} ref={ref} tabIndex={-1} onKeyDown={onKey} style={anchor ? (pos ?? { visibility: "hidden" }) : undefined}>
      <p className="mini-modal__title">{title}</p>
      <div className={"mini-modal__body" + (bodyClassName ? ` ${bodyClassName}` : "")}>{children}</div>
      {footer && <div className="mini-modal__foot">{footer}</div>}
    </div>
  );
}
