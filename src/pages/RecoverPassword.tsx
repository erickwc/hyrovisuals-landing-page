import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { Button } from "../components/Button";
import { ViewIcon, ViewOffIcon } from "../components/HugeIcons";
import { AuthLayout } from "./AuthLayout";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

type Status = "idle" | "submitting";
type Step = "request" | "verify" | "reset";

export function RecoverPassword() {
  const { c } = usePrefs();
  const t = c.auth.recover;
  const v = t.verify;
  const r = t.reset;
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<Status>("idle");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetErrors, setResetErrors] = useState<{ password?: string; confirm?: string }>({});
  const [resetFormError, setResetFormError] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<Status | "success">("idle");

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError(t.errors.required);
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError(t.errors.invalidEmail);
      return;
    }
    setEmailError(null);
    setFormError(null);

    if (!supabase) {
      setFormError(import.meta.env.DEV ? t.errors.notConfigured : t.errors.connection);
      return;
    }

    setStatus("submitting");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
      if (error) {
        setStatus("idle");
        setFormError(/rate limit|too many/i.test(error.message) ? t.errors.rateLimited : t.errors.generic);
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
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: trimmedCode, type: "recovery" });
      if (error) {
        setVerifyStatus("idle");
        setCodeError(/expired|invalid|token/i.test(error.message) ? v.errors.invalid : v.errors.generic);
        return;
      }
      setVerifyStatus("idle");
      setStep("reset");
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
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
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

  const onReset = async (e: FormEvent) => {
    e.preventDefault();
    if (resetStatus === "submitting") return;

    const nextErrors: { password?: string; confirm?: string } = {};
    if (!password) nextErrors.password = r.errors.required;
    else if (!PASSWORD_RE.test(password)) nextErrors.password = r.errors.weakPassword;
    if (!confirm) nextErrors.confirm = r.errors.required;
    else if (!nextErrors.password && confirm !== password) nextErrors.confirm = r.errors.mismatch;
    setResetErrors(nextErrors);
    setResetFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    if (!supabase) {
      setResetFormError(import.meta.env.DEV ? t.errors.notConfigured : r.errors.connection);
      return;
    }

    setResetStatus("submitting");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setResetStatus("idle");
        setResetFormError(/password/i.test(error.message) ? r.errors.weakPassword : r.errors.generic);
        return;
      }
      setResetStatus("success");
      navigate("/cuenta", { replace: true });
    } catch {
      setResetStatus("idle");
      setResetFormError(r.errors.connection);
    }
  };

  if (step === "reset") {
    return (
      <AuthLayout eyebrow={t.eyebrow} title={r.title} subtitle={r.subtitle}>
        <form className="auth__form" onSubmit={onReset} noValidate>
          <div className="field" data-invalid={Boolean(resetErrors.password)}>
            <label htmlFor="reset-password">{r.passwordLabel}</label>
            <div className="field__control">
              <input
                id="reset-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={r.passwordPlaceholder}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? r.hidePassword : r.showPassword}
                aria-pressed={showPassword}
              >
                {showPassword ? <ViewOffIcon width={18} height={18} /> : <ViewIcon width={18} height={18} />}
              </button>
            </div>
            {resetErrors.password ? <p className="field__error">{resetErrors.password}</p> : <p className="field__hint">{r.passwordHint}</p>}
          </div>

          <div className="field" data-invalid={Boolean(resetErrors.confirm)}>
            <label htmlFor="reset-confirm">{r.confirmLabel}</label>
            <div className="field__control">
              <input
                id="reset-confirm"
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={r.confirmPlaceholder}
                autoComplete="new-password"
              />
            </div>
            {resetErrors.confirm && <p className="field__error">{resetErrors.confirm}</p>}
          </div>

          <Button type="submit" className="auth__submit" disabled={resetStatus === "submitting"}>
            {resetStatus === "submitting" ? (
              <>
                <span className="auth__spinner" aria-hidden="true" /> {r.submitting}
              </>
            ) : (
              r.submit
            )}
          </Button>

          <p className="auth__msg" role="status" data-tone={resetFormError ? "error" : resetStatus === "success" ? "ok" : undefined}>
            {resetFormError ?? (resetStatus === "success" ? r.success : "")}
          </p>
        </form>
      </AuthLayout>
    );
  }

  if (step === "verify") {
    return (
      <AuthLayout eyebrow={t.eyebrow} title={v.title} subtitle={v.subtitle(email.trim())}>
        <form className="auth__form" onSubmit={onVerify} noValidate>
          <div className="field" data-invalid={Boolean(codeError)}>
            <label htmlFor="recover-code">{v.codeLabel}</label>
            <div className="field__control">
              <input
                id="recover-code"
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
          <button type="button" className="auth__forgot" onClick={() => setStep("request")}>
            {v.changeEmail}
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle}>
      <form className="auth__form" onSubmit={onRequest} noValidate>
        <div className="field" data-invalid={Boolean(emailError)}>
          <label htmlFor="recover-email">{t.emailLabel}</label>
          <div className="field__control">
            <input
              id="recover-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              autoComplete="email"
              inputMode="email"
            />
          </div>
          {emailError && <p className="field__error">{emailError}</p>}
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
        <Link to="/login">{c.auth.backToLogin}</Link>
      </p>
    </AuthLayout>
  );
}
