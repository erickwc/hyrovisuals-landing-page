import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useRequireAdmin } from "../../lib/useSession";
import { supabase } from "../../lib/supabase";
import { LayoutDashboard } from "../../components/animate-ui/icons/hugeicons/layout-dashboard";
import { ShoppingBag } from "../../components/animate-ui/icons/hugeicons/shopping-bag";
import { Wallet } from "../../components/animate-ui/icons/hugeicons/wallet";
import { Tag } from "../../components/animate-ui/icons/hugeicons/tag";
import { Users } from "../../components/animate-ui/icons/hugeicons/users";
import { Settings02 } from "../../components/animate-ui/icons/hugeicons/settings-02";
import { ClipboardList } from "../../components/animate-ui/icons/hugeicons/clipboard-list";
import { Star } from "../../components/animate-ui/icons/hugeicons/star";
import { Megaphone } from "../../components/animate-ui/icons/hugeicons/megaphone";
import { Gift } from "../../components/animate-ui/icons/hugeicons/gift";
import { Logout01 } from "../../components/animate-ui/icons/hugeicons/logout-01";
import { ArrowLeft02 } from "../../components/animate-ui/icons/hugeicons/arrow-left-02";
import { UserRound } from "../../components/animate-ui/icons/hugeicons/user-round";
import { Sun03 } from "../../components/animate-ui/icons/hugeicons/sun-03";
import { Moon02 } from "../../components/animate-ui/icons/hugeicons/moon-02";
import { Menu01 } from "../../components/animate-ui/icons/hugeicons/menu-01";
import { Cancel01 } from "../../components/animate-ui/icons/hugeicons/cancel-01";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { usePrefs } from "../../lib/prefs";
import "../../styles/admin.css";

const NAV = [
  {
    label: "Análisis",
    items: [
      { to: "/admin", label: "Resumen", icon: LayoutDashboard, end: true },
      { to: "/admin/ventas", label: "Ventas", icon: ShoppingBag },
      { to: "/admin/finanzas", label: "Finanzas y cortes", icon: Wallet },
    ],
  },
  {
    label: "Gestión",
    items: [
      { to: "/admin/productos", label: "Productos", icon: Tag },
      { to: "/admin/clientes", label: "Clientes", icon: Users },
      { to: "/admin/resenas", label: "Reseñas", icon: Star },
      { to: "/admin/anuncios", label: "Contenido y anuncios", icon: Megaphone },
      { to: "/admin/cupones", label: "Cupones", icon: Gift },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/configuracion", label: "Configuración", icon: Settings02 },
      { to: "/admin/actividad", label: "Registro de actividad", icon: ClipboardList },
    ],
  },
];

// Perfil simulado: el nombre y la foto saldrán de la base de datos más adelante; el correo ya es el de la sesión.
const PROFILE: { name: string; avatarUrl: string | null } = { name: "Administrador", avatarUrl: null };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function AdminLayout() {
  const navigate = useNavigate();
  const { info, checked } = useRequireAdmin();
  const { theme, toggleTheme } = usePrefs();
  // en teléfono el sidebar es un menú lateral que se abre con la hamburguesa de la barra de arriba
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.documentElement.classList.add("admin-menu-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("admin-menu-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!checked || !info) return null;

  const onLogout = async () => {
    await supabase?.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="admin">
      <header className="admin__mobilebar">
        <AnimateIcon animateOnHover asChild>
          <button type="button" className="admin__burger" onClick={() => setMenuOpen(true)} aria-label="Abrir menú" aria-expanded={menuOpen} aria-controls="admin-menu">
            <Menu01 size={18} />
          </button>
        </AnimateIcon>
        <span className="admin__mobilebar-title">Panel de Hyro</span>
        {PROFILE.avatarUrl ? <img className="admin__avatar" src={PROFILE.avatarUrl} alt="" /> : <span className="admin__avatar">{initials(PROFILE.name)}</span>}
      </header>
      {menuOpen && <div className="admin__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside className="admin__sidebar" id="admin-menu" data-open={menuOpen}>
        <AnimateIcon animateOnHover asChild>
          <button type="button" className="admin__burger admin__menu-close" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <Cancel01 size={16} />
          </button>
        </AnimateIcon>
        <div className="admin__profile">
          {PROFILE.avatarUrl ? (
            <img className="admin__avatar" src={PROFILE.avatarUrl} alt="" />
          ) : (
            <span className="admin__avatar">{initials(PROFILE.name)}</span>
          )}
          <div className="admin__profile-text">
            <p className="admin__profile-name">{PROFILE.name}</p>
            <p className="admin__profile-email">{info.email}</p>
          </div>
          <AnimateIcon animateOnHover asChild>
            <button type="button" className="admin__logout" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión">
              <Logout01 size={15} />
            </button>
          </AnimateIcon>
        </div>

        <nav className="admin__nav">
          {NAV.map((group) => (
            <div className="admin__nav-group" key={group.label}>
              <p className="admin__nav-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "admin__nav-link" + (isActive ? " active" : "")}>
                  <item.icon size={15} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="admin__sidebar-foot">
          <AnimateIcon animateOnHover asChild>
            <button type="button" className="admin__nav-link" onClick={toggleTheme}>
              {theme === "dark" ? <Sun03 size={15} /> : <Moon02 size={15} />}
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
          </AnimateIcon>
          <NavLink to="/admin/vista-cliente" className={({ isActive }) => "admin__nav-link" + (isActive ? " active" : "")}>
            <UserRound size={15} />
            Ver como cliente
          </NavLink>
          <a className="admin__nav-link" href="/">
            <ArrowLeft02 size={15} />
            Volver al sitio
          </a>
        </div>
      </aside>

      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  );
}
