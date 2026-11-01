import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { Search01 } from "./animate-ui/icons/hugeicons/search-01";
import { Moon02 } from "./animate-ui/icons/hugeicons/moon-02";
import { Sun03 } from "./animate-ui/icons/hugeicons/sun-03";
import { Menu01 } from "./animate-ui/icons/hugeicons/menu-01";
import { Cancel01 } from "./animate-ui/icons/hugeicons/cancel-01";
import { EASE } from "./ui";
import { Button } from "./Button";
import { SearchDialog } from "./Search";
import { LanguagePicker } from "./Language";
import "../styles/nav.css";

export function Logo({ size }: { size?: number }) {
  const { c } = usePrefs();
  return (
    <a className="logo" href="#top" aria-label={c.nav.home} style={size ? { fontSize: size } : undefined}>
      HYRO
    </a>
  );
}

function SearchButton({ label, onOpen }: { label?: boolean; onOpen: () => void }) {
  const { c } = usePrefs();
  return (
    <AnimateIcon animateOnHover asChild>
      <button type="button" className="nic" onClick={onOpen} aria-label={c.nav.search} aria-haspopup="dialog">
        <Search01 size={19} />
        {label && <span>{c.nav.search}</span>}
      </button>
    </AnimateIcon>
  );
}

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

export function Nav() {
  const { c } = usePrefs();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const closeSearch = useCallback(() => setSearching(false), []);

  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open || searching);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, searching]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <div className="tools__icons">
            <SearchButton onOpen={() => setSearching(true)} />
            <ThemeButton />
            <LanguagePicker />
          </div>
          <div className="acct">
            <Link className="login up" to="/login">
              {c.nav.login}
            </Link>
            <Button size="sm" className="signup" href="/register">
              {c.nav.signup}
            </Button>
          </div>
          <AnimateIcon animateOnHover asChild>
            <button type="button" className="nic burger" aria-expanded={open} aria-controls="mobile-menu" aria-label={c.nav.menu} onClick={() => setOpen(true)}>
              <Menu01 size={24} />
            </button>
          </AnimateIcon>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="menu"
            role="dialog"
            aria-modal="true"
            aria-label={c.nav.menu}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <div className="menu__bar wrap">
              <Logo />
              <AnimateIcon animateOnHover asChild>
                <button type="button" className="nic" aria-label={c.nav.close} onClick={() => setOpen(false)}>
                  <Cancel01 size={24} />
                </button>
              </AnimateIcon>
            </div>

            <nav className="menu__links wrap" aria-label={c.nav.menu}>
              {c.nav.links.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.45, ease: EASE, delay: 0.05 + i * 0.05 }}
                >
                  {l.label}
                </motion.a>
              ))}
            </nav>

            <div className="menu__prefs wrap">
              <SearchButton
                label
                onOpen={() => {
                  setOpen(false);
                  setSearching(true);
                }}
              />
              <ThemeButton label />
              <LanguagePicker label placement="up" />
            </div>

            <div className="menu__foot wrap">
              <Button href="/login" variant="ghost" size="lg" onClick={() => setOpen(false)}>
                {c.nav.login}
              </Button>
              <Button href="/register" size="lg" onClick={() => setOpen(false)}>
                {c.nav.signup}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchDialog open={searching} onClose={closeSearch} />
    </>
  );
}
