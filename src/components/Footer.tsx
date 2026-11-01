import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { asset } from "../lib/asset";
import { Logo } from "./Nav";
import { ArrowRight02 } from "./animate-ui/icons/hugeicons/arrow-right-02";
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
          <ArrowRight02 aria-hidden="true" />
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
                  <ArrowRight02 size={18} aria-hidden="true" />
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
            <Link to="/cuenta/biblioteca">{f.library}</Link>
            <Link to="/cuenta">{f.account}</Link>
            <Link to="/login">{c.nav.login}</Link>
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
