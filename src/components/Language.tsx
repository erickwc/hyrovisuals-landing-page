import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import type { Lang } from "../data/content";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Translate } from "./animate-ui/icons/translate";
import { Check } from "./animate-ui/icons/hugeicons/check";
import { EASE } from "./ui";
import "../styles/language.css";

const options: { id: Lang; name: string; native: string }[] = [
  { id: "es", name: "Español", native: "ES" },
  { id: "en", name: "English", native: "EN" },
];

/* Botón de idioma con un mini menú pegado al icono: dos opciones, la activa lleva el check. */
export function LanguagePicker({ label, placement = "down" }: { label?: boolean; placement?: "down" | "up" }) {
  const { lang, setLang, c } = usePrefs();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (id: Lang) => {
    setLang(id);
    setOpen(false);
  };

  return (
    <div className="lp" ref={root} data-placement={placement}>
      <AnimateIcon animateOnHover asChild>
        <button type="button" className="nic" onClick={() => setOpen((o) => !o)} aria-label={c.nav.language} aria-haspopup="menu" aria-expanded={open}>
          <Translate size={19} />
          <span>{label ? c.nav.language : lang.toUpperCase()}</span>
          {label && <em>{lang.toUpperCase()}</em>}
        </button>
      </AnimateIcon>
      <AnimatePresence>
        {open && (
          <motion.div
            className="lp__pop"
            role="menu"
            aria-label={c.nav.language}
            initial={{ opacity: 0, y: placement === "down" ? -6 : 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === "down" ? -6 : 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {options.map((o) => (
              <button key={o.id} type="button" role="menuitemradio" aria-checked={lang === o.id} className="lp__opt" onClick={() => pick(o.id)}>
                <b>{o.name}</b>
                <em>{o.native}</em>
                <span className="lp__check" aria-hidden="true">
                  {lang === o.id && (
                    <AnimateIcon animate>
                      <Check size={16} />
                    </AnimateIcon>
                  )}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
