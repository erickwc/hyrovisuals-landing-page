// Piezas que comparten Resumen, Ventas y Finanzas para que las tablas y filtros se vean y lean igual.
import { SelectField } from "./SelectField";
import { formatDate, presetPeriods, type Period } from "./periods";
import { ArrowLeft01 } from "../../components/animate-ui/icons/hugeicons/arrow-left-01";
import { ArrowRight01 } from "../../components/animate-ui/icons/hugeicons/arrow-right-01";
import { Search01 } from "../../components/animate-ui/icons/hugeicons/search-01";
import { Cancel01 } from "../../components/animate-ui/icons/hugeicons/cancel-01";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { useEffect, useId, useRef, type ReactNode } from "react";

export const STATUS_LABEL: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  failed: "Fallido",
  refunded: "Reembolsado",
  completed: "Completado",
};

export type Trend = { value: string; tone: "up" | "down" | "flat"; rest: string };

// Comparación contra el periodo anterior en texto plano: "+12% vs. periodo anterior".
export function trend(current: number, previous: number): Trend {
  if (previous === 0) {
    return current > 0
      ? { value: "", tone: "flat", rest: "Sin datos del periodo anterior" }
      : { value: "", tone: "flat", rest: "Sin movimiento en el periodo" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    value: `${pct > 0 ? "+" : ""}${pct}%`,
    tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
    rest: "vs. periodo anterior",
  };
}

export function share(part: number, total: number, empty: string): Trend {
  if (total === 0) return { value: "", tone: "flat", rest: empty };
  return {
    value: `${((part / total) * 100).toFixed(1)}%`,
    tone: "flat",
    rest: "de las ventas brutas",
  };
}

export function TrendLine({ t }: { t: Trend }) {
  return (
    <p className="kpi__foot">
      {t.value && (
        <span className="kpi__delta" data-tone={t.tone}>
          {t.value}
        </span>
      )}
      {t.rest}
    </p>
  );
}

// Fechas sin hora ("2026-10-16") se leen a mediodía local; si no, el navegador las toma en UTC y muestra el día anterior.
export function formatDay(iso: string): string {
  return formatDate(iso.length === 10 ? iso + "T12:00:00" : iso);
}

// Nombres de los socios en métricas, cortes y confirmaciones (en la base siguen como socio A y B).
export const PARTNERS = { a: "Erick Caceres", b: "Jonathan Soriano" } as const;

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00"));
}

// "1 nov – 30 nov 2026": el rango real que cubre el periodo (endExclusive es el día siguiente al último).
export function periodRange(period: Period): string {
  if (!period.start) return "Todas las fechas";
  const last = new Date(period.endExclusive + "T12:00:00");
  last.setDate(last.getDate() - 1);
  const lastIso = last.toISOString().slice(0, 10);
  const year = new Intl.DateTimeFormat("es-SV", { year: "numeric" }).format(last);
  if (lastIso === period.start) return `${shortDate(period.start)} ${year}`;
  return `${shortDate(period.start)} – ${shortDate(lastIso)} ${year}`;
}

// Fila de filtro de periodo que va dentro del tablero, arriba de las métricas que filtra.
export function PeriodFilter({
  period,
  onChange,
  hint,
  periods = presetPeriods(),
}: {
  period: Period;
  onChange: (p: Period) => void;
  hint?: string;
  periods?: Period[];
}) {
  return (
    <div className="board__filters">
      <SelectField
        value={period.label}
        onChange={(label) => onChange(periods.find((p) => p.label === label) ?? period)}
        options={periods.map((p) => ({ value: p.label, label: p.label }))}
      />
      <span className="board__range">{periodRange(period)}</span>
      {hint && <span className="board__hint">{hint}</span>}
    </div>
  );
}

// Nombre del plan con mayúscula inicial, sin icono.
export function PlanCell({ planId }: { planId: string }) {
  return <span>{capitalize(planId)}</span>;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="pager">
      <span>
        {first}–{last} de {total}
      </span>
      <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ArrowLeft01 size={14} />
      </button>
      <button type="button" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        <ArrowRight01 size={14} />
      </button>
    </div>
  );
}

// Buscador de las tablas; con `columns` muestra a la izquierda el selector de columna.
export function TableSearch<C extends string>({
  value,
  onChange,
  placeholder = "Buscar en la tabla",
  columns,
  column,
  onColumn,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  columns?: { value: C; label: string }[];
  column?: C;
  onColumn?: (c: C) => void;
}) {
  return (
    <div className="search-group">
      {columns && column && onColumn && <SelectField className="search-group__column" value={column} onChange={(v) => onColumn(v as C)} options={columns} />}
      <label className="search-group__input">
        <Search01 size={14} />
        <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

// Formulario en ventana modal: se abre encima de la página sin empujar el contenido.
// Con `side` se abre como panel lateral a la derecha, para procesos más largos (producto con sus planes).
// Cierra con Escape, con la X o al hacer clic fuera; mientras está abierto la página no se desplaza.
export function FormModal({
  title,
  onClose,
  children,
  actions,
  error,
  side = false,
  flush = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
  error?: string | null;
  side?: boolean;
  // Secciones de borde a borde (cada una con su relleno), como los paneles de Supabase.
  flush?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, textarea, button.select-field__trigger")?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Con una lista desplegable abierta, Escape solo cierra la lista.
      if (e.key === "Escape" && !dialogRef.current?.querySelector(".select-field__list")) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus();
    };
  }, []);

  return (
    <div
      className={"modal-backdrop" + (side ? " modal-backdrop--side" : "")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={"modal" + (side ? " modal--side" : "")} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
        <div className="modal__head">
          <p className="board__title" id={titleId}>
            {title}
          </p>
          <AnimateIcon animateOnHover asChild>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Cerrar">
              <Cancel01 size={15} />
            </button>
          </AnimateIcon>
        </div>
        <div className={"form-body" + (flush ? " form-body--flush" : "")}>
          {children}
        </div>
        {/* El error va pegado a los botones: en un panel largo se ve sin tener que bajar */}
        {error && <p className="form-error">{error}</p>}
        <div className="form-foot">{actions}</div>
      </div>
    </div>
  );
}
