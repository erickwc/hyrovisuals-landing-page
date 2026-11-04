import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { useRequireSession, type AccountContext, type SessionInfo } from "../lib/useSession";
import { rememberProfile } from "../lib/landingSession";
import { ThemeButton } from "../components/Nav";
import { LanguagePicker } from "../components/Language";
import { AccountMenu } from "../components/AccountMenu";
import { Layers01 } from "../components/animate-ui/icons/hugeicons/layers-01";
import { ShoppingBag } from "../components/animate-ui/icons/hugeicons/shopping-bag";
import "../styles/nav.css";
import "../styles/auth.css";
import "../styles/account.css";

function tabClass({ isActive }: { isActive: boolean }) {
  return "dash-tab" + (isActive ? " active" : "");
}

export function AccountLayout() {
  const { c } = usePrefs();
  const t = c.dashboard.nav;
  const { info: sessionInfo, checked } = useRequireSession();
  // copia local para que la foto y el nombre de la barra cambien en cuanto se guardan en Configuración
  const [info, setInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    setInfo(sessionInfo);
  }, [sessionInfo]);

  if (!checked || !info) return null;

  const context: AccountContext = {
    ...info,
    updateProfile: (patch) => {
      const next = { ...info, ...patch };
      setInfo(next);
      // la landing muestra la foto nueva sin volver a consultar
      rememberProfile(next.userId, { name: next.name, avatarUrl: next.avatarUrl });
    },
  };

  return (
    <>
      <header className="top">
        <div className="wrap dash-top">
          <Link className="logo" to="/" aria-label={c.nav.home}>
            HYRO
          </Link>
          <nav className="dash-top__links" aria-label={t.navLabel}>
            <NavLink to="/cuenta/biblioteca" className={tabClass}>
              <Layers01 size={16} />
              {t.library}
            </NavLink>
            <NavLink to="/cuenta/compras" className={tabClass}>
              <ShoppingBag size={16} />
              {t.purchases}
            </NavLink>
          </nav>
          <div className="authtop__icons dash-top__icons">
            <ThemeButton />
            <LanguagePicker />
            <AccountMenu name={info.name} email={info.email} avatarUrl={info.avatarUrl} />
          </div>
        </div>
      </header>

      <main className="dash wrap">
        <Outlet context={context} />
      </main>
    </>
  );
}
