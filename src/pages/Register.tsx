import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { ViewIcon, ViewOffIcon } from "../components/HugeIcons";
import { AuthLayout } from "./AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

type FieldErrors = { email?: string; password?: string };
type Status = "idle" | "submitting";
type Step = "form" | "verify";

export function Register() {
  const { c } = usePrefs();
  const t = c.auth.register;
  const v = t.verify;
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<Status | "success">("idle");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmedEmail = email.trim();
    const nextErrors: FieldErrors = {};
    if (!trimmedEmail) nextErrors.email = t.errors.required;
    else if (!EMAIL_RE.test(trimmedEmail)) nextErrors.email = t.errors.invalidEmail;
    if (!password) nextErrors.password = t.errors.required;
    else if (!PASSWORD_RE.test(password)) nextErrors.password = t.errors.weakPassword;
    setFieldErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    if (!supabase) {
      setFormError(import.meta.env.DEV ? t.errors.notConfigured : t.errors.connection);
      return;
    }

    setStatus("submitting");
    try {
      const { error } = await supabase.auth.signUp({ email: trimmedEmail, password });
      // Un correo ya registrado y confirmado no da error (Supabase devuelve identities: [])
      // para no revelar si existe; solo tratamos como error los fallos reales (contraseña, límite, red).
      if (error && !/already registered/i.test(error.message)) {
        setStatus("idle");
        if (/password/i.test(error.message)) setFieldErrors({ password: t.errors.weakPassword });
        else if (/rate limit|too many/i.test(error.message)) setFormError(t.errors.rateLimited);
        else setFormError(t.errors.generic);
        return;
      }
      setStatus("idle");
      setStep("verify");
    } catch {
      setStatus("idle");
      setFormError(t.errors.connection);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (verifyStatus === "submitting") return;

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setCodeError(v.errors.required);
      return;
    }
    setCodeError(null);

    if (!supabase) {
      setCodeError(import.meta.env.DEV ? t.errors.notConfigured : v.errors.connection);
      return;
    }

    setVerifyStatus("submitting");
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: trimmedCode, type: "signup" });
      if (error) {
        setVerifyStatus("idle");
        setCodeError(/expired|invalid|token/i.test(error.message) ? v.errors.invalid : v.errors.generic);
        return;
      }
      setVerifyStatus("success");
      navigate("/cuenta", { replace: true });
    } catch {
      setVerifyStatus("idle");
      setCodeError(v.errors.connection);
    }
  };

  const onResend = async () => {
    if (!supabase || resendState === "sending") return;
    setResendState("sending");
    setResendMsg(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) {
        setResendState("idle");
        setResendMsg(v.errors.resendFailed);
        return;
      }
      setResendState("sent");
      setResendMsg(v.resent);
      setTimeout(() => setResendState("idle"), 30000);
    } catch {
      setResendState("idle");
      setResendMsg(v.errors.resendFailed);
    }
  };

  if (step === "verify") {
    return (
      <AuthLayout eyebrow={v.eyebrow} title={v.title} subtitle={v.subtitle(email.trim())}>
        <form className="auth__form" onSubmit={onVerify} noValidate>
          <div className="field" data-invalid={Boolean(codeError)}>
            <label htmlFor="verify-code">{v.codeLabel}</label>
            <div className="field__control">
              <input
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder={v.codePlaceholder}
              />
            </div>
            {codeError && <p className="field__error">{codeError}</p>}
          </div>

          <Button type="submit" className="auth__submit" disabled={verifyStatus === "submitting"}>
            {verifyStatus === "submitting" ? (
              <>
                <span className="auth__spinner" aria-hidden="true" /> {v.submitting}
              </>
            ) : (
              v.submit
            )}
          </Button>

          <p className="auth__msg" role="status" data-tone={verifyStatus === "success" ? "ok" : undefined}>
            {verifyStatus === "success" ? v.success : ""}
          </p>
        </form>

        <p className="auth__foot">
          <button type="button" className="auth__forgot" onClick={onResend} disabled={resendState === "sending"}>
            {resendState === "sending" ? v.resending : v.resend}
          </button>
        </p>
        {resendMsg && (
          <p className="auth__msg" role="status">
            {resendMsg}
          </p>
        )}
        <p className="auth__foot">
          <button type="button" className="auth__forgot" onClick={() => setStep("form")}>
            {v.changeEmail}
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow={c.auth.login.eyebrow} title={t.title} subtitle={t.subtitle}>
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <div className="field" data-invalid={Boolean(fieldErrors.email)}>
          <label htmlFor="register-email">{t.emailLabel}</label>
          <div className="field__control">
            <input
              id="register-email"
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
          <label htmlFor="register-password">{t.passwordLabel}</label>
          <div className="field__control">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="field__toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? t.hidePassword : t.showPassword}
              aria-pressed={showPassword}
            >
              {showPassword ? <ViewOffIcon width={18} height={18} /> : <ViewIcon width={18} height={18} />}
            </button>
          </div>
          {fieldErrors.password ? <p className="field__error">{fieldErrors.password}</p> : <p className="field__hint">{t.passwordHint}</p>}
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

        {formError && (
          <p className="auth__msg" role="status" data-tone="error">
            {formError}
          </p>
        )}
      </form>

      <p className="auth__foot">
        {t.haveAccount} <Link to="/login">{t.loginLink}</Link>
      </p>
    </AuthLayout>
  );
}
