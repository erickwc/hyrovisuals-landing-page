import { usePrefs } from "../lib/prefs";
import "../styles/topbar.css";

/* Barra pequeña sobre la navegación: precio de oferta y mensajes que corren sin parar. */
export function TopBar() {
  const { c } = usePrefs();
  const t = c.topbar;
  const group = [0, 1, 2].flatMap((rep) => [
    <li key={`p${rep}`} className="tb__price">
      <s>{t.old}</s>
      <b>{t.now}</b>
    </li>,
    ...t.items.map((x) => <li key={`i${rep}-${x}`}>{x}</li>),
  ]);
  return (
    <div className="tb" role="region" aria-label={t.label}>
      <div className="tb__run">
        <ul>{group}</ul>
        <ul aria-hidden="true">{group}</ul>
      </div>
    </div>
  );
}
