/* Hyro Visuals — lo poco que hace falta en el navegador.
   Cada parte arranca por separado: si una falla, las demás siguen funcionando. */
import { fetchAccount, fetchPlans, fetchReviews, subscribe, type Plan, type Review } from '../lib/supabase-rest';
// @ts-ignore: reproductor en JS puro (copia de Hyro visual/web-loops/site/hvl-player.js)
import { mountAll } from '../lib/hvl-player.js';
import { planName, priceParts, invoiceNo, barcodeText, ticketDate, barcodePath } from '../lib/ticket';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));
const root = document.documentElement;
const lang = root.lang === 'en' ? 'en' : 'es';
const safe = (name: string, fn: () => void) => {
  try { fn(); } catch (err) { console.error('[Hyro] ' + name, err); }
};

/* ---------- Navegación: barra al bajar, menú móvil, tema e idioma ---------- */
function nav() {
  const navEl = $('#nav')!;
  const onScroll = () => navEl.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = $('#menuBtn')!;
  const setMenu = (open: boolean) => { navEl.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open)); };
  menuBtn.addEventListener('click', () => setMenu(!navEl.classList.contains('is-open')));
  $$('#mobileMenu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  $('#themeBtn')!.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('hyro.theme', next); } catch {}
    document.dispatchEvent(new Event('theme:change'));
  });

  const langBtn = $('#langBtn')!, pop = $('#langPop')!;
  const setPop = (open: boolean) => { pop.hidden = !open; langBtn.setAttribute('aria-expanded', String(open)); };
  langBtn.addEventListener('click', (e) => { e.stopPropagation(); setPop(Boolean(pop.hidden)); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target as Node)) setPop(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setPop(false); });
  // el idioma elegido se recuerda (boot.js lleva a /en/ si corresponde); se conserva la sección actual
  $$<HTMLAnchorElement>('[data-lang]', pop).forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('hyro.lang', a.dataset.lang!);
      sessionStorage.setItem('hyro.keep', JSON.stringify(here()));
    } catch {}
    location.href = a.getAttribute('href')!;
  }));
}

