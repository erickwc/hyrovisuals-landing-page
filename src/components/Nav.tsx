import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Moon02 } from "./animate-ui/icons/hugeicons/moon-02";
import { Sun03 } from "./animate-ui/icons/hugeicons/sun-03";
import { EASE } from "./ui";
import "../styles/nav.css";

/* Barra de las páginas de React (login, registro, cuenta, checkout). La barra de la landing está en index.html. */

export function ThemeButton({ label }: { label?: boolean }) {
  const { theme, toggleTheme, c } = usePrefs();
  const dark = theme === "dark";
  const text = dark ? c.nav.toLight : c.nav.toDark;
  return (
    <AnimateIcon animateOnHover asChild>
      <button type="button" className="nic" onClick={toggleTheme} aria-label={text}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            className="nic__i"
            initial={{ rotate: -50, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 50, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            {dark ? <Moon02 size={19} /> : <Sun03 size={19} />}
          </motion.span>
        </AnimatePresence>
        {label && <span>{text}</span>}
      </button>
    </AnimateIcon>
  );
}
