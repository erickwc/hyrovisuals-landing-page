/* Hyro Visuals — visuales en Canvas 2D inspirados en los módulos de la app.
   Cada visual dibuja en unidades CSS; el gestor ajusta la resolución real
   (DPR y zoom de cámara) y solo pinta lo que está en pantalla. */
(function () {
  'use strict';
  const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const fract = x => x - Math.floor(x);
  const rgbaCache = new Map();
  function rgba(hex, a) {
    const key = hex + a;
    let v = rgbaCache.get(key);
    if (!v) {
      const n = parseInt(hex.slice(1), 16);
      v = `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
      if (rgbaCache.size > 4000) rgbaCache.clear();
      rgbaCache.set(key, v);
    }
    return v;
  }
  function mix(a, b, t) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const ch = s => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
    return [ch(16), ch(8), ch(0)];
  }
  function label(c, text, x, y, color, align = 'left', size = 10, weight = 400) {
    c.font = `${weight} ${size}px ${MONO}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.fillText(text, x, y);
  }
  function vnoise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (a, b) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'es');

  const MASCOT = new Image();
  MASCOT.decoding = 'async';
  MASCOT.src = '/landing/img/mascot-atlas.webp';

  /* ---------- Fondos y marcos por temática ---------- */
  function chromeBack(c, w, h, p, style, A) {
    c.fillStyle = p.bg; c.fillRect(0, 0, w, h);
    const t = A.S.t;
    if (style === 'brutal') {
      c.beginPath();
      for (let x = 8.5; x < w; x += 32) { c.moveTo(x, 0); c.lineTo(x, h); }
      for (let y = 8.5; y < h; y += 32) { c.moveTo(0, y); c.lineTo(w, y); }
      c.strokeStyle = rgba(p.ink, .055); c.lineWidth = 1; c.stroke();
    } else if (style === 'blueprint') {
      c.beginPath();
      for (let x = .5; x < w; x += 20) { c.moveTo(x, 0); c.lineTo(x, h); }
      for (let y = .5; y < h; y += 20) { c.moveTo(0, y); c.lineTo(w, y); }
      c.strokeStyle = rgba(p.accent, .1); c.stroke();
      c.strokeStyle = rgba(p.accent, .55); c.beginPath();
      for (const x of [7, w - 7]) for (const y of [7, h - 7]) { c.moveTo(x - 4, y); c.lineTo(x + 4, y); c.moveTo(x, y - 4); c.lineTo(x, y + 4); }
      c.stroke();
    } else if (style === 'vintage') {
      c.fillStyle = rgba(p.ink, .06);
      for (let i = 0; i < Math.min(240, w * h / 160); i++) c.fillRect((i * 73.73) % w, (i * 39.41) % h, i % 3 ? 1 : 2, .8);
    } else if (style === 'cosmos') {
      for (let i = 0; i < 46; i++) {
        const x = fract(i * .6180339 + t * .004 * (1 + i % 3)) * w, y = fract(i * .4142 + i * i * .0013) * h;
        c.fillStyle = rgba(p.ink, .25 + .5 * fract(i * .37 + t * .3 * (i % 2 ? 1 : -1)) * .6);
        c.fillRect(x, y, i % 7 ? 1 : 2, i % 7 ? 1 : 2);
      }
    } else if (style === 'crt') {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * .7);
      g.addColorStop(0, rgba(p.accent, .16)); g.addColorStop(1, rgba(p.accent, 0));
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    } else if (style === 'arcade') {
      c.fillStyle = rgba(p.accent, .14);
      for (let y = 3; y < h; y += 9) for (let x = 3; x < w; x += 9) if (((x + y) / 9 | 0) % 2 === 0) c.fillRect(x, y, 1, 1);
    }
  }
  function chromeFront(c, w, h, p, style, A) {
    if (style === 'brutal') {
      c.fillStyle = p.ink; c.fillRect(4, 1, Math.min(28, w * .12), 2);
      c.fillStyle = p.accent; c.fillRect(w - 13, 4, 9, 9);
      const e = A.S.level;
      for (let i = 0; i < 6; i++) if (e > i * .14) {
        c.fillStyle = i % 3 ? rgba(p.ink, .2) : rgba(p.accent, .5);
        const s = 3 + i % 3; c.fillRect((i * 59 + 17) % w, (i * 43 + 22) % h, s, s);
      }
    } else if (style === 'crt') {
      c.fillStyle = 'rgba(0,0,0,.22)';
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    } else if (style === 'vintage') {
      c.strokeStyle = rgba(p.ink, .28); c.lineWidth = 1; c.strokeRect(4.5, 4.5, w - 9, h - 9);
    } else if (style === 'blueprint') {
      label(c, '±0.5', w - 8, h - 7, rgba(p.accent, .6), 'right', 9);
    }
  }

  /* ---------- Visuales ---------- */
  const V = {};

  V.spectrum = function (c, w, h, p, st, A) {
    const L = w < 220 ? 26 : 34, R = 8, T = 18, B = h > 80 ? 18 : 6;
    const pw = w - L - R, ph = h - T - B;
    const dbs = [-12, -36, -60, -84];
    c.beginPath();
    for (const db of dbs) { const y = Math.round(T + ph * (-db / 96)) + .5; c.moveTo(L, y); c.lineTo(w - R, y); }
    c.strokeStyle = rgba(p.ink, .08); c.lineWidth = 1; c.stroke();
    if (h > 80 && w > 150) {
      for (const db of dbs) label(c, String(db), L - 6, Math.round(T + ph * (-db / 96)) + 3, p.dim, 'right');
      for (const [f, lab] of [[20, '20'], [200, '200'], [2000, '2k'], [20000, '20k']]) {
        const x = L + pw * Math.log10(f / 20) / 3;
        label(c, lab, clamp(x, L + 8, w - R - 12), h - 4, p.dim, 'center');
      }
    }
    const N = Math.max(24, Math.min(110, Math.round(pw / 7)));
    const pts = new Float32Array(N + 1);
    for (let j = 0; j <= N; j++) {
      const fi = j / N * (A.BANDS - 1), i0 = Math.floor(fi), fr = fi - i0;
      const v = A.spec[i0] * (1 - fr) + A.spec[Math.min(A.BANDS - 1, i0 + 1)] * fr;
      pts[j] = T + ph * (1 - v);
    }
    st.tick = (st.tick || 0) + 1; st.trails = st.trails || [];
    if (st.tick % 5 === 0) { st.trails.unshift(pts); if (st.trails.length > 6) st.trails.pop(); }
    const xAt = j => L + pw * j / N;
    const path = arr => {
      c.beginPath(); c.moveTo(xAt(0), arr[0]);
      for (let j = 1; j < N; j++) c.quadraticCurveTo(xAt(j), arr[j], (xAt(j) + xAt(j + 1)) / 2, (arr[j] + arr[j + 1]) / 2);
      c.lineTo(xAt(N), arr[N]);
    };
    c.lineJoin = 'round';
    for (let k = st.trails.length - 1; k >= 0; k--) {
      const tr = st.trails[k]; if (tr.length !== N + 1) continue;
      path(tr); c.strokeStyle = rgba(p.accent, .05 + .07 * (6 - k) / 6); c.lineWidth = 1; c.stroke();
    }
    path(pts); c.lineTo(xAt(N), T + ph); c.lineTo(xAt(0), T + ph); c.closePath();
    const g = c.createLinearGradient(0, T, 0, T + ph);
    g.addColorStop(0, rgba(p.accent, .34)); g.addColorStop(1, rgba(p.accent, 0));
    c.fillStyle = g; c.fill();
    path(pts); c.strokeStyle = p.accent; c.lineWidth = 1.8; c.stroke();
  };

  V.pixels = function (c, w, h, p, st, A, k) {
    const S = A.S, cx = w / 2, cy = h / 2, R = Math.min(w, h) * .44, step = Math.max(4.5, R / 10.5), t = S.t;
    const e = Math.min(1.8, S.level * k), sq = step * .74;
    const hot = [], mid = [], low = [];
    for (let y = -R; y <= R; y += step) for (let x = -R; x <= R; x += step) {
      const d = Math.hypot(x, y); if (d > R) continue;
      const n = vnoise2(x / (step * 3.1) + t * .5, y / (step * 3.1) - t * .35);
      const ring = Math.sin(d / R * 9 - t * 5) * .5 + .5;
      const v = n * .6 + ring * .27 * e + S.kick * .3 * (1 - d / R) * Math.min(2, k);
      const px = Math.round(cx + x - sq / 2), py = Math.round(cy + y - sq / 2);
      (v > .7 ? hot : v > .43 ? mid : low).push(px, py);
    }
    c.fillStyle = rgba(p.ink, .24); c.beginPath();
    for (let i = 0; i < low.length; i += 2) c.rect(low[i] + sq / 2 - .8, low[i + 1] + sq / 2 - .8, 1.6, 1.6);
    c.fill();
    c.fillStyle = rgba(p.ink, .82); c.beginPath(); const s2 = sq * .5;
    for (let i = 0; i < mid.length; i += 2) c.rect(mid[i] + sq / 4, mid[i + 1] + sq / 4, s2, s2);
    c.fill();
    c.fillStyle = p.accent; c.beginPath();
    for (let i = 0; i < hot.length; i += 2) c.rect(hot[i], hot[i + 1], sq, sq);
    c.fill();
  };

  V.mesh = function (c, w, h, p, st, A, k) {
    const S = A.S; st.a = (st.a || 0) + S.dt * (.35 + .9 * S.level * k);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .36 * (1 + .07 * S.kick * Math.min(2, k));
    const ca = Math.cos(st.a), sa = Math.sin(st.a), ct = Math.cos(.42), stl = Math.sin(.42);
    const P = (th, ph) => {
      const def = 1 + .1 * k * Math.sin(3 * ph + S.t * 2) * S.mid + .05 * k * S.kick * Math.sin(4 * th + S.t);
      const x = Math.cos(th) * Math.cos(ph) * R * def, y = Math.sin(th) * R * def, z = Math.cos(th) * Math.sin(ph) * R * def;
      const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
      return [cx + x1, cy + y * ct - z1 * stl, y * stl + z1 * ct];
    };
    const front = [], back = [];
    const line = pts => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; (a[2] + b[2] < 0 ? front : back).push(a[0], a[1], b[0], b[1]); } };
    for (let i = 1; i < 8; i++) { const th = -Math.PI / 2 + i * Math.PI / 8, pts = []; for (let j = 0; j <= 32; j++) pts.push(P(th, j / 32 * TAU)); line(pts); }
    for (let i = 0; i < 12; i++) { const ph = i / 12 * TAU, pts = []; for (let j = 0; j <= 16; j++) pts.push(P(-Math.PI / 2 + j / 16 * Math.PI, ph)); line(pts); }
    const draw = (arr, style, lw) => { c.beginPath(); for (let i = 0; i < arr.length; i += 4) { c.moveTo(arr[i], arr[i + 1]); c.lineTo(arr[i + 2], arr[i + 3]); } c.strokeStyle = style; c.lineWidth = lw; c.stroke(); };
    draw(back, rgba(p.accent, .2), 1); draw(front, p.accent, 1.15);
  };

  V.mascot = function (c, w, h, p, st, A) {
    if (!MASCOT.complete || !MASCOT.naturalWidth) return;
    const S = A.S;
    const seqs = [[8, 9, 4, 9, 8, 3, 8, 9], [4, 5, 1, 5, 12, 1], [10, 11, 13, 14, 10, 11, 13, 9]];
    const seq = seqs[S.section];
    if (S.onBeat || st.f === undefined) st.f = ((st.f || 0) + 1) % seq.length;
    const idx = seq[st.f % seq.length], cs = MASCOT.naturalWidth / 4;
    const size = Math.min(w * .9, h * .9), bob = -S.kick * size * .045 * (S.section === 1 ? .3 : 1);
    c.imageSmoothingEnabled = true;
    c.drawImage(MASCOT, (idx % 4) * cs, Math.floor(idx / 4) * cs, cs, cs, w / 2 - size / 2, h / 2 - size / 2 + bob + size * .03, size, size);
    st.n = (st.n || 0) + S.dt;
    if (S.onBeat && S.beatIndex % 4 === 0) st.n = 0;
    if (st.n < 1.2) {
      const a = 1 - st.n / 1.2, y = h * .26 - st.n * 18;
      c.fillStyle = rgba(p.accent, a); c.font = `${Math.round(size * .14)}px ${MONO}`; c.textAlign = 'center';
      c.fillText('♪', w / 2 + size * .36, y);
    }
  };

  V.phase = function (c, w, h, p, st, A) {
    const S = A.S, cx = w / 2, top = 20, x0 = 16, x1 = w - 16;
    c.strokeStyle = rgba(p.ink, .3); c.lineWidth = 1; c.beginPath(); c.moveTo(x0, top + .5); c.lineTo(x1, top + .5);
    for (const x of [x0, cx, x1]) { c.moveTo(Math.round(x) + .5, top - 3); c.lineTo(Math.round(x) + .5, top + 4); }
    c.stroke();
    const mx = x0 + (x1 - x0) * (S.corr + 1) / 2;
    c.fillStyle = p.accent; c.fillRect(mx - 2, top - 4, 4, 9);
    if (w > 110) {
      label(c, (S.corr >= 0 ? '+' : '') + S.corr.toFixed(2), clamp(mx, 34, w - 34), top - 8, p.accent, 'center');
      label(c, '-1', x0, top + 15, p.dim, 'left', 9); label(c, '+1', x1, top + 15, p.dim, 'right', 9);
    }
    const cy = h * .57, r = Math.min(w * .34, h * .28);
    c.strokeStyle = rgba(p.ink, .22); c.beginPath(); c.arc(cx, cy, r, 0, TAU);
    c.moveTo(cx - r * .7, cy - r * .7); c.lineTo(cx + r * .7, cy + r * .7); c.moveTo(cx + r * .7, cy - r * .7); c.lineTo(cx - r * .7, cy + r * .7); c.stroke();
    c.beginPath();
    for (let i = 0; i < A.WAVE; i += 2) {
      const l = A.wave[i], rr = A.waveR[i], m = (l + rr) * .5, s = (l - rr) * .5;
      const x = cx + s * r * 2.4, y = cy - m * r * .95;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle = rgba(p.accent, .92); c.lineWidth = 1.1; c.stroke();
    if (h > 90 && w > 140) {
      label(c, 'M ' + S.lufsM.toFixed(1), 10, h - 8, p.ink, 'left', 9.5);
      label(c, 'S ' + (S.lufsS - 12.5).toFixed(1), w - 10, h - 8, p.accent, 'right', 9.5);
    }
  };

  V.waves3d = function (c, w, h, p, st, A, k) {
    const rows = 16, cols = 56; st.rows = st.rows || []; st.tk = (st.tk || 0) + 1;
    if (st.tk % 2 === 0 || !st.rows.length) {
      const r = new Float32Array(cols);
      for (let j = 0; j < cols; j++) r[j] = A.spec[Math.floor(j / (cols - 1) * (A.BANDS - 1) * .85)];
      st.rows.unshift(r); if (st.rows.length > rows) st.rows.pop();
    }
    const top = h * .14, bottom = h * .9, gain = Math.min(1.9, .65 + .55 * k);
    for (let i = st.rows.length - 1; i >= 0; i--) {
      const row = st.rows[i], depth = i / (rows - 1), y0 = bottom - (bottom - top) * depth, sx = 1 - depth * .32, amp = h * .5 * (1 - depth * .55) * gain;
      c.beginPath();
      for (let j = 0; j < cols; j++) {
        const x = w / 2 + (j / (cols - 1) - .5) * w * 1.04 * sx, y = y0 - Math.max(0, row[j] - .3) * amp;
        j ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.lineTo(w / 2 + .52 * w * sx, y0 + 3); c.lineTo(w / 2 - .52 * w * sx, y0 + 3); c.closePath();
      c.fillStyle = p.bg; c.fill();
      c.strokeStyle = i === 0 ? p.accent : rgba(p.accent, .1 + .55 * (1 - depth));
      c.lineWidth = i === 0 ? 1.8 : 1; c.stroke();
    }
  };

  V.dynamics = function (c, w, h, p, st, A) {
    const S = A.S; st.h = st.h || []; st.tk = (st.tk || 0) + 1;
    if (st.tk % 2 === 0) { st.h.push(S.rms); if (st.h.length > 110) st.h.shift(); }
    label(c, 'TRUE PEAK', 10, 18, p.ink, 'left', 9.5, 600);
    const v = S.tpHold, txt = (v < 0 ? '-' : '') + Math.abs(v).toFixed(1);
    const fs = Math.max(16, Math.min(h * .33, w * .22)), base = 24 + fs * .9;
    c.font = `500 ${fs}px ${MONO}`; c.fillStyle = p.accent; c.textAlign = 'left'; c.fillText(txt, 9, base);
    label(c, 'dBTP', w - 10, base, p.dim, 'right', 9.5);
    c.fillStyle = rgba(p.ink, .12); c.fillRect(10, base + 8, w - 20, 1);
    if (h > 110) label(c, 'RMS ' + S.rms.toFixed(1), 10, base + 24, rgba(p.ink, .75), 'left', 10.5);
    const y0 = h - 8, hh = Math.max(14, h * .2);
    c.beginPath();
    for (let i = 0; i < st.h.length; i++) {
      const x = 10 + (w - 20) * i / 109, y = y0 - clamp((st.h[i] + 26) / 20) * hh;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.strokeStyle = p.accent; c.lineWidth = 1.3; c.stroke();
  };

  V.geometry = function (c, w, h, p, st, A, k) {
    const S = A.S; st.a = (st.a || 0) + S.dt * (.22 + .6 * S.level * k);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .36, H = R * 1.25, n = 24, f = R * 3.4;
    const ca = Math.cos(st.a), sa = Math.sin(st.a), ct = Math.cos(.5), stl = Math.sin(.5);
    const proj = (x, y, z) => { const x1 = x * ca - z * sa, z1 = x * sa + z * ca, y2 = y * ct - z1 * stl, z2 = y * stl + z1 * ct, s = f / (f + z2); return [cx + x1 * s, cy + y2 * s]; };
    const layer = (rad, twist, color, lw) => {
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const an = i / n * TAU, a = proj(rad * Math.cos(an), -H / 2, rad * Math.sin(an)), b = proj(rad * Math.cos(an + twist), H / 2, rad * Math.sin(an + twist));
        c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      }
      c.strokeStyle = color; c.lineWidth = lw; c.stroke();
    };
    const tw = 1.9 + .5 * Math.sin(S.t * .5) + .45 * S.kick * Math.min(2, k);
    layer(R * .82, -tw * .9, rgba(p.ink, .5), .9);
    layer(R, tw, p.accent, 1);
  };

  function lut(p) {
    const out = new Uint8ClampedArray(64 * 3), dark = '#' + mix(p.bg, p.accent, .32).map(v => v.toString(16).padStart(2, '0')).join('');
    for (let i = 0; i < 64; i++) {
      const t = i / 63;
      const rgb = t < .45 ? mix(p.bg, dark, t / .45) : t < .82 ? mix(dark, p.accent, (t - .45) / .37) : mix(p.accent, p.ink, (t - .82) / .18 * .8);
      out.set(rgb, i * 3);
    }
    return out;
  }
  V.spectrogram = function (c, w, h, p, st, A) {
    const L = w < 200 ? 26 : 32, T = 8, B = h > 90 ? 18 : 6;
    const pw = Math.max(1, Math.floor(w - L - 6)), ph = Math.max(1, Math.floor(h - T - B));
    if (!st.buf || st.buf.width !== pw || st.buf.height !== ph || st.key !== p.key) {
      st.buf = document.createElement('canvas'); st.buf.width = pw; st.buf.height = ph;
      st.b = st.buf.getContext('2d'); st.key = p.key; st.lut = lut(p); st.col = st.b.createImageData(1, ph);
      st.b.fillStyle = p.bg; st.b.fillRect(0, 0, pw, ph);
    }
    st.b.drawImage(st.buf, -1, 0);
    const d = st.col.data, L3 = st.lut;
    for (let y = 0; y < ph; y++) {
      const i = Math.round((1 - y / (ph - 1)) * (A.BANDS - 1));
      const li = Math.round(clamp((A.spec[i] - .28) / .55) * 63) * 3, o = y * 4;
      d[o] = L3[li]; d[o + 1] = L3[li + 1]; d[o + 2] = L3[li + 2]; d[o + 3] = 255;
    }
    st.b.putImageData(st.col, pw - 1, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(st.buf, L, T);
    c.imageSmoothingEnabled = true;
    if (w > 140) {
      label(c, '20k', L - 5, T + 8, p.ink, 'right', 9.5);
      label(c, '1k', L - 5, T + ph * (1 - Math.log10(50) / 3) + 3, p.ink, 'right', 9.5);
      label(c, '30', L - 5, T + ph, p.ink, 'right', 9.5);
      if (B > 10) { label(c, '-12 s', L, h - 4, p.dim, 'left', 9.5); label(c, lang() === 'en' ? 'now' : 'ahora', w - 6, h - 4, p.dim, 'right', 9.5); }
    }
  };

  V.waveform = function (c, w, h, p, st, A) {
    const cy = h / 2, step = w < 240 ? 2 : 2.5, n = Math.floor((w - 8) / step);
    c.fillStyle = rgba(p.ink, .16); c.fillRect(4, Math.round(cy), w - 8, 1);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = A.history(n - 1 - i), hh = Math.max(.8, a * h * .44);
      c.rect(4 + i * step, cy - hh, Math.max(1, step - 1), hh * 2);
    }
    c.fillStyle = p.accent; c.fill();
  };

  V.threads = function (c, w, h, p, st, A, k) {
    const S = A.S;
    if (!st.n) { st.n = []; for (let i = 0; i < 18; i++) st.n.push({ x: .08 + .84 * fract(i * .618), y: .1 + .8 * fract(i * .382 + .2), vx: (fract(i * .77) - .5) * .09, vy: (fract(i * .53) - .5) * .09 }); }
    const sp = 1 + 2 * S.level * k;
    for (const q of st.n) {
      q.x += q.vx * S.dt * sp; q.y += q.vy * S.dt * sp;
      if (q.x < .06 || q.x > .94) q.vx *= -1; if (q.y < .08 || q.y > .92) q.vy *= -1;
      q.x = clamp(q.x, .06, .94); q.y = clamp(q.y, .08, .92);
    }
    const m = Math.min(w, h), jit = S.kick * 2.2 * Math.min(2, k);
    const buckets = [[], [], []];
    for (let i = 0; i < st.n.length; i++) for (let j = i + 1; j < st.n.length; j++) {
      const a = st.n[i], b = st.n[j], dx = (a.x - b.x) * w, dy = (a.y - b.y) * h, d = Math.hypot(dx, dy) / m;
      if (d < .62) buckets[d < .25 ? 0 : d < .42 ? 1 : 2].push(a.x * w, a.y * h + (i % 2 ? jit : -jit), b.x * w, b.y * h);
    }
    [.85, .45, .18].forEach((al, bi) => {
      const arr = buckets[bi]; if (!arr.length) return;
      c.beginPath(); for (let i = 0; i < arr.length; i += 4) { c.moveTo(arr[i], arr[i + 1]); c.lineTo(arr[i + 2], arr[i + 3]); }
      c.strokeStyle = rgba(p.accent, al); c.lineWidth = 1; c.stroke();
    });
    c.fillStyle = p.ink;
    st.n.forEach((q, i) => c.fillRect(q.x * w - 1.5, q.y * h - 1.5 + (i % 2 ? jit : -jit), 3, 3));
  };

  V.levels = function (c, w, h, p, st, A) {
    const S = A.S;
    const tl = S.rms + 1.5 * Math.sin(S.t * 3.1) + 2 * S.kick, tr = S.rms - .8 + 1.5 * Math.cos(S.t * 2.6) + 2 * S.kick;
    st.l = st.l ?? -40; st.r = st.r ?? -40;
    st.l += (tl - st.l) * Math.min(1, S.dt * 14); st.r += (tr - st.r) * Math.min(1, S.dt * 14);
    st.pl = Math.max(st.l + 3, (st.pl ?? -40) - S.dt * 6); st.pr = Math.max(st.r + 3, (st.pr ?? -40) - S.dt * 6);
    const top = 14, bot = h - 20, H = bot - top, map = db => clamp((db + 48) / 48);
    const bw = Math.min(26, w * .14), xs = [w * .5 - bw - 6, w * .5 + 6];
    [[st.l, st.pl], [st.r, st.pr]].forEach(([v, pk], i) => {
      const x = xs[i], lit = map(v), seg = 4;
      for (let y = 0; y < H; y += seg) {
        const t = 1 - y / H, on = t <= lit, warn = t > map(-6);
        c.fillStyle = on ? (warn ? p.accent : rgba(p.ink, .85)) : rgba(p.ink, .07);
        c.fillRect(x, top + y, bw, seg - 1.5);
      }
      c.fillStyle = p.accent; c.fillRect(x, top + H * (1 - map(pk)), bw, 2);
      label(c, i ? 'R' : 'L', x + bw / 2, h - 6, p.dim, 'center', 9.5);
    });
    if (w > 120) for (const db of [0, -6, -12, -24, -48]) label(c, String(db), w - 8, top + H * (1 - map(db)) + 3, p.dim, 'right', 9);
  };

  V.particles = function (c, w, h, p, st, A, k) {
    const S = A.S, n = 300;
    if (!st.p) { st.p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = fract(i * .618034) * 2 - 1, th = i * 2.39996, s = Math.sqrt(1 - u * u), rr = .55 + .45 * Math.sqrt(fract(i * .7548)); st.p[i * 3] = s * Math.cos(th) * rr; st.p[i * 3 + 1] = u * rr; st.p[i * 3 + 2] = s * Math.sin(th) * rr; } }
    st.a = (st.a || 0) + S.dt * (.3 + .55 * S.level * k);
    const R = Math.min(w, h) * .4 * (1 + .12 * S.kick * Math.min(2, k)), cx = w / 2, cy = h / 2, ca = Math.cos(st.a), sa = Math.sin(st.a);
    const front = [], back = [], hot = [];
    for (let i = 0; i < n; i++) {
      const x = st.p[i * 3], y = st.p[i * 3 + 1], z = st.p[i * 3 + 2];
      const x1 = x * ca - z * sa, z1 = x * sa + z * ca, wob = 1 + .08 * k * Math.sin(y * 6 + S.t * 3) * S.mid;
      const px = cx + x1 * R * wob, py = cy + y * R * .92 * wob;
      (i % 11 === 0 ? hot : z1 > 0 ? front : back).push(px, py, z1);
    }
    const dr = (arr, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < arr.length; i += 3) { const s = 1 + (arr[i + 2] + 1) * .8; c.rect(arr[i] - s / 2, arr[i + 1] - s / 2, s, s); } c.fill(); };
    dr(back, rgba(p.ink, .28)); dr(front, rgba(p.ink, .85)); dr(hot, p.accent);
  };

  V.dotspectrum = function (c, w, h, p, st, A) {
    const cols = Math.max(10, Math.floor((w - 12) / 10)), rows = Math.max(6, Math.floor((h - 22) / 7)), gx = (w - 12) / cols;
    const on = [], off = [], tops = [];
    for (let i = 0; i < cols; i++) {
      const v = A.spec[Math.floor(i / cols * (A.BANDS - 1) * .95)], lit = Math.round(clamp((v - .22) / .58) * rows);
      for (let r = 0; r < rows; r++) (r < lit ? (r === lit - 1 ? tops : on) : off).push(6 + i * gx + gx / 2, h - 12 - r * 7);
    }
    const dr = (arr, col, s) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < arr.length; i += 2) c.rect(arr[i] - s / 2, arr[i + 1] - s / 2, s, s); c.fill(); };
    dr(off, rgba(p.ink, .09), 2); dr(on, rgba(p.ink, .8), 2.6); dr(tops, p.accent, 3.2);
  };

  V.vu = function (c, w, h, p, st, A) {
    const S = A.S, cx = w / 2, cy = h * .9, R = Math.min(w * .44, h * .74);
    const pos = vu => (Math.pow(10, vu / 20) - Math.pow(10, -1)) / (Math.pow(10, 3 / 20) - Math.pow(10, -1));
    const ang = t => (-50 + 100 * clamp(t)) * Math.PI / 180 - Math.PI / 2;
    const target = clamp(pos(S.rms + 18 + 2 * S.kick));
    st.v = st.v ?? 0; st.v += (target - st.v) * Math.min(1, S.dt * 6);
    c.lineWidth = 1.2;
    c.strokeStyle = rgba(p.ink, .55); c.beginPath(); c.arc(cx, cy, R, ang(0), ang(pos(0))); c.stroke();
    c.strokeStyle = p.accent; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, ang(pos(0)), ang(1)); c.stroke();
    c.lineWidth = 1;
    for (const vu of [-20, -10, -7, -5, -3, -1, 0, 1, 2, 3]) {
      const a = ang(pos(vu)), big = [-20, -10, -5, 0, 3].includes(vu);
      c.strokeStyle = vu >= 0 ? p.accent : rgba(p.ink, .7); c.beginPath();
      c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.lineTo(cx + Math.cos(a) * (R - (big ? 9 : 5)), cy + Math.sin(a) * (R - (big ? 9 : 5))); c.stroke();
      if (big && R > 50) label(c, (vu > 0 ? '+' : '') + vu, cx + Math.cos(a) * (R + 10), cy + Math.sin(a) * (R + 10) + 3, vu >= 0 ? p.accent : p.dim, 'center', 9);
    }
    label(c, 'VU', cx, cy - R * .42, p.ink, 'center', 11, 600);
    const a = ang(st.v);
    c.strokeStyle = p.ink; c.lineWidth = 1.4; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02); c.stroke();
    c.fillStyle = p.ink; c.beginPath(); c.arc(cx, cy, 3.5, 0, TAU); c.fill();
  };

  V.scope = function (c, w, h, p, st, A) {
    const cy = h / 2;
    c.fillStyle = rgba(p.ink, .14); c.fillRect(0, Math.round(cy), w, 1);
    c.beginPath();
    for (let i = 0; i < A.WAVE; i += 2) { const x = i / (A.WAVE - 2) * w, y = cy - A.wave[i] * h * .38; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.strokeStyle = p.accent; c.lineWidth = 1.4; c.lineJoin = 'round'; c.stroke();
  };

  V.orbit = function (c, w, h, p, st, A, k) {
    const S = A.S; st.a = (st.a || 0) + S.dt * (.5 + S.level * k);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .42;
    for (let i = 0; i < 5; i++) {
      const rx = R * (.36 + i * .16) * (1 + .08 * S.kick * Math.min(2, k) * (i % 2 ? 1 : -1)), ry = rx * (.34 + .1 * i), rot = st.a * (i % 2 ? 1 : -1) * .6 + i;
      c.beginPath(); c.ellipse(cx, cy, rx, ry, rot, 0, TAU);
      c.strokeStyle = i === 4 ? p.accent : rgba(p.ink, .32); c.lineWidth = 1; c.stroke();
      const an = st.a * (1.2 + i * .3) + i * 1.7, ex = Math.cos(an) * rx, ey = Math.sin(an) * ry;
      c.fillStyle = i % 2 ? p.ink : p.accent;
      c.fillRect(cx + ex * Math.cos(rot) - ey * Math.sin(rot) - 2, cy + ex * Math.sin(rot) + ey * Math.cos(rot) - 2, 4, 4);
    }
    c.fillStyle = p.accent; c.beginPath(); c.arc(cx, cy, R * .1 * (1 + S.kick * .5 * Math.min(2, k)), 0, TAU); c.fill();
  };

  V.rta = function (c, w, h, p, st, A) {
    const n = Math.max(12, Math.min(31, Math.floor(w / 9))), bw = (w - 16) / n; st.pk = st.pk && st.pk.length === n ? st.pk : new Float32Array(n);
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i / n * A.BANDS), b = Math.max(a + 1, Math.floor((i + 1) / n * A.BANDS));
      let v = 0; for (let j = a; j < b; j++) v += A.spec[j]; v /= (b - a);
      const bh = clamp((v - .22) / .6) * (h - 26);
      st.pk[i] = Math.max(bh, st.pk[i] - A.S.dt * 40);
      c.rect(8 + i * bw + 1, h - 10 - bh, bw - 2, bh);
    }
    c.fillStyle = rgba(p.ink, .8); c.fill();
    c.fillStyle = p.accent;
    for (let i = 0; i < n; i++) c.fillRect(8 + i * bw + 1, h - 12 - st.pk[i], bw - 2, 2);
  };

  /* ---------- Paletas por temática ---------- */
  let THEME = { ink: '#f3f1ec', red: '#ff2a3d', panel: '#000000', dim: '#6f6c66', key: 'dark' };
  const STYLES = {
    vintage: { ink: '#4a3a28', accent: '#b4532f', bg: '#e9dec6', dim: '#8b7a5e' },
    blueprint: { ink: '#d4ebff', accent: '#62dbef', bg: '#0c2136', dim: '#6d93b3' },
    crt: { ink: '#c8ffd6', accent: '#80e09a', bg: '#051009', dim: '#4c8a5c' },
    cosmos: { ink: '#ebe6f7', accent: '#a49bff', bg: '#0a0912', dim: '#6a6491' },
    arcade: { ink: '#f4e6ee', accent: '#ff5fa2', bg: '#100d18', dim: '#76699a' },
    night: { ink: '#f3f1ec', accent: '#ff2a3d', bg: '#000000', dim: '#6f6c66' }
  };
  function palette(inst) {
    const s = inst.opts.style, acc = inst.opts.accent, key = s + '|' + (acc || '') + '|' + THEME.key;
    if (inst.pkey === key) return inst.p;
    const base = STYLES[s];
    const p = base ? { ...base, accent: acc || base.accent } : { ink: THEME.ink, accent: acc || THEME.red, bg: THEME.panel, dim: THEME.dim };
    p.key = key; inst.p = p; inst.pkey = key; return p;
  }

  /* ---------- Gestor ---------- */
  const instances = new Set(), byCanvas = new WeakMap();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { const i = byCanvas.get(e.target); if (i) i.visible = e.isIntersecting; }), { rootMargin: '120px' }) : null;

  function create(canvas, id, opts = {}) {
    const inst = { canvas, ctx: canvas.getContext('2d'), id, st: {}, visible: !io, opts: Object.assign({ style: 'brutal', accent: null, gain: 1, zoomAware: false, active: true }, opts), cw: 0, ch: 0, k: 1 };
    instances.add(inst); byCanvas.set(canvas, inst); if (io) io.observe(canvas);
    return inst;
  }
  function setId(inst, id) { if (inst.id !== id) { inst.id = id; inst.st = {}; } }
  function destroy(inst) { instances.delete(inst); if (io) io.unobserve(inst.canvas); }
  function setTheme(t) { THEME = { ...THEME, ...t }; }

  function frame(now) {
    const A = window.HA; A.update(now);
    if (window.HV.paused) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const list = [];
    for (const inst of instances) {
      if (!inst.visible || !inst.opts.active) continue;
      inst.cw = inst.canvas.clientWidth; inst.ch = inst.canvas.clientHeight;
      if (inst.cw < 4 || inst.ch < 4) continue;
      inst.k = inst.opts.zoomAware ? Math.max(.5, Math.min(3, inst.canvas.getBoundingClientRect().width / inst.cw)) : 1;
      list.push(inst);
    }
    for (const inst of list) {
      const { canvas, ctx: c, cw: w, ch: h } = inst, style = inst.opts.style;
      const res = style === 'arcade' ? Math.max(.34, .42 * inst.k) : Math.min(3, dpr * inst.k);
      const bw = Math.max(1, Math.round(w * res)), bh = Math.max(1, Math.round(h * res));
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      canvas.classList.toggle('is-pixel', style === 'arcade');
      c.setTransform(bw / w, 0, 0, bh / h, 0, 0);
      const p = palette(inst), fn = V[inst.id];
      try {
        chromeBack(c, w, h, p, style, A);
        if (fn) { c.save(); fn(c, w, h, p, inst.st, A, inst.opts.gain); c.restore(); }
        chromeFront(c, w, h, p, style, A);
      } catch (err) { if (!inst.err) { inst.err = true; console.warn('visual', inst.id, err); } }
    }
  }

  window.HV = { create, setId, destroy, setTheme, frame, ids: Object.keys(V), rgba, paused: false };
})();
