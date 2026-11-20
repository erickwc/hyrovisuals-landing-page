/* Arranque de la landing (va en <head>, bloqueante, antes de pintar): tema, idioma, «Mi cuenta» si hay sesión,
   la intro y la red de seguridad que la quita si algo falla. Está en un archivo aparte (antes iba dentro del HTML)
   para que la política de seguridad (public/_headers) no tenga que permitir scripts sueltos en la página. */
  (function () {
    var d = document.documentElement;
    try {
      // tema e idioma compartidos con el login y los paneles (mismas claves)
      var t = localStorage.getItem('hyro.theme');
      if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      d.setAttribute('data-theme', t);
      var l = localStorage.getItem('hyro.lang');
      if (l !== 'es' && l !== 'en') l = (navigator.language || 'es').toLowerCase().indexOf('es') === 0 ? 'es' : 'en';
      d.lang = l;
      // sesión de Supabase guardada: muestra «Mi cuenta» desde el primer cuadro (src/landing/session.ts la confirma luego)
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-.+-auth-token$/.test(k)) {
          var s = JSON.parse(localStorage.getItem(k) || 'null');
          if (s && s.refresh_token) d.classList.add('has-session');
        }
      }
    } catch (e) {}
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) d.classList.add('is-intro');
    d.classList.add('js');
    // Red de seguridad: si la web no terminó de arrancar (un script que falló o no cargó en algún navegador),
    // se quita la intro para que el contenido siempre se vea.
    var rescue = function () {
      if (d.classList.contains('is-ready')) return;
      d.classList.remove('is-intro'); d.classList.add('is-ready');
      var i = document.getElementById('intro'); if (i && i.parentNode) i.parentNode.removeChild(i);
      if (window.HV) window.HV.paused = false;
    };
    addEventListener('load', function () { setTimeout(rescue, 4000); });
    setTimeout(rescue, 12000);
  })();