/* ---------- Inicio: gráficas en vivo (grabaciones .hvl de la app); algunos recuadros se turnan ---------- */
function stage() {
  const st = $('#stage')!;
  const pools: Record<string, string[]> = JSON.parse(st.dataset.pools!);
  const names: Record<string, string> = JSON.parse(st.dataset.names!);
  const theme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
  // cada canvas reproduce la grabación de su gráfica y tema; al cambiar, el reproductor carga la nueva sin parpadeo
  const load = () => $$<HTMLCanvasElement>('canvas[data-loop]', st).forEach((c) => {
    const url = `/loops/${c.dataset.loop}-${theme()}.hvl`;
    if (c.dataset.hvl !== url) c.dataset.hvl = url;
  });
  load();
  document.addEventListener('theme:change', load);
  mountAll(st as unknown as Document);

  // cada 6 s, un recuadro (por turnos) pasa a la siguiente gráfica de su grupo; solo con el escenario a la vista
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(st);
  const slots = Object.keys(pools), step: Record<string, number> = {};
  let turn = 0;
  setInterval(() => {
    if (!visible || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const slot = slots[turn++ % slots.length];
    step[slot] = ((step[slot] ?? 0) + 1) % pools[slot].length;
    const id = pools[slot][step[slot]];
    $$(`[data-slot="${slot}"]`, st).forEach((tile) => {
      const c = $<HTMLCanvasElement>('canvas', tile)!;
      c.dataset.loop = id;
      c.setAttribute('aria-label', names[id]);
      $('.tile-name', tile)!.textContent = names[id];
    });
    load();
  }, 6000);
}

/* ---------- En acción: pasos del recorrido ---------- */
function tour() {
  const el = $('#tour')!, shot = $('#tourShot')!, focus = $('#tourFocus')!, img = $<HTMLImageElement>('#tourImg')!, video = $<HTMLVideoElement>('#tourVideo')!;
  // por paso: [captura, x, y, ancho, alto] (en % de la captura)
  const STEPS: [string, number, number, number, number][] = JSON.parse(el.dataset.steps!);
  const cards = $$('#tourCards .t-card');
  let cur = 0;

  // Secuencias: el cursor va al botón, «hace clic» y la captura siguiente se funde sobre la anterior.
  type Tile = { id: string; x: number; y: number; w: number; h: number };
  type Frame = { src: string; x: number; y: number; tiles?: Tile[]; live?: Record<string, string> };
  type Seq = { w: number; h: number; frames: Frame[] };
  const seqBox = $('#tourSeq')!, liveBox = $('.tour-live', seqBox)!;
  const [layerA, layerB] = $$<HTMLImageElement>('img', seqBox), cursor = $('.tour-cursor', seqBox)!;
  // gráficas de la franja en vivo: un canvas sobre cada recuadro de la captura, con la grabación de esa temática;
  // donde no hay grabación (demasiado pesada) se ve la captura quieta
  const liveCanvases = new Map<string, HTMLCanvasElement>();
  let liveMounted = false;
  const showLive = (f: Frame) => {
    for (const t of f.tiles ?? []) {
      const url = f.live?.[t.id];
      let c = liveCanvases.get(t.id);
      if (!c && url) {
        c = document.createElement('canvas');
        c.dataset.hvl = url;
        liveBox.append(c);
        liveCanvases.set(t.id, c);
      }
      if (!c) continue;
      Object.assign(c.style, { left: t.x + '%', top: t.y + '%', width: t.w + '%', height: t.h + '%' });
      c.hidden = !url;
      if (url && c.dataset.hvl !== url) c.dataset.hvl = url;
    }
    if (!liveMounted && liveCanvases.size) { liveMounted = true; mountAll(liveBox as unknown as Document); }
  };
  // las grabaciones de la temática siguiente, ya en caché cuando llegue el clic
  const warm = (f: Frame) => Object.values(f.live ?? {}).forEach((u) => fetch(u).catch(() => {}));
  const manifests = new Map<string, Promise<Seq>>();
  let run = 0;
  const wait = (ms: number, token: number) => new Promise<boolean>((r) => setTimeout(() => r(token === run), ms));
  const loaded = (im: HTMLImageElement, src: string) => new Promise<void>((r) => { if (im.src.endsWith(src) && im.complete) return r(); im.onload = im.onerror = () => r(); im.src = src; });
  const point = (f: { x: number; y: number }) => { cursor.style.left = f.x + '%'; cursor.style.top = f.y + '%'; };
  async function sequence(name: string) {
    const token = ++run;
    seqBox.hidden = !name;
    if (!name) return;
    if (!manifests.has(name)) manifests.set(name, fetch(`/tour/${name}.json`).then((r) => r.json()));
    const { frames } = await manifests.get(name)!;
    if (token !== run) return;
    let front = layerA, back = layerB, i = 0;
    await loaded(front, frames[0].src);
    front.classList.add('is-on'); back.classList.remove('is-on');
    point(frames[0]);
    showLive(frames[0]);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // cada cambio: el cursor va al botón → clic → la captura cambia de golpe (sin fundido, que se veía doble)
    // y la franja queda a la vista un rato antes del siguiente
    while (await wait(1700, token)) {
      const next = (i + 1) % frames.length, f = frames[next];
      const ready = loaded(back, f.src); // se descarga mientras el cursor viaja
      warm(f);
      point(f);
      if (!(await wait(950, token))) return;
      cursor.classList.add('is-click');
      await ready;
      if (token !== run) return;
      back.classList.add('is-on'); front.classList.remove('is-on');
      [front, back] = [back, front];
      showLive(f);
      i = next;
      setTimeout(() => cursor.classList.remove('is-click'), 220);
      new Image().src = frames[(next + 1) % frames.length].src; // la que sigue, ya en caché
    }
  }
  const go = (i: number) => {
    cur = (i + cards.length) % cards.length;
    const [name, x, y, w, h] = STEPS[cur];
    // un paso puede ser un video de la app («video:modo:16/9» → /tour/modo.mp4 en un recuadro 16:9,
    // con su portada mientras carga); las capturas usan la proporción por defecto del recuadro
    const [, clip = '', ratio = ''] = name.startsWith('video:') ? name.split(':') : [];
    shot.style.aspectRatio = ratio.replace('/', ' / ');
    // o una secuencia de capturas («seq:style-en» → /tour/style-en.json), con su primera captura de base
    const seq = name.startsWith('seq:') ? name.slice(4) : '';
    sequence(seq);
    const src = seq ? `/tour/${seq}-01.webp` : `/tour/${clip || name}.webp`;
    if (!img.src.endsWith(src)) img.src = src;
    video.hidden = !clip;
    if (clip) {
      if (!video.src.endsWith(`/tour/${clip}.mp4`)) video.src = `/tour/${clip}.mp4`;
      video.currentTime = 0;
      video.play().catch(() => {});
    } else video.pause();
    img.alt = $('.t-title', cards[cur])!.textContent ?? '';
    focus.hidden = w >= 100 && h >= 100;
    focus.style.cssText = `--x:${x}%;--y:${y}%;--w:${w}%;--h:${h}%`;
    cards.forEach((c, k) => c.setAttribute('aria-selected', String(k === cur)));
    const c = cards[cur], box = c.parentElement!;
    box.scrollTo({ left: c.offsetLeft - box.clientWidth / 2 + c.clientWidth / 2 });
  };
  cards.forEach((c) => c.addEventListener('click', () => go(+c.dataset.i!)));
  $('#tourPrev')!.addEventListener('click', () => go(cur - 1));
  $('#tourNext')!.addEventListener('click', () => go(cur + 1));
  document.addEventListener('tour:go', (e) => go((e as CustomEvent<number>).detail));
}

/* ---------- Gráficas: el salto desde la búsqueda ---------- */
function gallery() {
  const cards = $$('#gallery .gx-card');
  // lleva a la tarjeta y la marca un momento
  document.addEventListener('gallery:go', (e) => {
    const c = cards[(e as CustomEvent<number>).detail];
    c.scrollIntoView({ block: 'center' });
    c.classList.add('is-flash');
    setTimeout(() => c.classList.toggle('is-flash', false), 1600);
  });
}

/* ---------- Sesión del cliente (la guarda supabase-js en el login de la app) ---------- */
type Stored = { userId: string; token: string; expiresAt: number };
function storedSession(): Stored | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.+-auth-token$/.test(k)) continue;
      const s = JSON.parse(localStorage.getItem(k) || 'null');
      if (s?.refresh_token && s.user?.id) return { userId: s.user.id, token: s.access_token, expiresAt: Number(s.expires_at) || 0 };
    }
  } catch {}
  return null;
}

