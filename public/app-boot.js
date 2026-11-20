/* Arranque de la app (en <head>, antes de pintar): tema e idioma guardados. Archivo aparte, no dentro del HTML,
   para que la política de seguridad (public/_headers) no tenga que permitir scripts sueltos. */
try {
  var t = localStorage.getItem("hyro.theme");
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  var l = localStorage.getItem("hyro.lang");
  if (l === "es" || l === "en") document.documentElement.lang = l;
} catch (e) {}
