import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import type { AccountContext } from "../lib/useSession";
import { Button } from "../components/Button";
import { UserRound } from "../components/animate-ui/icons/hugeicons/user-round";
import { Upload01 } from "../components/animate-ui/icons/hugeicons/upload-01";
import { Delete02 } from "../components/animate-ui/icons/hugeicons/delete-02";
import { LockKeyhole } from "../components/animate-ui/icons/hugeicons/lock-keyhole";
import { Download01 } from "../components/animate-ui/icons/hugeicons/download-01";
import { Mail01 } from "../components/animate-ui/icons/hugeicons/mail-01";
import { Modal } from "../components/Modal";

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

  // descarga todo lo que la base guarda de este usuario (cada tabla solo devuelve sus filas, por RLS)
  const d = t.data;
  const [exporting, setExporting] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [newsDone, setNewsDone] = useState(false);

  const onExport = async () => {
    if (exporting || !supabase) return;
    setExporting(true);
    setDataError(null);
    try {
      const sb = supabase;
      const tables = ["profiles", "purchases", "licenses", "license_activations", "reviews", "legal_consents"] as const;
      const rows = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await sb.from(table).select("*");
          return [table, error ? { error: error.message } : data] as const;
        }),
      );
      const file = { exportedAt: new Date().toISOString(), account: { id: userId, email, createdAt }, ...Object.fromEntries(rows) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `hyro-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDataError(t.errors.generic);
    } finally {
      setExporting(false);
    }
  };

  const onUnsubscribe = async () => {
    if (!supabase) return;
    setDataError(null);
    const { error } = await supabase.rpc("newsletter_unsubscribe_me");
    if (error) setDataError(t.errors.generic);
    else setNewsDone(true);
  };

  // eliminar la cuenta: ventana que explica qué se borra y qué se guarda por ley, y pide escribir ELIMINAR
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const canDelete = deleteText.trim().toUpperCase() === "ELIMINAR";

  const onDeleteAccount = async () => {
    if (!supabase || !canDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const { data, error } = await supabase.functions.invoke<{ deleted?: boolean; error?: string }>("delete-account", { body: { confirm: "ELIMINAR" } });
    if (error || !data?.deleted) {
      let code: string | undefined = data?.error;
      const response = (error as { context?: Response } | null)?.context;
      if (response && typeof response.json === "function") code = (await response.json().catch(() => null))?.error;
      setDeleting(false);
      setDeleteError(code === "admin_account" ? d.deleteAdmin : d.deleteError);
      return;
    }
    // la cuenta ya no existe: se cierra la sesión local y se vuelve a la landing
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    window.location.replace("/");
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
          {/* la foto es el botón: al pasar el cursor se oscurece y aparece el icono de subir */}
          <label className="avatar-edit" title={avatarUrl ? t.changePhoto : t.uploadPhoto} aria-busy={avatarUploading || undefined}>
            <span className="avatar-preview">{avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={24} />}</span>
            <span className="avatar-edit__overlay" aria-hidden="true">
              {avatarUploading ? <span className="ic__spinner" /> : <Upload01 size={18} />}
            </span>
            <input
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg"
              aria-label={avatarUrl ? t.changePhoto : t.uploadPhoto}
              onChange={onAvatarChange}
              disabled={avatarUploading}
            />
          </label>
          <div className="lib-product__info">
            <h2 className="lib-product__name">{savedName || email}</h2>
            <span className="lib-product__version">
              {t.createdOn(createdLabel)}
              {/* «Quitar foto»: texto pequeño, solo si hay foto */}
              {avatarUrl && (
                <>
                  {" · "}
                  <button type="button" className="acct-textbtn" onClick={onRemoveAvatar} disabled={avatarUploading}>
                    {t.removePhoto}
                  </button>
                </>
              )}
            </span>
            {avatarError && <p className="field__error">{avatarError}</p>}
          </div>
        </header>
      </article>

      {/* correo, nombre y contraseña en su propia tarjeta, separada de la foto */}
      <article className="lib-product acct-board">
        <div className="lib-product__grid">
          <section className="lib-product__block">
            <label className="lib-product__title acct-label" htmlFor="account-email">
              <Mail01 size={15} aria-hidden="true" />
              {t.emailLabel}
            </label>
            <input id="account-email" className="acct-input" type="email" value={email} readOnly />
          </section>

          <section className="lib-product__block">
            <label className="lib-product__title acct-label" htmlFor="account-name">
              <UserRound size={15} aria-hidden="true" />
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
          <span className="acct-row__icon" aria-hidden="true">
            <LockKeyhole size={15} />
          </span>
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

      {/* tus datos: descargar todo lo que guardamos (portabilidad) */}
      <article className="lib-product acct-board">
        <section className="lib-product__block acct-board__security">
          <span className="acct-row__icon" aria-hidden="true">
            <Download01 size={15} />
          </span>
          <div>
            <h3 className="lib-product__title">{d.title}</h3>
            <p className="acct-board__hint">
              {d.exportDesc}{" "}
              <a className="acct-board__link" href="/legal/privacidad" target="_blank" rel="noopener">
                {d.policy}
              </a>
            </p>
            {dataError && <p className="field__error">{dataError}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onExport} loading={exporting}>
            {exporting ? d.exporting : d.exportBtn}
          </Button>
        </section>
      </article>

      {/* dejar las novedades y eliminar la cuenta (en rojo), juntas en una tarjeta */}
      <article className="lib-product acct-board">
        <section className="lib-product__block acct-board__security">
          <span className="acct-row__icon" aria-hidden="true">
            <Mail01 size={15} />
          </span>
          <div>
            <h3 className="lib-product__title">{d.newsTitle}</h3>
            <p className="acct-board__hint" role={newsDone ? "status" : undefined}>
              {newsDone ? d.newsDone : d.newsDesc}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onUnsubscribe} disabled={newsDone}>
            {d.newsBtn}
          </Button>
        </section>
        <section className="lib-product__block acct-board__security">
          <span className="acct-row__icon acct-row__icon--danger" aria-hidden="true">
            <Delete02 size={15} />
          </span>
          <div>
            <h3 className="lib-product__title acct-danger__title">{d.deleteRowTitle}</h3>
            <p className="acct-board__hint">{d.deleteDesc}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="acct-danger"
            onClick={() => {
              setDeleteText("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            {d.deleteBtn}
          </Button>
        </section>
      </article>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} locked={deleting} title={d.deleteTitle} className="dlg--sm acct-delete" role="alertdialog">
        <p className="acct-delete__label">{d.deleteGoneLabel}</p>
        <ul className="acct-delete__list">
          {d.deleteGone.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="acct-delete__kept">{d.deleteKept}</p>
        <label className="acct-delete__confirm" htmlFor="delete-confirm">
          {d.deleteConfirmLabel}
        </label>
        <input
          id="delete-confirm"
          className="acct-input"
          value={deleteText}
          onChange={(e) => setDeleteText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          data-autofocus
        />
        {deleteError && (
          <p className="field__error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="acct-delete__actions">
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            {d.deleteCancel}
          </Button>
          <Button size="sm" className="acct-delete__go" onClick={onDeleteAccount} disabled={!canDelete} loading={deleting}>
            {deleting ? d.deleting : d.deleteConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
