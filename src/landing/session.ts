import { watchLandingSession } from "../lib/landingSession";

/* Landing (index.html, HTML sin React): con la sesión iniciada, «Iniciar sesión / Crear cuenta» se cambian por el
   acceso a la cuenta del cliente (su foto si tiene una). Los estilos están en public/landing/css/styles.css. */

const root = document.documentElement;
const account = document.querySelector<HTMLAnchorElement>(".nav-account");
const photo = account?.querySelector("img") ?? null;

function showPhoto(url: string | null) {
  if (!account || !photo) return;
  if (url) {
    photo.src = url;
    photo.hidden = false;
  } else {
    photo.removeAttribute("src");
    photo.hidden = true;
  }
  account.classList.toggle("has-photo", Boolean(url));
}

// si la foto no carga, se queda el icono
photo?.addEventListener("error", () => showPhoto(null));

watchLandingSession((user) => {
  root.classList.toggle("has-session", Boolean(user));
  showPhoto(user?.avatarUrl ?? null);
});
