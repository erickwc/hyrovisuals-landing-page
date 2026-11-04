import "./styles/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { ErrorBoundary, reloadOnceForNewVersion } from "./components/ErrorBoundary";

// Vite avisa con este evento cuando falla un archivo cargado bajo demanda (típico tras publicar una versión nueva).
window.addEventListener("vite:preloadError", (e) => {
  if (reloadOnceForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
