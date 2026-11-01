import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { previewIds, type PreviewId } from "../data/content";
import { EASE, Reveal, SplitHeading, VideoSlot } from "./ui";
import "../styles/preview.css";

const dots = (n: number) => Array.from({ length: n }, (_, i) => <i key={i} style={{ "--k": i } as React.CSSProperties} />);

/* Mini animación dibujada para cada tarjeta (sin texto, sin capturas). */
function Mini({ id }: { id: PreviewId }) {
  switch (id) {
    case "fuente":
      return (
        <div className="mi mi--fuente">
          {[0, 1, 2].map((k) => (
            <p key={k} style={{ "--k": k } as React.CSSProperties}>
              <b />
              <s />
            </p>
          ))}
        </div>
      );
    case "espectros":
      return (
        <div className="mi mi--esp">
          {Array.from({ length: 6 }, (_, k) => (
            <p key={k} style={{ "--k": k } as React.CSSProperties}>
              <i />
              <s />
            </p>
          ))}
        </div>
      );
    case "tematicas":
      return <div className="mi mi--tema">{dots(5)}</div>;
    case "paletas":
      return (
        <div className="mi mi--pal">
          <div>{dots(5)}</div>
          <span />
        </div>
      );
    case "modos":
      return (
        <div className="mi mi--modo">
          <s />
          <s />
          <b />
        </div>
      );
    case "sensibilidad":
      return (
        <div className="mi mi--sens">
          <div>{dots(9)}</div>
          <span>
            <b />
          </span>
        </div>
      );
    case "franja":
      return (
        <div className="mi mi--franja">
          <div className="st" />
          <div className="ap">
            <s />
            <s />
            <s />
          </div>
        </div>
      );
    case "presets":
      return (
        <div className="mi mi--pre">
          {[0, 1, 2].map((k) => (
            <p key={k} style={{ "--k": k } as React.CSSProperties}>
              <s />
              <b />
            </p>
          ))}
        </div>
      );
  }
}

export function Preview() {
  const { c } = usePrefs();
  const [open, setOpen] = useState<PreviewId>("fuente");
  const rail = useRef<HTMLDivElement>(null);
  const live = useInView(rail, { margin: "120px" });
  const drag = useRef({ down: false, moved: false, x: 0, left: 0 });
  const items = c.preview.items;

  const choose = (id: PreviewId) => {
    if (drag.current.moved) return;
    setOpen(id);
  };

  const go = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.8, behavior: "smooth" });

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !rail.current) return;
    drag.current = { down: true, moved: false, x: e.clientX, left: rail.current.scrollLeft };
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.down || !rail.current) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 6) d.moved = true;
    if (d.moved) rail.current.scrollLeft = d.left - dx;
  };
  const up = () => {
    drag.current.down = false;
    window.setTimeout(() => (drag.current.moved = false), 0);
  };

  return (
    <section id="preview" aria-labelledby="preview-title">
      <div className="wrap">
        <div className="pv-head">
          <div>
            <SplitHeading lines={[c.preview.title]} id="preview-title" />
            <Reveal delay={0.1}>
              <p className="sub">{c.preview.sub}</p>
            </Reveal>
          </div>
          <div className="pv-arrows">
            <button type="button" className="ic round" onClick={() => go(-1)} aria-label={c.preview.prev}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" className="ic round" onClick={() => go(1)} aria-label={c.preview.next}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className="pv-stage" id="pv-stage" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={open} className="pv-stage__in" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
              <div className="pv-big">
                <VideoSlot src={asset(`media/videos/preview/${open}.mp4`)} alt={items[open].title} pendingLabel={c.preview.pending} className="pv-big__video" />
              </div>
              <div className="pv-info">
                <h3>{items[open].title}</h3>
                <p>{items[open].text}</p>
                <ul className="pv-tags">
                  {items[open].tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <Reveal delay={0.1}>
          <div className="pv-rail" ref={rail} data-live={live} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
            {previewIds.map((id) => {
              const selected = open === id;
              return (
                <div className="pv-cell" key={id}>
                  <button type="button" className="pv-card" data-selected={selected} onClick={() => choose(id)} aria-pressed={selected} aria-controls="pv-stage">
                    <span className="pv-thumb">
                      <Mini id={id} />
                    </span>
                    <span className="pv-title">{items[id].title}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