// comprar pide la sesión: sin ella se entra (o se crea la cuenta) y se vuelve al checkout con el mismo plan
const checkoutUrl = (planId: string) => {
  const to = `/checkout?plan=${encodeURIComponent(planId)}`;
  return storedSession() ? to : `/login?next=${encodeURIComponent(to)}`;
};

/* «Mi cuenta» en la barra: la foto del cliente (la última guardada al instante y luego la de Supabase) y, si es
   administrador, el enlace lleva a su panel. Mismas claves que la app (src/lib/landingSession.ts). */
function account() {
  const s = storedSession();
  const link = $<HTMLAnchorElement>('.nav-account');
  const photo = link ? $<HTMLImageElement>('img', link) : null;
  if (!s || !link || !photo) return;
  const show = (url: string | null) => {
    const ok = Boolean(url && /^https:\/\//.test(url));
    if (ok) photo.src = url!; else photo.removeAttribute('src');
    photo.hidden = !ok;
    link.classList.toggle('has-photo', ok);
  };
  const toAdmin = (isAdmin: boolean) => {
    const href = isAdmin ? '/admin' : '/cuenta/biblioteca';
    $$<HTMLAnchorElement>('.nav-account, .mm-account').forEach((a) => a.setAttribute('href', href));
  };
  photo.addEventListener('error', () => show(null));
  try {
    const cached = JSON.parse(localStorage.getItem('hyro.profile') || 'null');
    if (cached?.id === s.userId) show(cached.avatarUrl);
    toAdmin(localStorage.getItem('hyro.admin') === s.userId);
  } catch {}
  // con el token vencido no se consulta: la app lo renueva al entrar y deja la foto al día
  if (!s.token || s.expiresAt * 1000 < Date.now()) return;
  fetchAccount(s.userId, s.token).then((a) => {
    show(a.avatarUrl);
    try {
      localStorage.setItem('hyro.profile', JSON.stringify({ id: s.userId, name: a.name, avatarUrl: a.avatarUrl }));
      if (a.isAdmin !== null) {
        toAdmin(a.isAdmin);
        if (a.isAdmin) localStorage.setItem('hyro.admin', s.userId); else localStorage.removeItem('hyro.admin');
      }
    } catch {}
  }).catch(() => {});
}

/* ---------- Compra: plan elegido en el ticket ---------- */
function buy() {
  const fs = $<HTMLFieldSetElement>('#buyPlans')!;
  const t = JSON.parse(fs.dataset.i18n!) as { names: Record<string, string>; keyShort: string[]; months: string[]; invoice: string; preparing: string };
  let plans: Plan[] = JSON.parse(fs.dataset.plans!);
  const btn = $<HTMLAnchorElement>('#buyBtn')!, label = $('.tk-cta-label', btn)!;
  const ticket = $('#ticket')!;

  const render = () => {
    const id = $<HTMLInputElement>('input[name="plan"]:checked', fs)?.value;
    const p = plans.find((x) => x.id === id) || plans[0];
    const price = priceParts(p.price);
    $('#tkNo')!.textContent = `${t.invoice} ${invoiceNo(p)}`;
    $('#tkPlan')!.textContent = planName(p, t.names);
    $('#tkKeys')!.textContent = String(p.keys).padStart(2, '0');
    $('#tkDate')!.textContent = ticketDate(t.months);
    $('#tkInt')!.textContent = price.int;
    $('#tkDec')!.textContent = '.' + price.dec;
    const code = barcodeText(p);
    $('#barcode')!.setAttribute('d', barcodePath(code));
    $('#barcodeTxt')!.textContent = code;
    btn.href = checkoutUrl(p.id);
    notch();
  };
  // muescas del ticket a la altura del corte
  const notch = () => {
    const perf = $('#tkPerf')!;
    ticket.style.setProperty('--notch-y', `${perf.offsetTop + perf.offsetHeight / 2}px`);
  };
  const buildPlans = () => {
    const tpl = $('.bp', fs)!;
    const current = $<HTMLInputElement>('input[name="plan"]:checked', fs)?.value;
    const nodes = plans.map((p, i) => {
      const n = tpl.cloneNode(true) as HTMLElement;
      const input = $<HTMLInputElement>('input', n)!;
      input.value = p.id;
      input.checked = current ? p.id === current : i === 0;
      $('.bp-keys', n)!.textContent = `${p.keys} ${t.keyShort[p.keys === 1 ? 0 : 1]}`;
      $('.bp-name', n)!.textContent = planName(p, t.names);
      const pp = priceParts(p.price);
      $('.bp-price', n)!.textContent = `$${pp.int}.${pp.dec}`;
      return n;
    });
    fs.replaceChildren(...nodes);
    if (!$('input:checked', fs)) $<HTMLInputElement>('input', fs)!.checked = true;
  };

  fs.addEventListener('change', render);
  addEventListener('resize', notch);
  document.fonts?.ready.then(notch);
  render();

  // precios del panel admin, por si cambiaron después de publicar
  fetchPlans().then((next) => {
    if (!next.length || JSON.stringify(next) === JSON.stringify(plans)) return;
    plans = next;
    buildPlans();
    render();
  }).catch((e) => console.warn('[Hyro] precios', e.message));

  btn.addEventListener('click', (e) => {
    if (btn.classList.contains('is-loading')) { e.preventDefault(); return; }
    btn.dataset.label = label.textContent ?? '';
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    label.textContent = t.preparing;
  });
  // al volver con «atrás», el botón vuelve a su estado normal
  addEventListener('pageshow', () => {
    if (!btn.classList.contains('is-loading')) return;
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    label.textContent = btn.dataset.label ?? '';
  });
}

/* ---------- Reseñas: se refrescan desde Supabase ---------- */
function reviews() {
  const box = $('#reviews')!;
  const star = $<HTMLTemplateElement>('#starTpl')!.content.firstElementChild!;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const initials = (n: string | null) => (n || 'H').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const card = (r: Review) => {
    const fig = document.createElement('figure');
    fig.className = 'rv';
    const stars = document.createElement('div');
    stars.className = 'rv-stars';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', `${r.rating}/5`);
    for (let n = 1; n <= 5; n++) {
      const s = star.cloneNode(true) as SVGElement;
      if (n > r.rating) s.classList.add('off');
      stars.append(s);
    }
    fig.append(stars);
    fig.insertAdjacentHTML('beforeend',
      `<blockquote class="rv-q">“${esc(r.text)}”</blockquote><figcaption class="rv-who"><span class="rv-av">${r.avatarUrl ? `<img src="${esc(r.avatarUrl)}" alt="" width="38" height="38" loading="lazy">` : esc(initials(r.name))}</span><span><b>${esc(r.name || box.dataset.anon!)}</b><small>${esc(box.dataset.verified!)}</small></span></figcaption>`);
    return fig;
  };
  fetchReviews().then((list) => {
    if (!list.length) { box.innerHTML = `<p class="rv-empty">${esc(box.dataset.empty!)}</p>`; return; }
    box.replaceChildren(...list.map(card));
  }).catch((e) => console.warn('[Hyro] reseñas', e.message));
}

/* ---------- Newsletter ---------- */
function newsletter() {
  const form = $<HTMLFormElement>('#newsForm')!, input = $<HTMLInputElement>('#newsEmail')!, consent = $<HTMLInputElement>('#newsConsent')!;
  const msg = $('#newsMsg')!, btn = $<HTMLButtonElement>('button[type="submit"]', form)!;
  const m = JSON.parse(form.dataset.msg!) as Record<'ok' | 'err' | 'consent' | 'fail', string>;
  const say = (text: string, err = false) => { msg.textContent = text; msg.classList.toggle('err', err); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say(m.err, true); input.focus(); return; }
    if (!consent.checked) { say(m.consent, true); consent.focus(); return; }
    btn.disabled = true;
    try {
      await subscribe(email, lang);
      say(m.ok);
      form.reset();
    } catch {
      say(m.fail, true);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------- Búsqueda ---------- */
function search() {
  const box = $('#search')!, input = $<HTMLInputElement>('#searchInput')!, list = $('#searchResults')!;
  type Entry = { t: string; s: string; tag: string; href: string; i?: number };
  const index: Entry[] = JSON.parse(box.dataset.index!);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  let results: Entry[] = [];
  let active = 0;

  const open = () => { box.hidden = false; root.classList.add('is-search'); input.value = ''; draw(); input.focus(); };
  const close = () => { box.hidden = true; root.classList.remove('is-search'); };
  const pick = (r: Entry) => {
    close();
    location.hash = r.href;
    if (r.i !== undefined) document.dispatchEvent(new CustomEvent(r.href === '#accion' ? 'tour:go' : 'gallery:go', { detail: r.i }));
  };
  const mark = (text: string, q: string) => {
    if (!q) return esc(text);
    const k = norm(text).indexOf(q);
    return k < 0 ? esc(text) : esc(text.slice(0, k)) + '<mark>' + esc(text.slice(k, k + q.length)) + '</mark>' + esc(text.slice(k + q.length));
  };
  function draw() {
    const q = norm(input.value.trim());
    results = q ? index.filter((r) => norm(r.t + ' ' + r.s).includes(q)).slice(0, 12) : index.filter((r) => r.tag === index[0].tag);
    active = 0;
    if (!results.length) { list.innerHTML = `<li class="sr-empty">${esc(box.dataset.empty!)} «${esc(input.value)}»</li>`; return; }
    list.innerHTML = (q ? '' : `<li class="sr-head">${esc(box.dataset.suggest!)}</li>`) +
      results.map((r, k) => `<li class="sr-item${k === 0 ? ' is-active' : ''}" role="option" data-k="${k}"><b>${mark(r.t, q)}</b><small>${esc(r.tag)} · ${esc(r.s)}</small></li>`).join('');
  }
  const setActive = (k: number) => {
    active = (k + results.length) % results.length;
    $$('.sr-item', list).forEach((li, n) => li.classList.toggle('is-active', n === active));
    $$('.sr-item', list)[active]?.scrollIntoView({ block: 'nearest' });
  };

  $('#searchBtn')!.addEventListener('click', open);
  $$('[data-close]', box).forEach((b) => b.addEventListener('click', close));
  input.addEventListener('input', draw);
  list.addEventListener('click', (e) => {
    const li = (e.target as Element).closest<HTMLElement>('.sr-item');
    if (li) pick(results[+li.dataset.k!]);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && box.hidden && !(e.target as Element).closest('input, textarea'))) { e.preventDefault(); open(); return; }
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]); }
  });
}

