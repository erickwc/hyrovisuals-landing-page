import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePrefs } from "../lib/prefs";
import { supabase } from "../lib/supabase";
import { useRequireSession } from "../lib/useSession";
import { ThemeButton } from "../components/Nav";
import { LanguagePicker } from "../components/Language";
import { AnimateIcon } from "../components/animate-ui/icons/icon";
import { Layers01 } from "../components/animate-ui/icons/hugeicons/layers-01";
import { ShoppingBag } from "../components/animate-ui/icons/hugeicons/shopping-bag";
import { UserRound } from "../components/animate-ui/icons/hugeicons/user-round";
import { Logout01 } from "../components/animate-ui/icons/hugeicons/logout-01";
import "../styles/nav.css";
import "../styles/auth.css";
import "../styles/account.css";

function tabClass({ isActive }: { isActive: boolean }) {
  return "dash-tab" + (isActive ? " active" : "");
}

export function AccountLayout() {
  const { c } = usePrefs();
  const t = c.dashboard.nav;
  const navigate = useNavigate();
  const { info, checked } = useRequireSession();

  if (!checked || !info) return null;

  const onLogout = async () => {
    await supabase?.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <header className="top">
        <div className="wrap authtop__bar">
          <Link className="logo" to="/" aria-label={c.nav.home}>
            HYRO
          </Link>
          <div className="authtop__icons">
            <ThemeButton />
            <LanguagePicker />
          </div>
        </div>
      </header>

      <nav className="dash-tabs" aria-label={t.navLabel}>
        <div className="wrap dash-tabs__row">
          <div className="dash-tabs__links">
            <NavLink to="/cuenta/biblioteca" className={tabClass}>
              <Layers01 size={16} />
              {t.library}
            </NavLink>
            <NavLink to="/cuenta/compras" className={tabClass}>
              <ShoppingBag size={16} />
              {t.purchases}
            </NavLink>
            <NavLink to="/cuenta" end className={tabClass}>
              <UserRound size={16} />
              {t.account}
            </NavLink>
          </div>
          <AnimateIcon animateOnHover asChild>
            <button type="button" className="dash-tab dash-tab--logout" onClick={onLogout}>
              <Logout01 size={16} />
              {t.logout}
            </button>
          </AnimateIcon>
        </div>
      </nav>

      <main className="dash wrap">
        <Outlet context={info} />
      </main>
    </>
  );
}
