import { useState, type FormEvent } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import type { SessionInfo } from "../lib/useSession";
import { Button } from "../components/Button";
import { ViewIcon, ViewOffIcon } from "../components/HugeIcons";

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

type FieldErrors = { password?: string; confirm?: string };
type Status = "idle" | "submitting" | "success";

export function AccountSettings() {
  const { c, lang } = usePrefs();
  const t = c.dashboard.account;
  const navigate = useNavigate();
  const { email, createdAt } = useOutletContext<SessionInfo>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const createdLabel = new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(createdAt));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;

    const nextErrors: FieldErrors = {};
    if (!password || !confirm) nextErrors.password = t.errors.required;
    else if (!PASSWORD_RE.test(password)) nextErrors.password = t.errors.weakPassword;
    else if (password !== confirm) nextErrors.confirm = t.errors.mismatch;
    setFieldErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");
    try {
      const { error } = await supabase!.auth.updateUser({ password });
      if (error) {
        setStatus("idle");
        setFormError(t.errors.generic);
        return;
      }
      setStatus("success");
      setPassword("");
      setConfirm("");
    } catch {
      setStatus("idle");
      setFormError(t.errors.connection);
    }
  };

  const onLogout = async () => {
    await supabase?.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="dash__section">
      <div className="dash__head">
        <p className="up dash__eyebrow">{t.eyebrow}</p>
        <h1 className="dash__title">{t.title}</h1>
      </div>

      <div className="account-info">
        <div>
          <span className="up dash__eyebrow">{t.emailLabel}</span>
          <p>{email}</p>
        </div>
        <div>
          <span className="up dash__eyebrow">{t.createdLabel}</span>
          <p>{createdLabel}</p>
        </div>
      </div>

      <section className="pd__section">
        <h2 className="pd__section-title">{t.passwordTitle}</h2>
        <form className="auth__form" onSubmit={onSubmit} noValidate>
          <div className="field" data-invalid={Boolean(fieldErrors.password)}>
            <label htmlFor="new-password">{t.passwordLabel}</label>
            <div className="field__control">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.hidePassword : t.showPassword}
                aria-pressed={showPassword}
              >
                {showPassword ? <ViewOffIcon width={18} height={18} /> : <ViewIcon width={18} height={18} />}
              </button>
            </div>
            {fieldErrors.password ? <p className="field__error">{fieldErrors.password}</p> : <p className="field__hint">{t.passwordHint}</p>}
          </div>

          <div className="field" data-invalid={Boolean(fieldErrors.confirm)}>
            <label htmlFor="confirm-password">{t.confirmLabel}</label>
            <div className="field__control">
              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t.confirmPlaceholder}
                autoComplete="new-password"
              />
            </div>
            {fieldErrors.confirm && <p className="field__error">{fieldErrors.confirm}</p>}
          </div>

          <Button type="submit" size="sm" disabled={status === "submitting"}>
            {status === "submitting" ? (
              <>
                <span className="auth__spinner" aria-hidden="true" /> {t.submitting}
              </>
            ) : (
              t.submit
            )}
          </Button>

          <p className="auth__msg" role="status" data-tone={formError ? "error" : status === "success" ? "ok" : undefined}>
            {formError ?? (status === "success" ? t.success : "")}
          </p>
        </form>
      </section>

      <Button variant="ghost" size="sm" onClick={onLogout}>
        {t.logout}
      </Button>
    </div>
  );
}