/* ---------- Cambio de idioma: la otra página abre donde estabas ---------- */
// la sección que se está viendo (la última cuyo borde de arriba ya pasó bajo la barra), cuánto se bajó dentro
// de ella y el paso de «Así funciona»
function here() {
  const top = scrollY + ($('#nav')?.offsetHeight ?? 0) + 1;
  const marks = $$<HTMLElement>('main section[id], #funciones, footer[id]').filter((s) => s.offsetTop <= top);
  const at = marks.sort((a, b) => b.offsetTop - a.offsetTop)[0];
  const step = $$('#tourCards .t-card').findIndex((c) => c.getAttribute('aria-selected') === 'true');
  return at ? { id: at.id, offset: scrollY - at.offsetTop, step } : { id: '', offset: scrollY, step };
}
function keepPlace() {
  let saved: { id: string; offset: number; step: number } | null = null;
  try { saved = JSON.parse(sessionStorage.getItem('hyro.keep') || 'null'); sessionStorage.removeItem('hyro.keep'); } catch {}
  if (!saved) return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (saved.step > 0) document.dispatchEvent(new CustomEvent('tour:go', { detail: saved.step }));
  const go = () => {
    const at = saved!.id ? document.getElementById(saved!.id) : null;
    scrollTo({ top: (at ? at.offsetTop : 0) + saved!.offset, behavior: 'instant' });
  };
  go();
  // otra vez cuando terminan de cargar fuentes e imágenes, por si algo cambió de alto
  document.fonts?.ready.then(go);
  addEventListener('load', go, { once: true });
}

safe('nav', nav);
safe('account', account);
safe('stage', stage);
safe('tour', tour);
safe('gallery', gallery);
safe('buy', buy);
safe('reviews', reviews);
safe('newsletter', newsletter);
safe('search', search);
safe('keepPlace', keepPlace);
