/* Arranque (va en <head>, bloqueante y antes de pintar): tema, idioma y «Mi cuenta» si hay sesión.
   Archivo aparte para que la política de seguridad (public/_headers) no tenga que permitir scripts dentro del HTML.
   Mismas claves que el login y los paneles: hyro.theme y hyro.lang. */
(function () {
  var d = document.documentElement;
  try {
    var t = localStorage.getItem('hyro.theme');
    if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    d.setAttribute('data-theme', t);
    // idioma elegido antes: la raíz es español y /en/ inglés
    var l = localStorage.getItem('hyro.lang');
    var path = location.pathname;
    if (l === 'en' && (path === '/' || path === '/index.html')) { location.replace('/en/' + location.hash); return; }
    // sesión de Supabase guardada: muestra «Mi cuenta» desde el primer cuadro
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) {
        var s = JSON.parse(localStorage.getItem(k) || 'null');
        if (s && s.refresh_token) d.classList.add('has-session');
      }
    }
  } catch (e) {
    d.setAttribute('data-theme', 'dark');
  }
})();
