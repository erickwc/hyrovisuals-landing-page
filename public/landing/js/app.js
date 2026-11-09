/* Hyro Visuals — lógica de la web */
(function () {
  'use strict';

  /* ===== Configuración: enlaces a la app (React) que vive en las mismas rutas del sitio ===== */
  const CONFIG = {
    // checkout propio (Wompi): pide la sesión si falta. "equipos" es el id del plan Equipos en Supabase.
    checkout: { personal: '/checkout?plan=personal', teams: '/checkout?plan=equipos' },
    auth: { login: '/login', signup: '/register' }, // Iniciar sesión y Crear cuenta
    newsletterEndpoint: ''                    // URL que recibe POST {email}
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const t = k => I18N.t(k);
  // Ejecuta una parte de la web sin que su error detenga a las demás (ver "Arranque").
  const safe = (name, fn) => { try { fn(); return true; } catch (err) { console.error('[Hyro] ' + name, err); return false; } };

  /* ---------- Íconos (Hugeicons en línea) ---------- */
  function icons(scope = document) {
    $$('svg[data-icon]', scope).forEach(svg => {
      if (svg.dataset.done) return;
      const d = window.HI && window.HI[svg.dataset.icon];
      if (!d) return;
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = d; svg.dataset.done = '1';
    });
  }
  safe('icons', icons);

  /* ---------- Tema ---------- */
  function readTheme() {
    const cs = getComputedStyle(root), v = n => cs.getPropertyValue(n).trim();
    HV.setTheme({ ink: v('--ink'), red: v('--red'), panel: v('--panel'), dim: v('--ink-3'), key: root.dataset.theme });
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = v('--bg');
  }
  safe('tema', readTheme);
  $('#themeBtn').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('hyro.theme', root.dataset.theme); } catch (e) {}
    safe('tema', readTheme);
  });

  /* ---------- Idioma ---------- */
  safe('textos', () => I18N.collect());
  const listeners = [];
  const onLang = fn => { listeners.push(fn); };
  document.addEventListener('langchange', () => listeners.forEach(fn => safe('idioma', () => fn(I18N.lang))));
  $('#langBtn').addEventListener('click', () => I18N.apply(I18N.lang === 'es' ? 'en' : 'es'));
  onLang(l => { $('#langLabel').textContent = l.toUpperCase(); });

  /* ---------- Bucle de animación ----------
     Un error en un cuadro (un navegador que no soporta algo) no puede detener el bucle: se registra, se quita
     esa animación y, si la intro sigue en pantalla, se termina para mostrar la web. */
  const frameHooks = [];
  let frameErr = false;
  function loop(now) {
    try { HV.frame(now); } catch (err) { if (!frameErr) { frameErr = true; console.error('[Hyro] visuales', err); } }
    for (let i = 0; i < frameHooks.length; i++) {
      try { frameHooks[i](now); } catch (err) { console.error('[Hyro] animación', err); frameHooks.splice(i--, 1); endIntro(); }
    }
    requestAnimationFrame(loop);
  }

  /* Quita la intro de golpe y deja la web lista (si la intro falla o no puede correr). */
  function endIntro() {
    const el = $('#intro'); if (el) el.remove();
    root.classList.remove('is-intro'); root.classList.add('is-ready');
    HV.paused = false;
  }

  /* ---------- Intro: onda circular que se expande ---------- */
  function intro() {
    const el = $('#intro');
    if (!root.classList.contains('is-intro') || !el) { root.classList.add('is-ready'); el && el.remove(); return; }
    const cv = $('#introCanvas'), c = cv.getContext('2d'), pct = $('#introPct'), meta = $('.intro-meta', el);
    const cs = getComputedStyle(root), red = cs.getPropertyValue('--red').trim(), bg = cs.getPropertyValue('--intro-bg').trim();
    const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const mixC = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
    const redLight = mixC(red, '#ffffff', .28), redDeep = mixC(red, '#000000', .18);
    let W = 0, H = 0, dpr = 1, pts = [];
    const fract = x => x - Math.floor(x);
    const h1 = n => fract(Math.sin(n * 91.345 + 7.13) * 43758.5453);
    const smooth = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i) * (1 - u) + h1(i + 1) * u; };
    function build() {
      // Silueta de onda: envolvente por frases + detalle suavizado entre vecinos (como la vista general de una pista).
      const step = W < 640 ? 4 : 6, n = Math.ceil(W / step) + 2, raw = [];
      for (let i = 0; i < n; i++) raw.push(h1(i * 1.37));
      pts = raw.map((r, i) => {
        const d = (raw[Math.max(0, i - 1)] + 2 * r + raw[Math.min(n - 1, i + 1)]) / 4;
        const env = .3 + .7 * Math.pow(smooth(i / 34), 1.3) + smooth(i / 8 + 50) * .18;
        return { x: i * step, a: Math.min(1, env * (.3 + .7 * d)), b: .9 + .1 * h1(i * 5.1), ph: h1(i * 7.7) * 6.283 };
      });
    }
    // Resolución moderada: la forma es suave, así que no necesita DPR alto (mucho menos trabajo por cuadro).
    let waveFill = red;
    const size = () => {
      dpr = Math.min(1.25, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); build();
      const g = c.createLinearGradient(0, H * .3, 0, H * .7);
      g.addColorStop(0, redLight); g.addColorStop(.5, red); g.addColorStop(1, redDeep); waveFill = g;
    };
    size(); addEventListener('resize', size);
    const LOAD = 1000, REVEAL = 1000;
    let t0 = 0, revealAt = 0, skip = false;
    HV.paused = true; // los visuales de la web no se dibujan mientras están totalmente cubiertos
    el.addEventListener('click', () => { skip = true; });
    const easeOut = p => 1 - Math.pow(1 - p, 3);
    const easeIn = p => p * p * p;
    const A = HA.S;

    // Traza la silueta de la onda: contorno superior de izquierda a derecha e inferior de regreso.
    function shape(tt, spread, grow, extra) {
      const cy = H / 2, maxA = Math.min(H * .2, 160), t = tt / 1000, mid = W / 2;
      const amp = p => {
        const dist = Math.abs(p.x - mid) / mid, edge = Math.max(0, Math.min(1, (spread - dist) * 6));
        const live = .82 + .18 * Math.sin(t * 8 + p.ph) + A.kick * .16;
        return maxA * p.a * live * edge * grow + extra;
      };
      c.beginPath(); c.moveTo(0, cy);
      for (const p of pts) c.lineTo(p.x, cy - amp(p));
      c.lineTo(W, cy);
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; c.lineTo(p.x, cy + amp(p) * p.b); }
      c.closePath();
    }
    let lastPct = '';
    frameHooks.push(function step(now) {
      if (!el.isConnected) return;
      if (!t0) t0 = now; // el reloj arranca en el primer cuadro real, no durante la carga de la página
      const tt = now - t0;
      if (!revealAt && (tt > LOAD || skip)) {
        revealAt = now; el.style.background = 'transparent'; HV.paused = false; pct.textContent = '100';
        root.classList.add('is-ready', 'hl-anim'); // el título entra mientras la onda se abre, sin esperar al final
        setTimeout(() => root.classList.remove('hl-anim'), 1800);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!revealAt) {
        // 1 · Carga: la onda rellena se dibuja desde el centro hacia los lados.
        const p = Math.min(1, tt / LOAD), e = easeOut(p), txt = String(Math.round(e * 100)).padStart(3, '0');
        if (txt !== lastPct) { pct.textContent = txt; lastPct = txt; }
        c.clearRect(0, 0, W, H);
        shape(tt, Math.min(1.1, e * 1.2), 1, 0); c.fillStyle = waveFill; c.fill();
      } else {
        // 2 · Revelado: la cubierta se vuelve roja y la onda crece como máscara; dentro de su forma aparece la web.
        const p = Math.min(1, (now - revealAt) / REVEAL), e = easeIn(p), k = easeOut(p);
        meta.style.opacity = String(1 - k);
        c.fillStyle = p < .2 ? mixC(bg, red, p / .2) : red; c.fillRect(0, 0, W, H);
        shape(tt, 1.1, 1 + k * 3.2, e * (H / 2 + 60));
        c.globalCompositeOperation = 'destination-out'; c.fill();
        c.globalCompositeOperation = 'source-over';
        if (p >= 1) {
          root.classList.remove('is-intro'); root.classList.add('is-ready');
          removeEventListener('resize', size); el.remove();
          frameHooks.splice(frameHooks.indexOf(step), 1);
        }
      }
    });
  }

  /* ---------- Posición al recargar y enlaces internos sin "#" en la URL ---------- */
  function scrollMemory() {
    const KEY = 'hyro-web-scroll';
    try { history.scrollRestoration = 'manual'; } catch (e) {}
    const navOff = () => (parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 60) + 8;
    const save = () => {
      let id = '', off = 0;
      for (const s of $$('main > section, #footer')) {
        const r = s.getBoundingClientRect();
        if (r.top <= 140 && r.bottom > 140) { id = s.id; off = -r.top; break; }
      }
      try { sessionStorage.setItem(KEY, JSON.stringify({ y: scrollY, id, off, path: location.pathname })); } catch (e) {}
    };
    let timer = 0;
    addEventListener('scroll', () => { clearTimeout(timer); timer = setTimeout(save, 120); }, { passive: true });
    addEventListener('pagehide', save);

    // Al recargar (o volver atrás) se regresa a la misma sección; con un enlace nuevo a #seccion, a esa sección.
    let data = null; try { data = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const kind = nav ? nav.type : 'navigate';
    const hashEl = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    const target = () => {
      if ((kind === 'reload' || kind === 'back_forward') && data && data.path === location.pathname) {
        const el = data.id && document.getElementById(data.id);
        return el ? el.getBoundingClientRect().top + scrollY + data.off : data.y;
      }
      if (hashEl) return hashEl.getBoundingClientRect().top + scrollY - navOff();
      return 0;
    };
    let userMoved = false;
    ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { userMoved = true; }, { once: true, passive: true }));
    // behavior 'instant' no existe en Safari antiguo (lanza un error): ahí se usa scrollTo(x, y), que también es inmediato
    const jump = top => { try { scrollTo({ top, behavior: 'instant' }); } catch (e) { scrollTo(0, top); } };
    const apply = () => { if (!userMoved) jump(Math.max(0, Math.round(target()))); };
    apply(); requestAnimationFrame(apply);
    document.fonts && document.fonts.ready.then(() => requestAnimationFrame(apply));
    setTimeout(apply, 400);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);

    // Los enlaces internos hacen scroll suave sin escribir "#seccion" en la URL (así recargar no salta a otra parte).
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains('skip') || e.defaultPrevented) return;
      const id = a.getAttribute('href').slice(1);
      e.preventDefault();
      if (!id) return;
      const el = document.getElementById(id); if (!el) return;
      scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - (id === 'inicio' ? 0 : navOff())), behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---------- Navegación ---------- */
  function nav() {
    const navEl = $('#nav'), btn = $('#menuBtn');
    const onScroll = () => navEl.classList.toggle('is-scrolled', scrollY > 40);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    const close = () => { navEl.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => {
      const open = !navEl.classList.contains('is-open');
      navEl.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open));
    });
    $$('#mobileMenu a').forEach(a => a.addEventListener('click', close));
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    const links = $$('.nav-links a');
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['inicio', 'funciones', 'accion', 'resenas', 'preguntas', 'comprar'].forEach(id => { const s = document.getElementById(id); s && io.observe(s); });
  }

  /* ---------- Hero: franja · cuadrícula · separados ---------- */
  function hero() {
    const stage = $('#stage'), screen = $('#stageScreen'), tiles = $$('.tile', screen), seg = $('#stageSeg');
    const thumb = $('.seg-thumb', seg), buttons = $$('button', seg), desc = $('#stageDesc');
    const inner = document.createElement('div'); inner.className = 'stage-inner'; screen.appendChild(inner);
    tiles.forEach(tile => { inner.appendChild(tile); tile.inst = HV.create($('canvas', tile), tile.dataset.vis, { zoomAware: true }); });
    // En móvil el visual se dibuja a tamaño de escritorio y se escala completo, sin recortar módulos.
    const VW = 900, VH = 600;
    function dims() {
      const W0 = screen.clientWidth;
      if (W0 >= 640) {
        screen.style.height = ''; inner.style.transform = '';
        const H0 = screen.clientHeight; inner.style.width = W0 + 'px'; inner.style.height = H0 + 'px';
        return { W: W0, H: H0 };
      }
      const k = W0 / VW;
      inner.style.width = VW + 'px'; inner.style.height = VH + 'px'; inner.style.transform = `scale(${k})`;
      screen.style.height = Math.round(VH * k) + 'px';
      return { W: VW, H: VH };
    }
    const names = () => $$('.tile-name', screen).forEach(n => { n.textContent = I18N.moduleName(n.dataset.name); });
    names(); onLang(() => { names(); desc.innerHTML = t('stage.d.' + mode); });

    let mode = 'grid', timer = 0, hover = false, pausedUntil = 0, visible = true;
    const MODES = ['grid', 'strip', 'float'];

    function rows(n, r) { const base = Math.floor(n / r), extra = n % r; return Array.from({ length: r }, (_, i) => base + (i < extra ? 1 : 0)); }
    function layout() {
      const { W, H } = dims(), mobile = W < 640, n = tiles.length;
      const rects = new Array(n);
      if (mode === 'strip') {
        const pad = mobile ? 12 : 26, SW = W - pad * 2, R = 14;
        const sh = Math.round(clamp(H * .38, 120, 190)), y = Math.round((H - sh) / 2);
        const pri = mobile ? ['mascot', 'spectrum', 'mesh'] : null;
        const shown = pri ? tiles.filter(tl => pri.includes(tl.dataset.vis)) : tiles;
        const wt = tl => mobile ? Math.min(1.6, +tl.dataset.w) : +tl.dataset.w;
        const total = shown.reduce((a, tl) => a + wt(tl), 0);
        let x = pad;
        tiles.forEach((tl, i) => {
          if (!shown.includes(tl)) { rects[i] = { x: W + 20, y, w: 120, h: sh, hidden: true, r: '0' }; return; }
          const w = SW * wt(tl) / total, first = tl === shown[0], last = tl === shown[shown.length - 1];
          rects[i] = { x, y, w, h: sh, first, r: `${first ? R : 0}px ${last ? R : 0}px ${last ? R : 0}px ${first ? R : 0}px` }; x += w;
        });
      } else if (mode === 'grid') {
        let best = null;
        for (let cols = 1; cols <= n; cols++) {
          const r = Math.ceil(n / cols), score = Math.abs(Math.log((W / cols) / (H / r) / 1.3)) + (r * cols - n) * .05;
          if (!best || score < best.score) best = { score, r };
        }
        const counts = rows(n, best.r), rh = H / best.r; let i = 0;
        counts.forEach((cnt, ri) => {
          const row = tiles.slice(i, i + cnt), wt = tl => clamp(+tl.dataset.w, 1, 1.8), total = row.reduce((a, tl) => a + wt(tl), 0);
          let x = 0;
          row.forEach(tl => { const w = W * wt(tl) / total; rects[i++] = { x, y: ri * rh, w, h: rh }; x += w; });
        });
      } else {
        const gap = mobile ? 10 : 16, pad = mobile ? 14 : 26, AW = W - pad * 2, AH = H - pad * 2;
        let best = null;
        for (let cols = 1; cols <= n; cols++) {
          const r = Math.ceil(n / cols), s = Math.min((AW - gap * (cols - 1)) / cols, (AH - gap * (r - 1)) / r);
          if (!best || s > best.s) best = { s, cols, r };
        }
        const { s, cols, r } = best, counts = rows(n, r), oy = (H - (r * s + (r - 1) * gap)) / 2; let i = 0;
        counts.forEach((cnt, ri) => {
          const ox = (W - (cnt * s + (cnt - 1) * gap)) / 2;
          for (let k = 0; k < cnt; k++) {
            const lift = (k + ri) % 2 ? -s * .04 : s * .04;
            rects[i++] = { x: ox + k * (s + gap), y: oy + ri * (s + gap) + lift, w: s, h: s };
          }
        });
        void cols;
      }
      tiles.forEach((tl, i) => {
        const r = rects[i];
        tl.style.transitionDelay = (i * 28) + 'ms';
        tl.style.width = r.w + 'px'; tl.style.height = r.h + 'px';
        tl.style.transform = `translate(${r.x}px, ${r.y}px)`;
        tl.style.borderRadius = r.r ?? (mode === 'float' ? '14px' : '0');
        tl.classList.toggle('is-hidden', !!r.hidden);
        tl.classList.toggle('is-first', !!r.first);
      });
    }
    function moveThumb() {
      const b = buttons.find(x => x.dataset.mode === mode);
      thumb.style.left = b.offsetLeft + 'px'; thumb.style.width = b.offsetWidth + 'px';
    }
    function setMode(m, user) {
      mode = m; stage.dataset.mode = m;
      buttons.forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      desc.innerHTML = t('stage.d.' + m);
      moveThumb(); layout();
      if (user) pausedUntil = performance.now() + 14000;
    }
    buttons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode, true)));
    seg.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = MODES.indexOf(mode), next = MODES[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
      setMode(next, true); buttons.find(b => b.dataset.mode === next).focus();
    });
    stage.addEventListener('pointerenter', () => { hover = true; });
    stage.addEventListener('pointerleave', () => { hover = false; });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stage);
    let resizeRaf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        tiles.forEach(tl => { tl.style.transition = 'none'; }); layout(); moveThumb();
        requestAnimationFrame(() => tiles.forEach(tl => { tl.style.transition = ''; }));
      });
    }).observe(screen);
    setMode('grid');
    if (!reduce) timer = setInterval(() => {
      if (!visible || hover || document.hidden || performance.now() < pausedUntil) return;
      setMode(MODES[(MODES.indexOf(mode) + 1) % 3]);
    }, 4200);
    onLang(() => requestAnimationFrame(moveThumb));
    document.fonts && document.fonts.ready.then(moveThumb);
  }

  /* ---------- Funciones ---------- */
  function features() {
    // 01 · 30+ espectros
    const ids = HV.ids.filter(id => I18N.MODULES.some(m => m[0] === id));
    const spec = HV.create($('#specCanvas'), ids[0]);
    const name = $('#specName'), idx = $('#specIdx'), track = $('#marquee');
    let si = 0, specTimer = 0, specVisible = false;
    function buildMarquee() {
      const items = I18N.MODULES.map(m => `<span data-id="${m[0]}">${I18N.moduleName(m[0])}</span>`).join('');
      track.innerHTML = items + items;
    }
    function showSpec(i) {
      si = (i + ids.length) % ids.length; const id = ids[si];
      HV.setId(spec, id);
      name.textContent = I18N.moduleName(id);
      idx.textContent = String(I18N.MODULES.findIndex(m => m[0] === id) + 1).padStart(2, '0');
      $$('span', track).forEach(s => s.classList.toggle('is-on', s.dataset.id === id));
    }
    function restartSpec() { clearInterval(specTimer); if (!reduce) specTimer = setInterval(() => { if (specVisible && !document.hidden) showSpec(si + 1); }, 2000); }
    $('#specDemo').addEventListener('click', () => { showSpec(si + 1); restartSpec(); });
    document.addEventListener('spec:show', e => { const i = ids.indexOf(e.detail); if (i >= 0) { showSpec(i); restartSpec(); } });
    new IntersectionObserver(es => { specVisible = es[0].isIntersecting; }).observe($('#specDemo'));
    buildMarquee(); showSpec(0); restartSpec();
    onLang(() => { buildMarquee(); showSpec(si); });

    // 02 · Se adapta
    const adapt = $('#adapt'), tag = $('#adaptTag');
    let adVisible = false;
    new IntersectionObserver(es => { adVisible = es[0].isIntersecting; }).observe(adapt);
    const toggleFit = () => { const fit = !adapt.classList.contains('is-fit'); adapt.classList.toggle('is-fit', fit); tag.classList.toggle('is-on', fit); };
    if (reduce) toggleFit(); else setInterval(() => { if (adVisible && !document.hidden) toggleFit(); }, 2600);
    setTimeout(() => { if (!adapt.classList.contains('is-fit')) toggleFit(); }, 900);

    // 03 · Personalizable
    const combos = [
      { style: 'brutal', theme: 'brutal', pal: 'original', accent: null, sw: 'var(--red)' },
      { style: 'vintage', theme: 'vintage', pal: 'ember', accent: '#b4532f', sw: '#ffa47c' },
      { style: 'cosmos', theme: 'cosmos', pal: 'violet', accent: '#a49bff', sw: '#c9b6ff' },
      { style: 'blueprint', theme: 'blueprint', pal: 'ice', accent: '#62dbef', sw: '#62dbef' },
      { style: 'arcade', theme: 'arcade', pal: 'rose', accent: '#ff7fb0', sw: '#f8b4c7' },
      { style: 'crt', theme: 'crt', pal: 'mint', accent: '#80e09a', sw: '#b5f3cc' }
    ];
    const cA = HV.create($('#customCanvas'), 'spectrum'), cB = HV.create($('#customCanvas2'), 'orbit');
    const chips = $('#customChips'), sws = $('#customSwatches'), ctag = $('#customTag');
    let ci = 0, cVisible = false, cPaused = 0;
    function buildChips() {
      chips.innerHTML = combos.map((c, i) => `<button type="button" class="chip" data-i="${i}">${I18N.themeName(c.theme)}</button>`).join('');
      sws.innerHTML = combos.map((c, i) => `<span class="sw" style="--c:${c.sw}" data-i="${i}" title="${I18N.paletteName(c.pal)}"></span>`).join('');
      $$('button', chips).forEach(b => b.addEventListener('click', () => { setCombo(+b.dataset.i); cPaused = performance.now() + 9000; }));
    }
    function setCombo(i) {
      ci = (i + combos.length) % combos.length; const c = combos[ci];
      [cA, cB].forEach(inst => { inst.opts.style = c.style; inst.opts.accent = c.accent; if (inst.st) inst.st = {}; });
      $$('.chip', chips).forEach(b => b.classList.toggle('on', +b.dataset.i === ci));
      $$('.sw', sws).forEach(s => s.classList.toggle('on', +s.dataset.i === ci));
      ctag.textContent = I18N.themeName(c.theme) + ' · ' + I18N.paletteName(c.pal);
    }
    new IntersectionObserver(es => { cVisible = es[0].isIntersecting; }).observe(chips);
    buildChips(); setCombo(0);
    if (!reduce) setInterval(() => { if (cVisible && !document.hidden && performance.now() > cPaused) setCombo(ci + 1); }, 1900);
    onLang(() => { buildChips(); setCombo(ci); });

    // 04 · Windows y Mac
    $$('.demo-os canvas[data-vis]').forEach(cv => HV.create(cv, cv.dataset.vis));
  }

  /* ---------- Míralo en acción (recorrido por la app) ---------- */
  function tour() {
    const tourEl = $('#tour'), view = $('#tourView'), mk = $('#mk'), strip = $('#mkStrip');
    const cursor = $('#mkCursor'), focus = $('#mkFocus'), dd = $('#mkDD'), hots = $('#mkHots');
    const cardsEl = $('#tourCards');
    const WEIGHTS = { spectrum: 2.4, phase: 1, dynamics: 1.5, pixels: 1, particles: 1, spectrogram: 1.6, mascot: 1, mesh: 1, orbit: 1 };
    const DEFAULT = ['spectrum', 'phase', 'dynamics', 'pixels', 'particles', 'spectrogram', 'mascot', 'mesh'];
    const FULL = [0, 0, 1600, 900];
    let order = DEFAULT.slice();
    const cells = {};

    /* Construcción del mock */
    function ensureCell(id) {
      if (cells[id]) return cells[id];
      const el = document.createElement('div'); el.className = 'mk-cell'; el.dataset.id = id;
      const cv = document.createElement('canvas'); el.appendChild(cv); strip.appendChild(el);
      cells[id] = { el, inst: HV.create(cv, id, { zoomAware: true }) };
      return cells[id];
    }
    function stripLefts(list) {
      const total = list.reduce((a, id) => a + WEIGHTS[id], 0); let x = 0; const out = {};
      list.forEach(id => { const w = 1600 * WEIGHTS[id] / total; out[id] = [x, w]; x += w; });
      return out;
    }
    function layoutStrip() {
      const pos = stripLefts(order);
      Object.keys(cells).forEach(id => { if (!pos[id]) cells[id].el.style.display = 'none'; });
      order.forEach(id => { const c = ensureCell(id); c.el.style.display = ''; c.el.style.left = pos[id][0] + 'px'; c.el.style.width = pos[id][1] + 'px'; });
    }
    DEFAULT.concat('orbit').forEach(ensureCell);
    layoutStrip();

    const themeChips = $('#mkThemeChips'), palChips = $('#mkPaletteChips'), list = $('#mkList');
    function buildPanel() {
      themeChips.innerHTML = I18N.THEMES.map(th => `<span class="mk-chip${th[0] === 'brutal' ? ' on' : ''}" data-id="${th[0]}">${I18N.themeName(th[0])}</span>`).join('');
      palChips.innerHTML = I18N.PALETTES.map(p => `<span class="mk-chip${p[0] === 'original' ? ' on' : ''}" data-id="${p[0]}">${I18N.paletteName(p[0])}</span>`).join('');
      list.innerHTML = I18N.MODULES.map(m => `<span class="mk-item${DEFAULT.includes(m[0]) ? ' on' : ''}" data-id="${m[0]}"><span class="mk-cb"><svg data-icon="tick"></svg></span><span>${I18N.moduleName(m[0])}</span><span class="mk-arr">↑↓</span></span>`).join('');
      icons(list);
    }
    buildPanel();

    /* Utilidades de posición, cámara y cursor */
    function box(el) { let x = 0, y = 0, e = el; while (e && e !== mk) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return [x, y, el.offsetWidth, el.offsetHeight]; }
    function union(...rs) { const x = Math.min(...rs.map(r => r[0])), y = Math.min(...rs.map(r => r[1])); return [x, y, Math.max(...rs.map(r => r[0] + r[2])) - x, Math.max(...rs.map(r => r[1] + r[3])) - y]; }
    let curCam = FULL;
    function cam(rect, focusRect) {
      curCam = rect;
      let [x, y, w, h] = rect;
      const vw = view.clientWidth, vh = view.clientHeight, mobile = vw < 640;
      const pad = mobile ? 8 : 34, s = Math.min((vw - pad * 2) / w, (vh - pad * 2) / h, mobile ? 1 : 1.6);
      let tx = vw / 2 - (x + w / 2) * s, ty = vh / 2 - (y + h / 2) * s;
      const WW = 1600 * s, WH = 900 * s, sx = vw * .18, sy = vh * .22;
      tx = WW > vw ? clamp(tx, vw - WW - sx, sx) : (vw - WW) / 2;
      ty = WH > vh ? clamp(ty, vh - WH - sy, sy) : (vh - WH) / 2;
      mk.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    }
    function hl(rect) {
      if (!rect) { focus.classList.remove('is-on'); return; }
      const p = 6; focus.style.left = (rect[0] - p) + 'px'; focus.style.top = (rect[1] - p) + 'px';
      focus.style.width = (rect[2] + p * 2) + 'px'; focus.style.height = (rect[3] + p * 2) + 'px'; focus.classList.add('is-on');
      // La cámara siempre encuadra el área resaltada completa (nunca queda cortada en la vista).
      const m = 12, need = [Math.max(0, rect[0] - m), Math.max(0, rect[1] - m), rect[2] + m * 2, rect[3] + m * 2];
      const [cx, cy, cw, ch] = curCam;
      if (need[0] < cx || need[1] < cy || need[0] + need[2] > cx + cw || need[1] + need[3] > cy + ch) cam(union(curCam, need));
    }
    let run = 0; const ABORT = {};
    const wait = ms => new Promise((res, rej) => { const id = run; setTimeout(() => (id === run ? res() : rej(ABORT)), ms); });
    let cur = { x: 820, y: 620 };
    function place(x, y, dur) { cursor.style.setProperty('--cd', dur + 'ms'); cursor.style.transform = `translate(${x - 5.4}px, ${y - 3.3}px)`; cur = { x, y }; }
    async function moveTo(x, y, dur) { dur = dur ?? clamp(Math.hypot(x - cur.x, y - cur.y) * .9, 380, 1000); place(x, y, dur); await wait(dur); }
    async function moveToEl(el, ox = .5, oy = .55, dur) { const [x, y, w, h] = box(el); await moveTo(x + w * ox, y + h * oy, dur); }
    async function click(el) {
      cursor.classList.add('is-down'); el && el.classList.add('is-press'); await wait(110);
      cursor.classList.remove('is-down', 'is-click'); el && el.classList.remove('is-press'); void cursor.offsetWidth; cursor.classList.add('is-click');
      await wait(170);
    }

    /* Estado del mock */
    const chipOf = (wrap, id) => $(`.mk-chip[data-id="${id}"]`, wrap);
    function setStyle(id) {
      $$('.mk-chip', themeChips).forEach(c => c.classList.toggle('on', c.dataset.id === id));
      const style = ['vintage', 'cosmos', 'blueprint', 'crt', 'arcade'].includes(id) ? id : 'brutal';
      Object.values(cells).forEach(c => { c.inst.opts.style = style; });
    }
    function setPalette(id) {
      $$('.mk-chip', palChips).forEach(c => c.classList.toggle('on', c.dataset.id === id));
      const p = I18N.PALETTES.find(x => x[0] === id), col = p && p[3];
      Object.values(cells).forEach(c => { c.inst.opts.accent = col; });
      $('#mkSw1').style.background = col || ''; $('#mkHex1').textContent = col || getComputedStyle(root).getPropertyValue('--red').trim();
    }
    function setSource(src) {
      $$('.mk-dd-i', dd).forEach(i => i.classList.toggle('is-sel', i.dataset.src === src));
      $('#mkStatusTxt').textContent = src ? t('mk.src1') : t('mk.nosrc');
      $('#mkStatus').style.opacity = src ? '1' : '.55';
    }
    let sourceState = 'system';
    function setGain(g) { Object.values(cells).forEach(c => { c.inst.opts.gain = g; }); }
    function setSens(pct, label) { const sl = $('#mkSens'); $('b', sl).style.width = pct + '%'; $('i', sl).style.left = pct + '%'; $('#mkSensVal').textContent = label; }
    function resetMock() {
      Object.values(cells).forEach(c => { c.el.style.transition = 'none'; c.el.classList.remove('is-drag', 'is-new'); c.el.style.transform = ''; });
      order = DEFAULT.slice(); layoutStrip();
      void strip.offsetWidth;
      Object.values(cells).forEach(c => { c.el.style.transition = ''; });
      mk.classList.remove('is-hover');
      $$('.is-hot, .is-open, .is-hover, .is-press, .is-flash', mk).forEach(e => e.classList.remove('is-hot', 'is-open', 'is-hover', 'is-press', 'is-flash'));
      dd.classList.remove('is-open');
      setStyle('brutal'); setPalette('original'); setGain(1);
      const sl = $('#mkSens'); $$('b, i', sl).forEach(e => { e.style.transition = 'none'; }); setSens(58, '+4.0 dB'); void sl.offsetWidth; $$('b, i', sl).forEach(e => { e.style.transition = ''; });
      $$('.mk-item', list).forEach(i => i.classList.toggle('on', DEFAULT.includes(i.dataset.id)));
      const np = $('#mkNewPreset'); np.hidden = true; np.classList.remove('is-new');
      $('#mkToast').classList.remove('is-show');
      sourceState = 'system'; setSource('system');
      cursor.classList.remove('is-down', 'is-click');
    }

    /* Guiones de cada paso */
    const SCRIPTS = {
      async overview() {
        cam(FULL); hl(null);
        await moveTo(1120, 560, 900); await wait(300);
        await moveTo(620, 110, 1000); mk.classList.add('is-hover'); await wait(900);
        mk.classList.remove('is-hover'); await moveTo(900, 470, 900);
      },
      async strip() {
        cam([640, 0, 960, 196], [1200, 0, 400, 180]); hl(box(strip));
        await moveTo(820, 120, 900); mk.classList.add('is-hover'); await wait(650);
        const cz = $('#mkCustomize'); await moveToEl(cz); cz.classList.add('is-hot'); await wait(250); await click(cz); await wait(900);
      },
      async reorder() {
        const from = 'mascot', toIndex = 3, src = cells[from].el;
        const next = order.filter(id => id !== from); next.splice(toIndex, 0, from);
        const before = box(src), after = stripLefts(next)[from], dx = after[0] - before[0];
        cam([after[0] - 60, 0, before[0] + before[2] - after[0] + 120, 196], [after[0], 0, before[0] + before[2] - after[0], 180]);
        hl(box(strip));
        await moveTo(before[0] + before[2] / 2, 96, 900);
        cursor.classList.add('is-down'); src.classList.add('is-drag'); await wait(180);
        src.style.transform = `translate(${dx}px, -8px)`; place(before[0] + before[2] / 2 + dx, 88, 900); await wait(950);
        src.style.transition = 'none'; src.style.left = after[0] + 'px'; src.style.transform = 'translate(0, -8px)';
        order = next; layoutStrip(); void src.offsetWidth; src.style.transition = '';
        src.classList.remove('is-drag'); src.style.transform = ''; cursor.classList.remove('is-down');
        await wait(900);
      },
      async source() {
        const btn = $('#mkSource');
        setSource(null); sourceState = null;
        cam(union([0, 180, 760, 56], box(dd)), box(btn)); hl(box(btn));
        await moveToEl(btn); await click(btn); btn.classList.add('is-open'); dd.classList.add('is-open');
        await wait(450);
        const items = $$('.mk-dd-i', dd), pick = items[0];
        for (const it of [items[1], items[2], pick]) { items.forEach(i => i.classList.remove('is-hover')); await moveToEl(it, .32, .55, 420); it.classList.add('is-hover'); await wait(220); }
        hl(box(pick));
        await click(pick); setSource('system'); sourceState = 'system'; await wait(500);
        dd.classList.remove('is-open'); btn.classList.remove('is-open'); hl(box($('#mkStatus')));
        await moveToEl($('#mkStatus'), .5, 1.6, 700); await wait(900);
      },
      async themes() {
        const sec = $('#mkThemes');
        cam(union([0, 0, 900, 180], box(sec)), box(sec)); hl(box(sec));
        for (const id of ['vintage', 'arcade', 'cosmos', 'brutal']) {
          const chip = chipOf(themeChips, id); await moveToEl(chip); await click(chip); setStyle(id); await wait(id === 'brutal' ? 600 : 1000);
        }
      },
      async palette() {
        const sec = $('#mkPalette');
        cam(union([0, 0, 900, 180], box(sec)), box(sec)); hl(box(sec));
        for (const id of ['violet', 'ice', 'amber', 'original']) {
          const chip = chipOf(palChips, id); await moveToEl(chip); await click(chip); setPalette(id); await wait(id === 'original' ? 600 : 950);
        }
      },
      async modules() {
        const item = $('.mk-item[data-id="orbit"]', list);
        cam(box(list), box(item)); hl(box(item));
        await moveToEl($('.mk-cb', item), .5, .5); await click(item); item.classList.add('on', 'is-flash'); await wait(500);
        const c = ensureCell('orbit'); c.el.style.transition = 'none'; c.el.classList.add('is-new');
        order = DEFAULT.concat('orbit'); layoutStrip(); void c.el.offsetWidth; c.el.style.transition = '';
        const r = box(c.el);
        cam([700, 0, 900, 196], r); hl(r);
        await moveTo(r[0] + r[2] / 2, 210, 1000);
        c.el.classList.remove('is-new'); await wait(1500);
      },
      async sliders() {
        const sl = $('#mkSens'), knob = $('i', sl), track = $('.mk-track', sl);
        cam(box($('#mkSliders')), box(sl)); hl(box(sl));
        await moveToEl(knob, .5, .5); cursor.classList.add('is-down'); await wait(160);
        const tb = box(track), tx = tb[0] + tb[2] * .94, ty = tb[1] + 1;
        setSens(94, '+4.0 dB'); place(tx, ty, 1000);
        const t0 = performance.now();
        await new Promise(res => { const id = run; (function tick() { if (id !== run) return res(); const p = Math.min(1, (performance.now() - t0) / 1000); $('#mkSensVal').textContent = '+' + (4 + 7.5 * p).toFixed(1) + ' dB'; setGain(1 + 1.6 * p); p < 1 ? requestAnimationFrame(tick) : res(); })(); });
        cursor.classList.remove('is-down'); await wait(350);
        cam([0, 0, 1100, 196]); hl(box(strip)); await moveTo(560, 240, 900); await wait(1500);
      },
      async presets() {
        const bar = $('#mkPresets'), save = $('#mkSave'), ex = $('#mkExport'), toast = $('#mkToast'), np = $('#mkNewPreset');
        const b = box(bar);
        cam([b[0], b[1] - 40, 1120, b[3] + 60], box(save)); hl([b[0] + 8, b[1] + 8, 1080, b[3] - 16]);
        await moveToEl(save); await click(save); np.hidden = false; np.classList.add('is-new'); await wait(900);
        await moveToEl(ex); await click(ex);
        const eb = box(ex); toast.style.left = (eb[0] + eb[2] + 110) + 'px'; toast.style.right = 'auto';
        toast.classList.add('is-show'); await wait(1600);
      }
    };
    const DUR = { overview: 6200, strip: 6000, reorder: 5600, source: 7200, themes: 8000, palette: 8000, modules: 6600, sliders: 7000, presets: 6400 };

    /* Tarjetas y puntos numerados */
    const steps = I18N.STEPS;
    function buildCards() {
      cardsEl.innerHTML = steps.map((s, i) => {
        const [title, d] = s[I18N.lang];
        return `<button class="t-card" type="button" role="tab" aria-selected="false" data-i="${i}" style="--dur:${DUR[s.id]}ms"><span class="t-num">_${String(i).padStart(2, '0')}</span><span class="t-title">${title}</span><span class="t-desc">${d}</span><span class="t-prog"></span></button>`;
      }).join('');
      $$('.t-card', cardsEl).forEach(b => b.addEventListener('click', () => go(+b.dataset.i, true)));
      markCards();
    }
    function placeHots() {
      const anchor = {
        strip: () => [14, 140], reorder: () => { const b = box(cells.mascot.el); return [b[0] + 12, 140]; },
        source: () => { const b = box($('#mkSource')); return [b[0] + b[2] + 8, 196]; }, themes: () => { const b = box($('#mkThemes')); return [b[0] + 92, b[1] - 2]; },
        palette: () => { const b = box($('#mkPalette')); return [b[0] + 70, b[1] - 2]; }, modules: () => { const b = box(list); return [b[0] + 150, b[1] - 34]; },
        sliders: () => { const b = box($('#mkSliders')); return [b[0] + b[2] - 40, b[1] - 12]; }, presets: () => { const b = box($('#mkSave')); return [b[0] + 30, b[1] - 18]; }
      };
      hots.innerHTML = steps.map((s, i) => i ? `<button class="hot" type="button" data-i="${i}" aria-label="${s[I18N.lang][0]}">_${String(i).padStart(2, '0')}</button>` : '').join('');
      $$('.hot', hots).forEach(h => {
        const id = steps[+h.dataset.i].id, [x, y] = anchor[id]();
        h.style.left = x + 'px'; h.style.top = y + 'px';
        h.addEventListener('click', () => go(+h.dataset.i, true));
      });
      markCards();
    }
    let current = -1, auto = !reduce, visible = false, started = false, advanceTimer = 0;
    function markCards() {
      $$('.t-card', cardsEl).forEach(b => { const on = +b.dataset.i === current; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
      $$('.hot', hots).forEach(h => h.classList.toggle('is-active', +h.dataset.i === current));
    }
    function scrollCard() {
      const card = $(`.t-card[data-i="${current}"]`, cardsEl); if (!card) return;
      setTimeout(() => { cardsEl.scrollTo({ left: Math.max(0, card.offsetLeft - cardsEl.offsetLeft - 60), behavior: reduce ? 'auto' : 'smooth' }); }, 60);
    }
    function go(i, user) {
      if (user) { auto = false; tourEl.classList.remove('is-auto'); }
      clearTimeout(advanceTimer);
      current = (i + steps.length) % steps.length; run++;
      const card = $(`.t-card[data-i="${current}"]`, cardsEl);
      if (card) { card.classList.remove('is-active'); void card.offsetWidth; }
      markCards(); scrollCard();
      const id = steps[current].id, myRun = run, t0 = performance.now();
      resetMock();
      SCRIPTS[id]().catch(e => { if (e !== ABORT) console.error(e); }).then(() => {
        if (myRun !== run || !auto) return;
        const rest = Math.max(700, DUR[id] - (performance.now() - t0));
        advanceTimer = setTimeout(() => { if (myRun === run && auto && visible && !document.hidden) go(current + 1); }, rest);
      });
    }
    $('#tourPrev').addEventListener('click', () => go(current - 1, true));
    document.addEventListener('tour:go', e => setTimeout(() => go(+e.detail, true), 450));
    $('#tourNext').addEventListener('click', () => go(current + 1, true));
    cardsEl.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(current + (e.key === 'ArrowRight' ? 1 : -1), true); $(`.t-card[data-i="${current}"]`, cardsEl).focus(); }
    });
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible && !started) { started = true; if (auto) tourEl.classList.add('is-auto'); go(0); }
      else if (visible && auto && current >= 0) go(current);
    }, { threshold: .35 }).observe(view);
    new ResizeObserver(() => { if (current >= 0) { mk.style.transition = 'none'; go(current); requestAnimationFrame(() => { mk.style.transition = ''; }); } else cam(FULL); }).observe(view);
    buildCards(); placeHots(); cam(FULL); place(820, 620, 0);
    onLang(() => {
      buildPanel(); buildCards(); scrollCard();
      $('#mkStatusTxt').textContent = sourceState ? t('mk.src1') : t('mk.nosrc');
      requestAnimationFrame(placeHots);
    });
    document.fonts && document.fonts.ready.then(placeHots);
  }

  /* ---------- Preguntas ---------- */
  function faq() {
    const items = $$('.faq-item');
    items.forEach((item, i) => {
      const q = $('.faq-q', item), a = $('.faq-a', item);
      const qid = 'faq-q' + (i + 1), aid = 'faq-a' + (i + 1);
      q.id = qid; q.setAttribute('aria-controls', aid); a.id = aid; a.setAttribute('role', 'region'); a.setAttribute('aria-labelledby', qid);
      q.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach(o => { o.classList.remove('is-open'); $('.faq-q', o).setAttribute('aria-expanded', 'false'); });
        item.classList.toggle('is-open', open); q.setAttribute('aria-expanded', String(open));
      });
    });
    if (items[0]) $('.faq-q', items[0]).click();
  }

  /* ---------- Compra (factura) ---------- */
  function pricing() {
    const PLANS = { personal: { int: '20', dec: '00', keys: 1, code: 'PER' }, teams: { int: '49', dec: '99', keys: 3, code: 'TEA' } };
    const ticket = $('#ticket'), intEl = $('#tkInt'), perf = $('#tkPerf');
    let plan = 'personal';
    const sep = () => (I18N.lang === 'en' ? '.' : ',');
    const money = p => (+p.int).toString() + (p.dec === '00' ? '' : sep() + p.dec);

    intEl.innerHTML = PLANS.personal.int.split('').map(() => `<span class="dg"><span class="dg-col">${'0123456789'.split('').map(n => `<span>${n}</span>`).join('')}</span></span>`).join('');
    function digits(str, instant) {
      $$('.dg-col', intEl).forEach((col, i) => {
        if (instant) col.style.transition = 'none';
        col.style.transform = `translateY(${-0.86 * +str[i]}em)`;
        if (instant) { void col.offsetWidth; col.style.transition = ''; }
      });
      intEl.setAttribute('aria-label', str);
    }
    function barcode(seedStr) {
      const svg = $('#barcode'); let seed = 0; for (const ch of seedStr) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      let x = 0, out = '';
      while (x < 296) { const w = 1 + Math.floor(rnd() * 3), gap = 1 + Math.floor(rnd() * 2.4); out += `<rect x="${x}" y="0" width="${w}" height="40"/>`; x += w + gap; }
      svg.setAttribute('viewBox', `0 0 ${x} 40`); svg.setAttribute('fill', 'currentColor'); svg.innerHTML = out;
    }
    function dateStr() {
      const d = new Date(), m = I18N.js('months')[d.getMonth()];
      return String(d.getDate()).padStart(2, '0') + ' ' + m + ' ' + d.getFullYear();
    }
    function notch() { ticket.style.setProperty('--notch-y', (perf.offsetTop + .5) + 'px'); }
    function render(instant) {
      const p = PLANS[plan], yy = String(new Date().getFullYear()).slice(2);
      ticket.dataset.plan = plan;
      $$('input[name="plan"]', ticket).forEach(r => { r.checked = r.value === plan; });
      $$('#planCompare .pc').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.plan === plan)));
      digits(p.int, instant);
      $('#tkDec').textContent = sep() + p.dec + ' USD';
      $('#tkLine').textContent = p.int + sep() + p.dec;
      $('#tkKeys').textContent = p.keys;
      $('#tkPlanName').textContent = I18N.js('plan')[plan];
      $('#tkNo').textContent = `${I18N.js('invoiceNo')} HV-${yy}-${p.code}-0${p.keys}`;
      $('#tkDate').textContent = dateStr();
      $('#barcodeTxt').textContent = `HV-${p.code}-${p.keys}K-${new Date().getFullYear()}`;
      barcode(p.code + p.keys);
      $$('.pc-price').forEach((el, i) => { el.textContent = '$' + money(PLANS[i ? 'teams' : 'personal']); });
      $$('.tk-plan-price').forEach((el, i) => { el.textContent = '$' + money(PLANS[i ? 'teams' : 'personal']); });
      const buy = $('#buyBtn'), url = CONFIG.checkout[plan];
      buy.href = url || '#comprar'; buy.dataset.plan = plan;
      notch();
    }
    $$('input[name="plan"]', ticket).forEach(r => r.addEventListener('change', () => { plan = r.value; render(); }));
    $$('#planCompare .pc').forEach(b => b.addEventListener('click', () => { plan = b.dataset.plan; render(); }));
    $('#buyBtn').addEventListener('click', e => { if (!CONFIG.checkout[plan]) { e.preventDefault(); console.info('[Hyro] Configura CONFIG.checkout.' + plan + ' en assets/js/app.js'); } });
    render(true);
    onLang(() => render(true));
    addEventListener('resize', notch);
    document.fonts && document.fonts.ready.then(notch);
  }

  /* ---------- Newsletter ---------- */
  function newsletter() {
    const form = $('#newsForm'), input = $('#newsEmail'), msg = $('#newsMsg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = input.value.trim();
      msg.classList.remove('err');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = t('news.err'); msg.classList.add('err'); input.focus(); return; }
      try {
        if (CONFIG.newsletterEndpoint) {
          const r = await fetch(CONFIG.newsletterEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
          if (!r.ok) throw new Error(r.status);
        } else console.info('[Hyro] Configura CONFIG.newsletterEndpoint en assets/js/app.js');
        msg.textContent = t('news.ok'); form.reset();
      } catch (err) { msg.textContent = t('news.fail'); msg.classList.add('err'); }
    });
  }

  /* ---------- Títulos que suben al entrar ---------- */
  function reveals() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .25 });
    $$('.reveal').forEach(el => io.observe(el));
  }

  /* ---------- Mascota del footer ---------- */
  function footer() { const cv = $('#mascotCanvas'); if (cv) HV.create(cv, 'mascot', { style: 'night' }); }

  /* ---------- Tarjetas flotantes del inicio (visuales en vivo + leve paralaje) ---------- */
  function heroFloats() {
    const floats = $$('.hero-float'), hero = $('#inicio');
    floats.forEach(f => { const cv = $('canvas[data-vis]', f); if (cv) HV.create(cv, cv.dataset.vis); });
    if (reduce || !floats.length) return;
    let raf = 0, mx = 0, my = 0;
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => floats.forEach(f => {
        const d = +f.dataset.depth || 12;
        f.style.setProperty('--px', (mx * d).toFixed(1) + 'px'); f.style.setProperty('--py', (my * d * .7).toFixed(1) + 'px');
      }));
    });
    hero.addEventListener('pointerleave', () => floats.forEach(f => { f.style.setProperty('--px', '0px'); f.style.setProperty('--py', '0px'); }));
  }

  /* ---------- Las líneas de fondo empiezan después del inicio ---------- */
  function rails() {
    const hero = $('#inicio');
    const set = () => {
      const stage = $('#stage'), top = stage.getBoundingClientRect().top + scrollY;
      root.style.setProperty('--rails-top', Math.round(top - 140) + 'px');
      root.style.setProperty('--rails-fade', '260px');
    };
    set(); new ResizeObserver(set).observe(hero);
  }

  /* ---------- Textos con scroll infinito (ticker y cintas) ---------- */
  function marquees() {
    const fill = (el, items, star, times) => {
      if (!el || !items) return;
      const unit = items.map(txt => `<span>${txt}${star ? '<i class="star"></i>' : ''}</span>`).join('');
      const group = unit.repeat(times);
      el.innerHTML = group + group;
    };
    const render = () => {
      fill($('#tickerTrack'), I18N.js('ticker'), false, 3);
      $$('[data-ribbon]').forEach(el => fill(el, I18N.js(el.dataset.ribbon === 'a' ? 'ribbonA' : 'ribbonB'), false, 6));
    };
    render(); onLang(render);
  }

  /* ---------- Reseñas: dos filas en movimiento que se detienen al pasar el cursor ---------- */
  function reviews() {
    const track = $('#reviews .rv-track');
    const star = window.HI && HI.star ? `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${HI.star}</svg>` : '<i class="star"></i>';
    const card = (r, i) => {
      const en = I18N.lang === 'en', handle = (en ? '@user' : '@usuario') + String(i + 1).padStart(2, '0');
      return `<article class="rv"><div class="rv-stars" role="img" aria-label="5/5">${star.repeat(5)}</div><p class="rv-q">“${en ? r[5] : r[4]}”</p><div class="rv-who"><span class="rv-av">${r[0]}</span><span><b>${en ? r[2] : r[1]}</b><small>${handle}</small></span></div></article>`;
    };
    const render = () => {
      if (!track) return;
      const group = I18N.REVIEWS.map(card).join('');
      track.innerHTML = group + group;
    };
    render(); onLang(render);
  }

  /* ---------- Mascota que aparece por las orillas (izquierda / derecha) ---------- */
  function walker() {
    const cv = $('#walker'); if (!cv || reduce) return;
    const c = cv.getContext('2d'), img = new Image();
    img.src = '/landing/img/mascot-walk.webp';
    const CW = 176, CH = 184, LEG = 150, MID = 88, M = 14;
    const F = { side: 0, front: 1, calm: 2, heart: 3, listen: 4, danceL: 5, danceR: 6 };
    const rand = (a, b) => a + Math.random() * (b - a);
    let state = 'hidden', side = 'right', t0 = 0, stay = 4000, peek = false, mood = F.front, last = 0, phase = 0;
    let nextAt = performance.now() + 2400, coolUntil = 0, dancing = false;
    const vw = () => root.clientWidth;
    const restX = w => side === 'left' ? (peek ? -w * .38 : M) : (peek ? vw() - w * .62 : vw() - w - M);
    const outX = w => side === 'left' ? -w - 6 : vw() + 6;
    function appear(now, opts = {}) {
      if (state !== 'hidden' || now < coolUntil) return;
      side = side === 'left' ? 'right' : 'left';
      peek = false; // siempre se ve completa, sin quedar cortada por el borde
      mood = opts.dance ? F.danceL : [F.front, F.listen, F.heart][Math.floor(Math.random() * 3)];
      dancing = !!opts.dance; stay = rand(3600, 5600); state = 'enter'; t0 = now;
    }
    // Aparece al llegar a cada sección y, si no hay scroll, de vez en cuando.
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) appear(performance.now()); }), { threshold: .35 });
    ['funciones', 'accion', 'resenas', 'preguntas', 'comprar'].forEach(id => { const el = document.getElementById(id); el && io.observe(el); });
    new IntersectionObserver(es => { if (es[0].isIntersecting) { coolUntil = 0; if (state === 'hidden') appear(performance.now(), { dance: true }); else dancing = true; } else dancing = false; }, { threshold: .5 }).observe($('#footer'));

    function walk(w, h, dir) {
      const sc = h / CH, dw = CW * sc, ox = (w - dw) / 2, sn = Math.sin(phase), bob = -Math.abs(sn) * 3.2;
      c.save();
      if (dir < 0) { c.translate(w, 0); c.scale(-1, 1); }
      c.drawImage(img, 0, LEG, MID, CH - LEG, ox - sn * 3.5, LEG * sc - Math.max(0, -sn) * 3, MID * sc, (CH - LEG) * sc);
      c.drawImage(img, MID, LEG, CW - MID, CH - LEG, ox + MID * sc + sn * 3.5, LEG * sc - Math.max(0, sn) * 3, (CW - MID) * sc, (CH - LEG) * sc);
      c.translate(w / 2, LEG * sc); c.rotate(sn * .05); c.translate(-w / 2, -LEG * sc);
      c.drawImage(img, 0, 0, CW, LEG + 2, ox, bob, dw, (LEG + 2) * sc);
      c.restore();
    }
    function pose(w, h, f, now, hop = 0, flip = false) {
      const sc = h / CH, dw = CW * sc, ox = (w - dw) / 2, br = 1 + Math.sin(now / 420) * .012;
      c.save();
      if (flip) { c.translate(w, 0); c.scale(-1, 1); }
      c.translate(w / 2, h); c.scale(1, br); c.translate(-w / 2, -h);
      c.drawImage(img, f * CW, 0, CW, CH, ox, hop, dw, h);
      c.restore();
    }
    frameHooks.push(now => {
      if (!img.complete || !img.naturalWidth || root.classList.contains('is-intro')) return;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60; last = now;
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      if (state === 'hidden') {
        cv.style.visibility = 'hidden';
        if (now > nextAt) { appear(now); nextAt = now + rand(14000, 22000); }
        return;
      }
      cv.style.visibility = 'visible';
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const inward = side === 'left' ? 1 : -1, ENTER = 950, EXIT = 850;
      let x;
      if (state === 'enter') {
        const p = Math.min(1, (now - t0) / ENTER), e = 1 - Math.pow(1 - p, 2);
        x = outX(w) + (restX(w) - outX(w)) * e; phase += dt * 11; walk(w, h, inward);
        if (p >= 1) { state = 'idle'; t0 = now; }
      } else if (state === 'idle') {
        x = restX(w);
        const S = HA.S;
        if (dancing) pose(w, h, S.beatIndex % 2 ? F.danceL : F.danceR, now, -S.kick * 4);
        else {
          const blink = (now % 3100) < 150 && mood !== F.heart;
          pose(w, h, blink ? F.calm : mood, now, 0, peek && side === 'right');
        }
        if (!dancing && now - t0 > stay) { state = 'exit'; t0 = now; }
      } else {
        const p = Math.min(1, (now - t0) / EXIT), e = p * p;
        x = restX(w) + (outX(w) - restX(w)) * e; phase += dt * 11; walk(w, h, -inward);
        if (p >= 1) { state = 'hidden'; coolUntil = now + 5000; nextAt = Math.max(nextAt, now + rand(12000, 20000)); }
      }
      cv.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    });
  }

  /* ---------- Búsqueda en la web (modal) ---------- */
  function search() {
    const modal = $('#search'), input = $('#searchInput'), list = $('#searchResults'), btn = $('#searchBtn');
    if (!modal) return;
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esc = s => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    let items = [], results = [], active = 0, lastFocus = null;
    const label = id => clean(($(`.nav-links a[href="#${id}"]`) || {}).textContent) || id;
    function goTo(el) {
      if (!el) return;
      const y = el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(root).getPropertyValue('--nav-h')) || 60) - 24;
      scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
    }
    function build() {
      items = [];
      ['funciones', 'accion', 'resenas', 'preguntas', 'comprar'].forEach(id => {
        const s = document.getElementById(id); if (!s) return;
        const h2 = $('h2', s), title = h2 ? clean($$('.line', h2).map(l => l.textContent).join(' ') || h2.textContent) : '';
        items.push({ t: title || label(id), d: clean(($('.sec-lead', s) || {}).textContent), tag: label(id), go: () => goTo(s) });
      });
      $$('.bento .cell').forEach(cell => items.push({ t: clean($('h3', cell).textContent), d: clean($('.cell-copy p', cell).textContent), tag: label('funciones'), go: () => goTo(cell) }));
      I18N.STEPS.forEach((st, i) => { const [t, d] = st[I18N.lang]; items.push({ t, d, tag: label('accion'), go: () => { goTo($('#tour')); document.dispatchEvent(new CustomEvent('tour:go', { detail: i })); } }); });
      $$('.faq-item').forEach(it => items.push({ t: clean($('.faq-t', it).textContent), d: clean($('.faq-a p', it).textContent), tag: label('preguntas'), go: () => { goTo(it); const q = $('.faq-q', it); if (q.getAttribute('aria-expanded') !== 'true') q.click(); } }));
      [['personal', 'search.plan1'], ['teams', 'search.plan3']].forEach(([p, k]) => items.push({ t: I18N.js('plan')[p], d: I18N.js(k), tag: label('comprar'), go: () => { goTo($('#ticket')); const b = $(`#planCompare .pc[data-plan="${p}"]`); b && b.click(); } }));
      I18N.MODULES.forEach(m => items.push({ t: I18N.moduleName(m[0]), d: I18N.js('search.module'), tag: label('funciones'), go: () => { goTo($('.c-spectra')); document.dispatchEvent(new CustomEvent('spec:show', { detail: m[0] })); } }));
      items.forEach(it => { it.nt = norm(it.t); it.n = norm(it.t + ' ' + it.d + ' ' + it.tag); });
    }
    function mark(text, terms) {
      let html = esc(text);
      terms.forEach(term => { if (term.length < 2) return; const i = norm(text).indexOf(term); if (i >= 0) html = esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + term.length)) + '</mark>' + esc(text.slice(i + term.length)); });
      return html;
    }
    function render() {
      const q = norm(input.value.trim()), terms = q.split(/\s+/).filter(Boolean);
      if (!terms.length) results = items.slice(0, 5).map(it => ({ it, s: 0 }));
      else results = items.map(it => {
        if (!terms.every(t => it.n.includes(t))) return null;
        let s = 0; terms.forEach(t => { if (it.nt.startsWith(t)) s += 6; else if (it.nt.includes(t)) s += 4; else s += 1; });
        return { it, s };
      }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 8);
      active = Math.min(active, Math.max(0, results.length - 1));
      if (!results.length) { list.innerHTML = `<li class="sr-empty">${esc(I18N.js('search.empty'))} “${esc(input.value.trim())}”</li>`; return; }
      list.innerHTML = (terms.length ? '' : `<li class="sr-head" role="presentation">${esc(I18N.js('search.suggest'))}</li>`) + results.map((r, i) => {
        const d = r.it.d.length > 110 ? r.it.d.slice(0, 108) + '…' : r.it.d;
        return `<li class="sr-item${i === active ? ' is-active' : ''}" role="option" id="sr-${i}" aria-selected="${i === active}" data-i="${i}"><span class="sr-tag">${esc(r.it.tag)}</span><span class="sr-body"><b>${mark(r.it.t, terms)}</b>${d ? `<small>${esc(d)}</small>` : ''}</span><svg data-icon="enter" class="sr-enter"></svg></li>`;
      }).join('');
      icons(list);
      input.setAttribute('aria-activedescendant', 'sr-' + active);
    }
    function setActive(i) {
      if (!results.length) return;
      active = (i + results.length) % results.length;
      $$('.sr-item', list).forEach(li => { const on = +li.dataset.i === active; li.classList.toggle('is-active', on); li.setAttribute('aria-selected', String(on)); if (on) li.scrollIntoView({ block: 'nearest' }); });
      input.setAttribute('aria-activedescendant', 'sr-' + active);
    }
    function choose(i) { const r = results[i]; if (!r) return; close(); setTimeout(() => r.it.go(), 30); }
    function open() {
      if (!modal.hidden) return;
      lastFocus = document.activeElement; build(); active = 0; input.value = ''; render();
      modal.hidden = false; root.classList.add('is-search');
      requestAnimationFrame(() => { modal.classList.add('is-open'); input.focus(); });
    }
    function close() {
      if (modal.hidden) return;
      modal.classList.remove('is-open'); root.classList.remove('is-search');
      setTimeout(() => { modal.hidden = true; }, 180);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    btn.addEventListener('click', open);
    $$('[data-close]', modal).forEach(el => el.addEventListener('click', close));
    input.addEventListener('input', () => { active = 0; render(); });
    list.addEventListener('mousemove', e => { const li = e.target.closest('.sr-item'); if (li && +li.dataset.i !== active) setActive(+li.dataset.i); });
    list.addEventListener('click', e => { const li = e.target.closest('.sr-item'); if (li) choose(+li.dataset.i); });
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    });
    addEventListener('keydown', e => {
      const typing = /input|textarea|select/i.test((document.activeElement || {}).tagName || '');
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); modal.hidden ? open() : close(); }
    });
    onLang(() => { if (!modal.hidden) { build(); render(); } });
  }

  /* ---------- Iniciar sesión / Crear cuenta ---------- */
  function auth() {
    $$('[data-auth]').forEach(a => {
      const url = CONFIG.auth[a.dataset.auth];
      if (url) a.href = url;
      else a.addEventListener('click', e => { e.preventDefault(); console.info('[Hyro] Configura CONFIG.auth.' + a.dataset.auth + ' en assets/js/app.js'); });
    });
  }

  /* ---------- Arranque ----------
     Cada sección arranca por separado: si una falla en algún navegador, las demás y la intro siguen funcionando. */
  safe('idioma', () => { if (I18N.lang === 'en') I18N.apply('en'); else document.dispatchEvent(new CustomEvent('langchange', { detail: 'es' })); });
  safe('scrollMemory', scrollMemory);
  if (!safe('intro', intro)) endIntro();
  [nav, rails, marquees, reviews, auth, walker, search, heroFloats, hero, features, tour, faq, pricing, newsletter, reveals, footer].forEach(fn => safe(fn.name, fn));
  $('#langLabel').textContent = I18N.lang.toUpperCase();
  requestAnimationFrame(loop);
})();
