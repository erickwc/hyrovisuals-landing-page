import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { ThemeButton } from "../components/Nav";
import { LanguagePicker } from "../components/Language";
import { Button } from "../components/Button";
import { COMPANY, LEGAL_DOCS, LEGAL_VERSION, type LegalBlock, type LegalDocId } from "../data/legal";
import "../styles/nav.css";
import "../styles/auth.css";
import "../styles/legal.css";

const ORDER: LegalDocId[] = ["terminos", "privacidad", "cookies", "reembolsos"];

// id de cada sección para el índice (#reembolsos…): el que trae el documento o uno sacado del título
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* Barra de las páginas legales: la misma marca de la web, los enlaces a las secciones de la landing (en escritorio),
   y el modo e idioma. Los enlaces son normales (no de React Router): la landing es otra página. */
function LegalTop() {
  const { c } = usePrefs();
  return (
    <header className="top">
      <div className="wrap authtop__bar lg-top">
        <a className="logo" href="/" aria-label={c.nav.home}>
          HYRO
        </a>
        <nav className="lg-top__links" aria-label={c.legal.siteNav}>
          {c.legal.siteLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="authtop__icons">
          <ThemeButton />
          <LanguagePicker />
        </div>
      </div>
    </header>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (Array.isArray(block))
    return (
      <ul>
        {block.map((li) => (
          <li key={li}>{li}</li>
        ))}
      </ul>
    );
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <p>
      <b>{block.lead}</b> {block.text}
    </p>
  );
}

/* /legal/terminos, /legal/privacidad, /legal/cookies y /legal/reembolsos: los documentos de src/data/legal.ts */
export function Legal() {
  const { doc } = useParams();
  const { c, lang } = usePrefs();
  const t = c.legal;
  const current = ORDER.includes(doc as LegalDocId) ? LEGAL_DOCS[doc as LegalDocId] : null;

  const { hash } = useLocation();
  useEffect(() => {
    if (current) document.title = current.title;
    // con #sección (p. ej. #proveedor desde el footer) se baja a esa parte; si no, arriba
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [current, hash]);

  if (!current) return <Navigate to="/legal/terminos" replace />;
  const updated = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "UTC" }).format(new Date(LEGAL_VERSION));
  const [first, ...rest] = current.title.split(" ");
  const sections = current.sections.map((s) => ({ ...s, anchor: s.id ?? slug(s.title) }));

  return (
    <>
      <LegalTop />
      <div className="lg">
        {/* título en dos líneas y, debajo, el resumen, la versión y las pestañas de documentos */}
        <section className="lg__hero">
          <h1 className="lg__title">
            <span>{first}</span>
            {rest.length > 0 && <span>{rest.join(" ")}</span>}
          </h1>
          <div className="lg__intro">
            <p className="lg__summary">{current.summary}</p>
            <p className="lg__meta">
              {t.updated} {updated} · {t.version} {LEGAL_VERSION}
            </p>
            {lang === "en" && <p className="lg__note">{t.spanishOnly}</p>}
          </div>
          <nav className="lg__docs" aria-label={t.navLabel}>
            {ORDER.map((id) => (
              <NavLink key={id} to={`/legal/${id}`} className="lg__doc-pill">
                {t.docs[id]}
              </NavLink>
            ))}
          </nav>
        </section>

        <div className="lg__body">
          {/* índice fijo a la izquierda (en escritorio) */}
          <aside className="lg__index" aria-label={t.contents}>
            <p>{t.contents}</p>
            <ol>
              {/* como el menú de la landing: el número y el nombre */}
              {sections.map((s, i) => (
                <li key={s.anchor}>
                  <a href={`#${s.anchor}`} className={hash === `#${s.anchor}` ? "is-active" : undefined}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <main className="lg__doc">
            {sections.map((s) => (
              <section key={s.anchor} id={s.anchor} className="lg__sec">
                <h2>{s.title}</h2>
                {s.body.map((b, i) => (
                  <Block key={i} block={b} />
                ))}
              </section>
            ))}
            <p className="lg__contact">
              {t.contact} <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> ·{" "}
              <Link to="/legal/terminos#proveedor">{t.company}</Link>
            </p>
          </main>
        </div>
      </div>
    </>
  );
}

/* /baja?t=<token>: el enlace de baja de cada correo de la newsletter. Funciona sin iniciar sesión. */
export function Unsubscribe() {
  const { c } = usePrefs();
  const t = c.legal.unsubscribe;
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "missing" | "error">(valid ? "idle" : "missing");

  const onConfirm = async () => {
    if (!supabase || status === "working") return;
    setStatus("working");
    const { data, error } = await supabase.rpc("newsletter_unsubscribe", { p_token: token });
    if (error) setStatus("error");
    else setStatus(data ? "done" : "missing");
  };

  return (
    <>
      <LegalTop />
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">{status === "done" ? t.doneTitle : t.title}</h1>
          <p className="sub auth__sub">
            {status === "done" ? t.doneBody : status === "missing" ? t.missing : status === "error" ? t.error : t.body}
          </p>
          {(status === "idle" || status === "working" || status === "error") && (
            <Button className="auth__submit" onClick={onConfirm} loading={status === "working"}>
              {t.confirm}
            </Button>
          )}
          <p className="auth__foot">
            <Link to="/legal/privacidad">{c.legal.docs.privacidad}</Link>
          </p>
        </div>
      </main>
    </>
  );
}
