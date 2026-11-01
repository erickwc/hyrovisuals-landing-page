import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Search01 } from "./animate-ui/icons/hugeicons/search-01";
import { Cancel01 } from "./animate-ui/icons/hugeicons/cancel-01";
import { EASE } from "./ui";
import "../styles/search.css";

type Hit = { key: string; href: string; label: string };

/* Buscador de la página: salta a una sección o a la pregunta frecuente que coincida. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { c } = usePrefs();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const term = q.trim().toLowerCase();

  const sections = useMemo<Hit[]>(
    () => c.nav.links.filter((l) => !term || l.label.toLowerCase().includes(term)).map((l) => ({ key: l.href, href: l.href, label: l.label })),
    [c, term],
  );
  const faq = useMemo<Hit[]>(
    () => c.faq.items.filter((it) => !term || `${it.q} ${it.a}`.toLowerCase().includes(term)).slice(0, 6).map((it, i) => ({ key: `q${i}`, href: "#preguntas", label: it.q })),
    [c, term],
  );

  useEffect(() => {
    if (!open) return;
    setQ("");
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const group = (title: string, hits: Hit[]) =>
    hits.length > 0 && (
      <div className="sd__group" role="group" aria-label={title}>
        <h3 className="up">{title}</h3>
        <ul>
          {hits.map((h) => (
            <li key={h.key}>
              <a href={h.href} onClick={onClose}>
                {h.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="sd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            className="sd__panel"
            role="dialog"
            aria-modal="true"
            aria-label={c.nav.search}
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <div className="sd__bar">
              <Search01 size={20} aria-hidden="true" />
              <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.nav.searchPlaceholder} aria-label={c.nav.searchPlaceholder} />
              <AnimateIcon animateOnHover asChild>
                <button type="button" className="nic" onClick={onClose} aria-label={c.nav.searchClose}>
                  <Cancel01 size={20} />
                </button>
              </AnimateIcon>
            </div>
            <div className="sd__body">
              {group(c.nav.searchSections, sections)}
              {group(c.nav.searchFaq, faq)}
              {sections.length + faq.length === 0 && <p className="sd__empty">{c.nav.searchEmpty}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
