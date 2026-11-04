import { useState } from "react";
import { usePrefs } from "../../lib/prefs";
import { AnimateIcon } from "../../components/animate-ui/icons/icon";
import { RefreshCcw } from "../../components/animate-ui/icons/hugeicons/refresh-ccw";

type Device = "desktop" | "mobile";

const PAGES = [
  { path: "cuenta/biblioteca", label: "Biblioteca" },
  { path: "cuenta/compras", label: "Compras" },
  { path: "cuenta", label: "Mi cuenta" },
];

/* La vista de cliente dentro del panel: el sitio real del cliente (con tu sesión) en un marco, sin perder el sidebar.
   Va en un iframe para que los estilos del admin no cambien cómo se ve; se recarga al cambiar el tema. */
export function ClientView() {
  const { theme } = usePrefs();
  const [device, setDevice] = useState<Device>("desktop");
  const [page, setPage] = useState(PAGES[0].path);
  const [reloads, setReloads] = useState(0);

  return (
    <div className="admin__page client-view">
      <div className="admin__head">
        <div>
          <h1 className="admin__title">Vista de cliente</h1>
          <p className="admin__sub">Así ve su cuenta un cliente, con los datos de tu propia cuenta.</p>
        </div>
        <div className="client-view__tools">
          <div className="client-view__seg" role="group" aria-label="Página">
            {PAGES.map((p) => (
              <button key={p.path} type="button" aria-pressed={page === p.path} onClick={() => setPage(p.path)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="client-view__seg" role="group" aria-label="Tamaño">
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
              Escritorio
            </button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
              Móvil
            </button>
          </div>
          <AnimateIcon animateOnHover asChild>
            <button type="button" className="icon-btn" onClick={() => setReloads((n) => n + 1)} aria-label="Recargar" title="Recargar">
              <RefreshCcw size={15} />
            </button>
          </AnimateIcon>
        </div>
      </div>

      <div className="client-view__stage" data-device={device}>
        <iframe key={`${page}-${theme}-${reloads}`} src={import.meta.env.BASE_URL + page} title="Vista de cliente" />
      </div>
    </div>
  );
}
