import { useId, useState } from "react";
import { usePrefs } from "../lib/prefs";
import { Reveal, SplitHeading } from "./ui";
import "../styles/faq.css";

export function Faq() {
  const { c } = usePrefs();
  const f = c.faq;
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const uid = useId();
  const term = q.trim().toLowerCase();
  const rows = f.items.map((it, i) => ({ ...it, i })).filter((it) => !term || `${it.q} ${it.a}`.toLowerCase().includes(term));

  return (
    <section id="preguntas" aria-labelledby="faq-title">
      <div className="wrap faq-grid">
        <div className="faq-side">
        <SplitHeading lines={[f.title]} id="faq-title" />
        <Reveal delay={0.1}>
          <p className="sub">{f.sub}</p>
        </Reveal>
        <Reveal delay={0.15} className="search">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={f.placeholder} aria-label={f.placeholder} />
        </Reveal>
        </div>
        <div className="faq">
          {rows.map((it, k) => {
            const isOpen = open === it.i;
            return (
              <Reveal className="qa" key={it.i} delay={Math.min(k, 6) * 0.04} y={14}>
                <h3>
                  <button type="button" className="q" aria-expanded={isOpen} aria-controls={`${uid}-${it.i}`} onClick={() => setOpen(isOpen ? null : it.i)}>
                    <span>{it.q}</span>
                    <i aria-hidden="true" />
                  </button>
                </h3>
                <div className="a" id={`${uid}-${it.i}`} role="region" data-open={isOpen}>
                  <div>
                    <p>{it.a}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
          {rows.length === 0 && <p className="nores">{f.nores}</p>}
        </div>
      </div>
    </section>
  );
}
