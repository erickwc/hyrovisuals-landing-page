import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { forgetProfile } from "../lib/landingSession";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { EASE } from "./ui";
import { AnimateIcon } from "./animate-ui/icons/icon";
import { UserRound } from "./animate-ui/icons/hugeicons/user-round";
import { Settings02 } from "./animate-ui/icons/hugeicons/settings-02";
import { Logout01 } from "./animate-ui/icons/hugeicons/logout-01";
import "../styles/language.css";

/* Foto del cliente en la barra: abre un mini menú con Configuración y Cerrar sesión (que pide confirmación). */
export function AccountMenu({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  const { c } = usePrefs();
  const t = c.dashboard.nav;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const askLogout = () => {
    setOpen(false);
    setConfirming(true);
  };

  const onLogout = async () => {
    setLeaving(true);
    await supabase?.auth.signOut();
    forgetProfile();
    navigate("/login", { replace: true });
  };

  return (
    <div className="lp acct-menu" ref={root}>
      <button type="button" className="acct-avatar" onClick={() => setOpen((o) => !o)} aria-label={t.accountMenu} aria-haspopup="menu" aria-expanded={open}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={16} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="lp__pop acct-menu__pop"
            role="menu"
            aria-label={t.accountMenu}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            <div className="acct-menu__who">
              {name && <b>{name}</b>}
              <span>{email}</span>
            </div>
            <AnimateIcon animateOnHover asChild>
              <Link to="/cuenta" role="menuitem" className="lp__opt acct-menu__opt" onClick={() => setOpen(false)}>
                <Settings02 size={16} />
                {t.settings}
              </Link>
            </AnimateIcon>
            <AnimateIcon animateOnHover asChild>
              <button type="button" role="menuitem" className="lp__opt acct-menu__opt acct-menu__opt--out" onClick={askLogout}>
                <Logout01 size={16} />
                {t.logout}
              </button>
            </AnimateIcon>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        locked={leaving}
        role="alertdialog"
        title={t.logoutTitle}
        description={t.logoutBody}
        className="dlg--sm"
      >
        <div className="dlg__actions">
          <Button variant="ghost" size="sm" data-autofocus onClick={() => setConfirming(false)} disabled={leaving}>
            {t.cancel}
          </Button>
          <Button size="sm" onClick={onLogout} loading={leaving}>
            {leaving ? t.loggingOut : t.logoutConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
