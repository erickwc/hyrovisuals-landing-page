import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type ElementType } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { createStrip, type PanelKind, type StripParams } from "../lib/visualizer";

export const EASE = [0.2, 0.8, 0.2, 1] as const;
const INK = "#f4f2ef";

/* Entrada al hacer scroll: sube y aparece una sola vez. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  as = "div",
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  as?: "div" | "li" | "p" | "span" | "article" | "figure";
  className?: string;
}) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/* Titular por líneas: cada línea sube desde una máscara. */
export function SplitHeading({
  lines,
  as = "h2",
  className,
  delay = 0,
  immediate = false,
  style,
  id,
}: {
  lines: string[];
  as?: ElementType;
  className?: string;
  delay?: number;
  immediate?: boolean;
  style?: CSSProperties;
  id?: string;
}) {
  const Tag = as;
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const show = immediate || seen;
  return (
    <Tag className={className} style={style} id={id} ref={ref}>
      <span className="sr-only">{lines.join(" ")}</span>
      {lines.map((line, i) => (
        <span className="line-mask" aria-hidden="true" key={i}>
          <motion.span
            className="line"
            initial={{ y: "110%" }}
            animate={{ y: show ? "0%" : "110%" }}
            transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/* Franja de visuales en vivo (audio simulado). Siempre sobre fondo oscuro. */
export function HyroStrip({
  panels,
  params,
  className,
  label,
  minPanelWidth,
  gap,
  labels,
  paused = false,
  ink = INK,
}: {
  panels: PanelKind[];
  params: Omit<StripParams, "ink">;
  className?: string;
  label: string;
  minPanelWidth?: number;
  gap?: number;
  labels?: boolean;
  paused?: boolean;
  ink?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const strip = useRef<ReturnType<typeof createStrip> | null>(null);
  const visible = useRef(false);
  const pausedRef = useRef(paused);
  const sync = useRef<() => void>();
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current!;
    const s = createStrip(canvas, { ...params, ink }, { panels, minPanelWidth, gap, labels });
    strip.current = s;
    if (reduce) return () => s.destroy();
    const update = () => (visible.current && !pausedRef.current && !document.hidden ? s.start() : s.stop());
    sync.current = update;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
      update();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      s.destroy();
    };
    // el canvas se crea una vez; los cambios de parámetros entran por set()
  }, [reduce, panels.join(","), minPanelWidth, gap, labels]);

  useEffect(() => {
    strip.current?.set({ ...params, ink });
  }, [params.primary, params.secondary, params.sensitivityDb, params.motion, params.smoothing, ink]);

  useEffect(() => {
    pausedRef.current = paused;
    sync.current?.();
  }, [paused]);

  // absoluto: el tamaño del lienzo nunca influye en el de su contenedor (evita un bucle de crecimiento)
  return <canvas ref={ref} className={className} role="img" aria-label={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

/* Hueco para video: si el archivo existe se reproduce en bucle; si no, muestra la imagen de respaldo. */
export function VideoSlot({
  src,
  poster,
  alt,
  pendingLabel,
  className,
  posterStyle,
}: {
  src: string;
  poster?: string;
  alt: string;
  pendingLabel: string;
  className?: string;
  posterStyle?: CSSProperties;
}) {
  const [ok, setOk] = useState(false);
  return (
    <div className={`video-slot ${className ?? ""}`} data-ready={ok}>
      {poster && <img className="video-slot__poster" src={poster} alt="" style={posterStyle} loading="lazy" decoding="async" />}
      <video
        className="video-slot__video"
        src={src}
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        aria-label={alt}
        onLoadedData={() => setOk(true)}
        onError={() => setOk(false)}
      />
      {!ok && (
        <div className="video-slot__empty" role="img" aria-label={`${alt}. ${pendingLabel}`}>
          <span className="video-slot__play">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
          <b>{pendingLabel}</b>
          <code>{src}</code>
        </div>
      )}
    </div>
  );
}

/* Hueco para foto con respaldo cuando aún no existe el archivo. */
export function PhotoSlot({
  src,
  alt,
  fallback,
  pendingLabel,
  className,
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`photo-slot ${className ?? ""}`}>
      {!failed ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className="photo-slot__fallback">{fallback}</div>
      )}
      {failed && import.meta.env.DEV && (
        <span className="pending-tag">
          {pendingLabel} · <code>{src}</code>
        </span>
      )}
    </div>
  );
}

/* Contador que avanza solo mientras `active` es verdadero (para animaciones decorativas en bucle). */
export function useLoop(ms: number, active: boolean) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!active || reduce) return;
    const t = setInterval(() => setI((v) => v + 1), ms);
    return () => clearInterval(t);
  }, [ms, active, reduce]);
  return i;
}

export function Arrow() {
  return (
    <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
