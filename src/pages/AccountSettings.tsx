import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import type { AccountContext } from "../lib/useSession";
import { Button } from "../components/Button";
import { UserRound } from "../components/animate-ui/icons/hugeicons/user-round";
import { Upload01 } from "../components/animate-ui/icons/hugeicons/upload-01";
import { Delete02 } from "../components/animate-ui/icons/hugeicons/delete-02";

const AVATAR_TYPES = ["image/jpeg", "image/png"];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type Status = "idle" | "submitting" | "success";

/* Datos de la cuenta en un tablero como el de la biblioteca: foto y nombre arriba; correo | nombre;
   y la contraseña, que se cambia con un código enviado al correo (lleva a la página de restablecer). */
export function AccountSettings() {
  const { c, lang } = usePrefs();
  const t = c.dashboard.account;
  const navigate = useNavigate();
  const { userId, email, createdAt, name: initialName, avatarUrl: initialAvatarUrl, updateProfile } = useOutletContext<AccountContext>();

  const [name, setName] = useState(initialName ?? "");
  const [savedName, setSavedName] = useState(initialName ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameStatus, setNameStatus] = useState<Status>("idle");

  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [codeStatus, setCodeStatus] = useState<"idle" | "sending">("idle");
  const [codeError, setCodeError] = useState<string | null>(null);

  const createdLabel = new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(createdAt));

  const onSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (nameStatus === "submitting") return;

    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t.errors.nameRequired);
      return;
    }
    setNameError(null);

    setNameStatus("submitting");
    try {
      const { error } = await supabase!.from("profiles").update({ name: trimmed }).eq("id", userId);
      if (error) throw error;
      updateProfile({ name: trimmed });
      setSavedName(trimmed);
      setNameStatus("success");
    } catch {
      setNameStatus("idle");
      setNameError(t.errors.generic);
    }
  };

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAvatarError(null);
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarError(t.errors.avatarType);
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(t.errors.avatarSize);
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase!.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data } = supabase!.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase!.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      updateProfile({ avatarUrl: publicUrl });
    } catch {
      setAvatarError(t.errors.avatarGeneric);
    } finally {
      setAvatarUploading(false);
    }
  };

  const onRemoveAvatar = async () => {
    if (avatarUploading) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const { error } = await supabase!.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      setAvatarUrl(null);
      updateProfile({ avatarUrl: null });
    } catch {
      setAvatarError(t.errors.avatarGeneric);
    } finally {
      setAvatarUploading(false);
    }
  };

  // envía el código de recuperación al correo y sigue en la página de restablecer, ya en el paso del código
  const onChangePassword = async () => {
    if (codeStatus === "sending") return;
    setCodeError(null);
    setCodeStatus("sending");
    try {
      const { error } = await supabase!.auth.resetPasswordForEmail(email);
      if (error) {
        setCodeStatus("idle");
        setCodeError(/rate limit|too many/i.test(error.message) ? t.errors.rateLimited : t.errors.generic);
        return;
      }
      navigate("/recuperar-contrasena", { state: { email, codeSent: true } });
    } catch {
      setCodeStatus("idle");
      setCodeError(t.errors.connection);
    }
  };

  const nameChanged = name.trim() !== savedName;

  return (
    <div className="dash__section">
      <div className="dash__head">
        <p className="up dash__eyebrow">{t.eyebrow}</p>
        <h1 className="dash__title">{t.title}</h1>
      </div>

      <article className="lib-product acct-board">
        <header className="lib-product__head">
          <div className="avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={24} />}</div>
          <div className="lib-product__info">
            <h2 className="lib-product__name">{savedName || email}</h2>
            <span className="lib-product__version">{t.createdOn(createdLabel)}</span>
          </div>
          <div className="acct-board__photo">
            <div className="avatar-row__controls">
              <label className="ic sm" aria-busy={avatarUploading || undefined}>
                {avatarUploading ? <span className="ic__spinner" aria-hidden="true" /> : <Upload01 size={14} />}
                {avatarUploading ? t.uploadingPhoto : avatarUrl ? t.changePhoto : t.uploadPhoto}
                <input type="file" accept="image/png,image/jpeg" onChange={onAvatarChange} disabled={avatarUploading} hidden />
              </label>
              {avatarUrl && (
                <button type="button" className="ic sm" onClick={onRemoveAvatar} disabled={avatarUploading}>
                  <Delete02 size={14} />
                  {t.removePhoto}
                </button>
              )}
            </div>
            {avatarError ? <p className="field__error">{avatarError}</p> : <p className="acct-board__hint">{t.avatarHint}</p>}
          </div>
        </header>

        <div className="lib-product__grid">
          <section className="lib-product__block">
            <label className="lib-product__title" htmlFor="account-email">
              {t.emailLabel}
            </label>
            <input id="account-email" className="acct-input" type="email" value={email} readOnly aria-describedby="account-email-hint" />
            <p className="acct-board__hint" id="account-email-hint">
              {t.emailHint}
            </p>
          </section>

          <section className="lib-product__block">
            <label className="lib-product__title" htmlFor="account-name">
              {t.nameLabel}
            </label>
            <form className="acct-board__row" onSubmit={onSaveName} noValidate>
              <input
                id="account-name"
                className="acct-input"
                type="text"
                value={name}
                data-invalid={Boolean(nameError)}
                aria-invalid={Boolean(nameError)}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameStatus === "success") setNameStatus("idle");
                }}
                placeholder={t.namePlaceholder}
                autoComplete="name"
              />
              <Button type="submit" size="sm" disabled={!nameChanged} loading={nameStatus === "submitting"}>
                {nameStatus === "submitting" ? t.savingName : t.saveName}
              </Button>
            </form>
            {nameError ? (
              <p className="field__error">{nameError}</p>
            ) : (
              nameStatus === "success" && (
                <p className="acct-board__hint" role="status">
                  {t.nameSaved}
                </p>
              )
            )}
          </section>
        </div>

        <section className="lib-product__block acct-board__security">
          <div>
            <h3 className="lib-product__title">{t.passwordTitle}</h3>
            <p className="acct-board__hint">{t.passwordDesc}</p>
            {codeError && <p className="field__error">{codeError}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onChangePassword} loading={codeStatus === "sending"}>
            {codeStatus === "sending" ? t.sendingCode : t.changePassword}
          </Button>
        </section>
      </article>
    </div>
  );
}
