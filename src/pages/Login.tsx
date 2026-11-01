import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { ViewIcon, ViewOffIcon } from "../components/HugeIcons";
import { AuthLayout } from "./AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldErrors = { email?: string; password?: string };
type Status = "idle" | "submitting" | "success";

export function Login() {
  const { c } = usePrefs();
  const t = c.auth.login;
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};
    if (!trimmedEmail) nextErrors.email = t.errors.required;
    else if (!EMAIL_RE.test(trimmedEmail)) nextErrors.email = t.errors.invalidEmail;
    if (!password) nextErrors.password = t.errors.required;
    setFieldErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    if (!supabase) {
      setFormError(import.meta.env.DEV ? t.errors.notConfigured : t.errors.connection);
      return;
    }

    setStatus("submitting");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        setStatus("idle");
        setFormError(/invalid/i.test(error.message) ? t.errors.invalidCredentials : t.errors.generic);
        return;
      }
      setStatus("success");
      navigate("/cuenta", { replace: true });
    } catch {
      setStatus("idle");
      setFormError(t.errors.connection);
    }
  };

  return (
    <AuthLayout eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle}>
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <div className="field" data-invalid={Boolean(fieldErrors.email)}>
          <label htmlFor="login-email">{t.emailLabel}</label>
          <div className="field__control">
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              inputMode="email"
            />
          </div>
          {fieldErrors.email && <p className="field__error">{fieldErrors.email}</p>}
        </div>

        <div className="field" data-invalid={Boolean(fieldErrors.password)}>
          <label htmlFor="login-password">{t.passwordLabel}</label>
          <div className="field__control">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              autoComplete="current-password"
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
          {fieldErrors.password && <p className="field__error">{fieldErrors.password}</p>}
        </div>

        <div className="auth__row">
          <Link className="auth__forgot" to="/recuperar-contrasena">
            {t.forgot}
          </Link>
        </div>

        <Button type="submit" className="auth__submit" disabled={status === "submitting"}>
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

      <p className="auth__foot">
        {t.noAccount} <Link to="/register">{t.signupLink}</Link>
      </p>
    </AuthLayout>
  );
}
