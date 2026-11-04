import { Component, type ReactNode } from "react";
import { Button } from "./Button";

const KEY = "hyro.chunk-reload";
const STALE = /dynamically imported module|importing a module script|failed to fetch|loading chunk|loading css chunk/i;

/** Tras un despliegue, una pestaña abierta pide archivos con el nombre viejo y recibe HTML.
    Recargar una vez trae la versión nueva; el sello evita bucles si el fallo es otro. */
export function reloadOnceForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

const copy = {
  es: { title: "Algo salió mal", text: "Recarga la página para continuar.", button: "Recargar" },
  en: { title: "Something went wrong", text: "Reload the page to continue.", button: "Reload" },
};

function currentLang(): "es" | "en" {
  try {
    const saved = localStorage.getItem("hyro.lang");
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* sin almacenamiento */
  }
  return navigator.language?.toLowerCase().startsWith("es") ? "es" : "en";
}

/* Evita la pantalla negra: si un componente o un archivo cargado bajo demanda falla, se ve este aviso. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (STALE.test(String((error as Error)?.message ?? error))) reloadOnceForNewVersion();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = copy[currentLang()];
    return (
      <div role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 44px)" }}>{t.title}</h1>
          <p style={{ color: "var(--muted)", margin: "14px 0 24px" }}>{t.text}</p>
          <Button onClick={() => window.location.reload()}>{t.button}</Button>
        </div>
      </div>
    );
  }
}
