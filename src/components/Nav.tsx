import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { EASE } from "./ui";
import "../styles/nav.css";

export function Logo({ size }: { size?: number }) {
  const { c } = usePrefs();
  return (
    <a className="logo" href="#top" aria-label={c.nav.home} style={size ? { fontSize: size } : undefined}>
      HYRO
    </a>
  );
}

function LangButton() {
  const { lang, setLang, c } = usePrefs();
  return (
    <button type="button" className="ic" onClick={() => setLang(lang === "es" ? "en" : "es")} aria-label={c.nav.language}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </svg>
      <span>{lang.toUpperCase()}</span>
    </button>
  );
}

function ThemeButton() {
  const { theme, toggleTheme, c } = usePrefs();
  const dark = theme === "dark";
  return (
    <button type="button" className="ic round" onClick={toggleTheme} aria-label={dark ? c.nav.toLight : c.nav.toDark}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          style={{ display: "grid" }}
          initial={{ rotate: -50, opacity: 0, scale: 0.7 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 50, opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function Nav() {
  const { c } = usePrefs();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <a className="skip-link" href="#main">
        {c.nav.skip}
      </a>
      <header className="top">
        <nav className="wrap" aria-label="Principal">
          <Logo />
          <div className="links up">
            {c.nav.links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </div>
          <div className="tools">
            <LangButton />
            <ThemeButton />
            <a className="login up" href="/cuenta/">
              {c.nav.login}
            </a>
            <a className="btn sm signup" href="/cuenta/">
              {c.nav.signup}
            </a>
            <button
              type="button"
              className="ic round burger"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? c.nav.close : c.nav.menu}
              onClick={() => setOpen((o) => !o)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 8h16M4 16h16" />}
              </svg>
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="menu"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <nav className="menu__links wrap" aria-label={c.nav.menu}>
              {c.nav.links.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, ease: EASE, delay: 0.06 + i * 0.05 }}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>
            <div className="menu__foot wrap">
              <a href="/cuenta/" className="btn ghost lg" onClick={() => setOpen(false)}>
                {c.nav.login}
              </a>
              <a href="/cuenta/" className="btn lg" onClick={() => setOpen(false)}>
                {c.nav.signup}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
