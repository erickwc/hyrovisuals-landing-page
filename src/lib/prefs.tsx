import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { content, type Content, type Lang } from "../data/content";

type Theme = "dark" | "light";

type Prefs = {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  toggleTheme: () => void;
  c: Content;
};

const PrefsContext = createContext<Prefs | null>(null);

function read<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento bloqueado: la preferencia solo dura esta visita */
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => read("hyro.lang", ["es", "en"] as const) ?? (navigator.language?.toLowerCase().startsWith("es") ? "es" : "en"),
  );
  const [theme, setTheme] = useState<Theme>(() => read("hyro.theme", ["dark", "light"] as const) ?? "dark");

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = content[lang].meta.title;
  }, [lang]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#070707" : "#f6f4f1");
  }, [theme]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    write("hyro.lang", l);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      write("hyro.theme", next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ lang, setLang, theme, toggleTheme, c: content[lang] }), [lang, setLang, theme, toggleTheme]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs fuera de PrefsProvider");
  return ctx;
}
