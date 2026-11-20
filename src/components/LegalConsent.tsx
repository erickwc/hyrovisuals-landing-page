import type { ReactNode } from "react";
import { usePrefs } from "../lib/prefs";
import { Check } from "./animate-ui/icons/hugeicons/check";
import "../styles/consent.css";

/* Casilla sin marcar con su texto; el enlace abre el documento en otra pestaña para no perder el formulario. */
export function ConsentCheck({
  checked,
  onChange,
  invalid,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="consent__row" data-invalid={invalid || undefined}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={invalid || undefined} />
      <span className="consent__box" aria-hidden="true">
        <Check size={12} />
      </span>
      <span className="consent__txt">{children}</span>
    </label>
  );
}

export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a className="consent__link" href={to} target="_blank" rel="noopener">
      {children}
    </a>
  );
}

/* Una sola casilla obligatoria que nombra los dos documentos (términos y aviso de privacidad), cada uno con su
   enlace. Al pagar se guardan las dos aceptaciones en legal_consents. */
export function LegalConsent({ checked, onChange, showErrors }: { checked: boolean; onChange: (v: boolean) => void; showErrors?: boolean }) {
  const { c } = usePrefs();
  const t = c.legal;
  return (
    <div className="consent">
      <ConsentCheck checked={checked} onChange={onChange} invalid={showErrors && !checked}>
        {t.acceptTerms} <DocLink to="/legal/terminos">{t.termsLink}</DocLink> {t.acceptAnd}{" "}
        <DocLink to="/legal/privacidad">{t.privacyLink}</DocLink>
      </ConsentCheck>
      {showErrors && !checked && (
        <p className="consent__error" role="alert">
          {t.required}
        </p>
      )}
    </div>
  );
}

/* Registro: sin casillas, una línea que avisa qué se acepta al crear la cuenta. */
export function SignupNotice() {
  const { c } = usePrefs();
  const t = c.legal;
  return (
    <p className="consent__notice">
      {t.signupA} <DocLink to="/legal/terminos">{t.termsLink}</DocLink> {t.acceptAnd}{" "}
      <DocLink to="/legal/privacidad">{t.privacyLink}</DocLink>.
    </p>
  );
}
