import { useState, type FormEvent } from "react";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { Logo } from "./Nav";
import { Reveal, SplitHeading } from "./ui";
import "../styles/footer.css";

export function Footer() {
  const { c } = usePrefs();
  const f = c.footer;
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setMsg({ ok: false, text: f.bad });
      return;
    }
    // TODO: envía el correo a tu backend o servicio de newsletter
    setMsg({ ok: true, text: f.ok });
    setEmail("");
  };

  return (
    <footer className="ft">
      <img className="ft__mascot" src={asset("media/brand/mascota.webp")} alt="" width="1254" height="1254" loading="lazy" decoding="async" />
      <div className="wrap">
        <a className="ft__cta" href="#licencias">
          <SplitHeading as="span" lines={f.cta} />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true">
            <path d="M5 19L19 5M8 5h11v11" />
          </svg>
        </a>
        <Reveal delay={0.1}>
          <p className="ft__sub">{f.ctaSub}</p>
        </Reveal>

        <div className="ft__mid">
          <div>
            <form className="ft__news" onSubmit={onSubmit} noValidate>
              <label htmlFor="ft-mail">{f.news}</label>
              <div>
                <input id="ft-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={f.placeholder} autoComplete="email" />
                <button type="submit" aria-label={f.subscribe}>
                  {f.subscribe}
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" aria-hidden="true">
                    <path d="M4 12h16M14 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
            </form>
            <p className="ft__msg" role="status" data-ok={msg?.ok}>
              {msg?.text}
            </p>
          </div>

          <nav className="ft__links" aria-label={f.explore}>
            {c.nav.links.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
            <a href="#licencias">{f.licenses}</a>
          </nav>
          <nav className="ft__links" aria-label={f.space}>
            <a href="/biblioteca/">{f.library}</a>
            <a href="/cuenta/">{f.account}</a>
            <a href="/cuenta/">{c.nav.login}</a>
          </nav>
          <nav className="ft__links" aria-label={f.follow}>
            <a href="#">Instagram</a>
            <a href="#">YouTube</a>
            <a href="#">TikTok</a>
          </nav>
        </div>

        <div className="ft__bot">
          <Logo size={30} />
          <p>{f.payNote}</p>
          <p>{f.copy}</p>
          <a href="#top" className="ft__top">
            {f.top}
          </a>
        </div>
      </div>
    </footer>
  );
}
