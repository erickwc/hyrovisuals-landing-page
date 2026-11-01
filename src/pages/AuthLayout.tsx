import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { ThemeButton } from "../components/Nav";
import { LanguagePicker } from "../components/Language";
import "../styles/nav.css";
import "../styles/auth.css";

export function AuthLayout({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
  const { c } = usePrefs();
  return (
    <>
      <header className="top">
        <div className="wrap authtop__bar">
          <Link className="logo" to="/" aria-label={c.nav.home}>
            HYRO
          </Link>
          <div className="authtop__icons">
            <ThemeButton />
            <LanguagePicker />
          </div>
        </div>
      </header>
      <main className="auth">
        <div className="auth__card">
          <p className="up auth__eyebrow">{eyebrow}</p>
          <h1 className="auth__title">{title}</h1>
          <p className="sub auth__sub">{subtitle}</p>
          {children}
        </div>
      </main>
    </>
  );
}
