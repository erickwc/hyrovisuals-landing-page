import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { producers } from "../data/content";
import { EASE, PhotoSlot, SplitHeading } from "./ui";
import "../styles/producers.css";

const SLOT_MS = 4200;

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/* Tarjeta grande: texto y lista de productores a la izquierda, su foto a la derecha. Cambia sola. */
export function Producers() {
  const { c } = usePrefs();
  const p = c.producers;
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "-10% 0px -10% 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView || reduce) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % producers.length), SLOT_MS);
    return () => clearTimeout(t);
  }, [active, inView, reduce]);

  const cur = producers[active];

  return (
    <section id="productores" aria-labelledby="producers-title">
      <div className="wrap">
        <div className="pv" ref={box}>
          <div className="pv__info">
            <div>
              <SplitHeading lines={[p.title]} id="producers-title" />
              <p className="sub">{p.sub}</p>
            </div>

            <ol className="pv__list">
              {producers.map((pr, i) => (
                <li key={pr.slug}>
                  <button type="button" aria-current={active === i} onClick={() => setActive(i)}>
                    <span className="pv__n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="pv__name">{pr.name}</span>
                    {active === i && !reduce && <i className="pv__bar" style={{ animationDuration: `${SLOT_MS}ms`, animationPlayState: inView ? "running" : "paused" }} />}
                  </button>
                </li>
              ))}
            </ol>

            <div className="pv__quote" aria-live="polite">
              <AnimatePresence mode="wait" initial={false}>
                <motion.blockquote key={cur.slug} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                  {p.quotes[active]}
                </motion.blockquote>
              </AnimatePresence>
            </div>
          </div>

          <div className="pv__photo">
            <AnimatePresence initial={false}>
              <motion.div key={cur.slug} className="pv__img" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                <PhotoSlot
                  src={asset(`media/productores/${cur.photo ?? `${cur.slug}.jpg`}`)}
                  alt={cur.name}
                  pendingLabel={p.photo}
                  fallback={<span className="pv__ini">{initials(cur.name)}</span>}
                />
              </motion.div>
            </AnimatePresence>
            <span className="pv__tag">
              {cur.name}
              <small>{p.role}</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
