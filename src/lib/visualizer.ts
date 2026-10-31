// Visual simulado de Hyro en canvas: audio de ejemplo generado (no usa micrófono).

export type PanelKind = "spectrum" | "stereo" | "pixels" | "vu" | "levels" | "bands" | "trail";

export type StripParams = {
  primary: string;
  secondary: string;
  ink: string;
  sensitivityDb: number; // -12 .. +12
  motion: number; // 0.3 .. 2
  smoothing: number; // 0 .. 0.95
};

type Options = {
  panels: PanelKind[];
  minPanelWidth?: number;
  gap?: number;
  labels?: boolean;
};

const BINS = 64;
const SAMPLES = 120;
const WEIGHT: Record<PanelKind, number> = { spectrum: 1.6, stereo: 1.6, pixels: 0.9, vu: 1.1, levels: 0.5, bands: 1, trail: 1.3 };

// Mientras la página se desplaza no se dibuja: el scroll queda libre y los lienzos retoman al detenerse.
let scrolling = false;
if (typeof window !== "undefined") {
  let timer = 0;
  window.addEventListener(
    "scroll",
    () => {
      scrolling = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (scrolling = false), 140);
    },
    { passive: true },
  );
}
const FRAME_MS = 1000 / 30;

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function createStrip(canvas: HTMLCanvasElement, initial: StripParams, opts: Options) {
  const ctx = canvas.getContext("2d")!;
  let params = { ...initial };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let running = false;
  let last = performance.now();
  let t = 0;

  const spec = new Float32Array(BINS);
  const left = new Float32Array(SAMPLES);
  const right = new Float32Array(SAMPLES);
  let vu = 0;
  let vuVel = 0;
  let levelL = 0;
  let levelR = 0;
  let peakL = 0;
  let peakR = 0;
  const bands = new Float32Array(5);

  const mono = "500 10px 'Space Grotesk', system-ui, sans-serif";

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    draw();
  }

  function simulate(dt: number) {
    t += dt * params.motion;
    const gain = Math.pow(10, params.sensitivityDb / 20);
    const beat = (t % 0.5) / 0.5;
    const kick = Math.exp(-beat * 9);
    const hat = Math.exp(-(((t + 0.25) % 0.25) / 0.25) * 14);
    const bar = Math.floor(t / 2);
    const swell = 0.75 + 0.25 * Math.sin(t * 0.7);
    const k = Math.min(params.smoothing, 0.95);

    for (let i = 0; i < BINS; i++) {
      const p = i / (BINS - 1);
      const tilt = Math.pow(1 - p, 0.55) * 0.72 + 0.08;
      const n = smoothNoise(i * 0.35 + t * 3.2 + bar * 7) * 0.35;
      const low = kick * Math.exp(-p * 9) * 0.9;
      const high = hat * Math.exp(-(1 - p) * 4) * 0.35;
      const target = Math.min(1, (tilt * (0.55 + n) * swell + low + high) * gain);
      spec[i] = spec[i] * k + target * (1 - k);
    }

    const energy = Math.min(1.2, (0.45 + kick * 0.55) * swell * gain);
    for (let s = 0; s < SAMPLES; s++) {
      const x = s / SAMPLES;
      const env = 0.35 + 0.65 * smoothNoise(x * 6 + t * 5);
      const wave = Math.sin(x * 50 + t * 20) * 0.6 + Math.sin(x * 13 - t * 7) * 0.4;
      left[s] = left[s] * k * 0.6 + wave * env * energy * (1 - k * 0.6);
      right[s] = right[s] * k * 0.6 + Math.sin(x * 47 + t * 18 + 1) * env * energy * 0.92 * (1 - k * 0.6);
    }

    const rms = Math.min(1, energy * 0.8);
    vuVel += (rms - vu) * 18 * dt;
    vuVel *= Math.pow(0.02, dt);
    vu = Math.max(0, Math.min(1.15, vu + vuVel * dt * 10));

    const lt = Math.min(1, energy * (0.8 + 0.2 * smoothNoise(t * 4)));
    const rt = Math.min(1, energy * (0.78 + 0.22 * smoothNoise(t * 4 + 9)));
    levelL += (lt - levelL) * Math.min(1, dt * 14);
    levelR += (rt - levelR) * Math.min(1, dt * 14);
    peakL = Math.max(levelL, peakL - dt * 0.35);
    peakR = Math.max(levelR, peakR - dt * 0.35);

    const groups = [[0, 4], [4, 12], [12, 28], [28, 48], [48, 64]];
    groups.forEach(([a, b], gi) => {
      let sum = 0;
      for (let i = a; i < b; i++) sum += spec[i];
      bands[gi] += (sum / (b - a) - bands[gi]) * Math.min(1, dt * 10);
    });
  }

  function gridLines(x: number, y: number, w: number, h: number) {
    ctx.strokeStyle = withAlpha(params.ink, 0.07);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const yy = Math.round(y + (h * i) / 4) + 0.5;
      ctx.moveTo(x, yy);
      ctx.lineTo(x + w, yy);
    }
    ctx.stroke();
  }

  function label(text: string, x: number, y: number, align: CanvasTextAlign = "left", alpha = 0.45) {
    if (opts.labels === false) return;
    ctx.font = mono;
    ctx.textAlign = align;
    ctx.fillStyle = withAlpha(params.ink, alpha);
    ctx.fillText(text, x, y);
  }

  function drawSpectrum(x: number, y: number, w: number, h: number) {
    gridLines(x, y, w, h);
    const base = y + h - 14;
    const top = y + 6;
    ctx.beginPath();
    ctx.moveTo(x, base);
    for (let i = 0; i < BINS; i++) {
      const px = x + (i / (BINS - 1)) * w;
      const py = base - spec[i] * (base - top);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x + w, base);
    ctx.closePath();
    ctx.fillStyle = withAlpha(params.primary, 0.28);
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < BINS; i++) {
      const px = x + (i / (BINS - 1)) * w;
      const py = base - spec[i] * (base - top);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = params.primary;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ["20", "200", "2k", "20k"].forEach((l, i) => label(l, x + (w * i) / 3, y + h - 2, i === 0 ? "left" : i === 3 ? "right" : "center"));
  }

  function drawStereo(x: number, y: number, w: number, h: number) {
    const rowH = (h - 8) / 2;
    const bw = w / SAMPLES;
    [left, right].forEach((buf, row) => {
      const cy = y + rowH / 2 + row * (rowH + 8);
      ctx.fillStyle = row === 0 ? params.primary : params.secondary;
      for (let s = 0; s < SAMPLES; s++) {
        const a = Math.min(1, Math.abs(buf[s])) * (rowH / 2);
        ctx.fillRect(x + s * bw, cy - a, Math.max(1, bw - 0.6), a * 2);
      }
      label(row === 0 ? "L" : "R", x + w + 2, cy + 3, "left", 0.5);
    });
  }

  function drawPixels(x: number, y: number, w: number, h: number) {
    const r = Math.min(w, h) / 2 - 4;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const step = Math.max(4, Math.round(r / 11));
    const energy = spec[2] * 0.7 + spec[20] * 0.3;
    const ang = t * 0.6;
    for (let gy = -r; gy <= r; gy += step) {
      for (let gx = -r; gx <= r; gx += step) {
        const d = Math.hypot(gx, gy);
        if (d > r) continue;
        const band = Math.sin((gx * Math.cos(ang) + gy * Math.sin(ang)) * 0.09 + t * 2.4);
        const lit = band * 0.5 + 0.5 > 1 - energy * 0.85 - (1 - d / r) * 0.15;
        ctx.fillStyle = lit ? params.primary : withAlpha(params.ink, 0.13);
        ctx.fillRect(cx + gx - 1.2, cy + gy - 1.2, 2.4, 2.4);
      }
    }
  }

  function drawVu(x: number, y: number, w: number, h: number) {
    const cx = x + w / 2;
    const cy = y + h * 0.92;
    const r = Math.min(w * 0.46, h * 0.82);
    const a0 = Math.PI * 1.2;
    const a1 = Math.PI * 1.8;
    ctx.lineWidth = 1.2;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + ((a1 - a0) * i) / 10;
      const hot = i >= 8;
      ctx.strokeStyle = hot ? params.primary : withAlpha(params.ink, 0.45);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.strokeStyle = params.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.02, a0 + (a1 - a0) * 0.8, a1);
    ctx.stroke();
    const na = a0 + (a1 - a0) * Math.min(1.05, vu);
    ctx.strokeStyle = params.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * r * 0.95, cy + Math.sin(na) * r * 0.95);
    ctx.stroke();
    const db = (vu * 23 - 20).toFixed(1);
    label(`${db} VU`, x, y + h - 2, "left", 0.7);
  }

  function drawLevels(x: number, y: number, w: number, h: number) {
    const bw = Math.min(16, (w - 10) / 2);
    const gap = 8;
    const total = bw * 2 + gap;
    const sx = x + (w - total) / 2;
    [[levelL, peakL], [levelR, peakR]].forEach(([lv, pk], i) => {
      const bx = sx + i * (bw + gap);
      const inner = h - 14;
      ctx.fillStyle = withAlpha(params.ink, 0.08);
      ctx.fillRect(bx, y, bw, inner);
      const lh = lv * inner;
      ctx.fillStyle = params.primary;
      ctx.fillRect(bx, y + inner - lh, bw, lh);
      ctx.fillStyle = params.secondary;
      ctx.fillRect(bx, y + inner - pk * inner - 2, bw, 2);
      label(i === 0 ? "L" : "R", bx + bw / 2, y + h - 2, "center");
    });
  }

  function drawBands(x: number, y: number, w: number, h: number) {
    const names = ["SUB", "LOW", "MID", "HIGH", "AIR"];
    const rowH = h / 5;
    const lw = opts.labels === false ? 0 : 34;
    names.forEach((n, i) => {
      const by = y + i * rowH + rowH * 0.25;
      const bh = rowH * 0.5;
      ctx.fillStyle = withAlpha(params.ink, 0.08);
      ctx.fillRect(x + lw, by, w - lw, bh);
      ctx.fillStyle = i < 3 ? params.primary : params.secondary;
      ctx.fillRect(x + lw, by, (w - lw) * Math.min(1, bands[i] * 1.1), bh);
      label(n, x, by + bh - 1, "left");
    });
  }

  function drawTrail(x: number, y: number, w: number, h: number) {
    const cy = y + h / 2;
    const energy = Math.min(1, spec[6] * 0.6 + spec[30] * 0.6);
    for (let l = 0; l < 7; l++) {
      ctx.beginPath();
      const phase = t * 2.2 - l * 0.28;
      for (let i = 0; i <= 60; i++) {
        const px = x + (i / 60) * w;
        const env = Math.sin((i / 60) * Math.PI);
        const py = cy + Math.sin(i * 0.33 + phase * 3) * (h * 0.38) * energy * env * (1 - l * 0.1) + Math.sin(i * 0.11 - phase) * h * 0.08 * env;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = withAlpha(l === 0 ? params.primary : params.secondary, l === 0 ? 1 : 0.5 - l * 0.06);
      ctx.lineWidth = l === 0 ? 1.8 : 1;
      ctx.stroke();
    }
  }

  const drawers: Record<PanelKind, (x: number, y: number, w: number, h: number) => void> = {
    spectrum: drawSpectrum,
    stereo: drawStereo,
    pixels: drawPixels,
    vu: drawVu,
    levels: drawLevels,
    bands: drawBands,
    trail: drawTrail,
  };

  function layout() {
    const gap = opts.gap ?? 20;
    const minW = opts.minPanelWidth ?? 150;
    const fit: PanelKind[] = [];
    let used = 0;
    for (const p of opts.panels) {
      const need = minW * WEIGHT[p] + (fit.length ? gap : 0);
      if (used + need > width && fit.length) break;
      fit.push(p);
      used += need;
    }
    const totalWeight = fit.reduce((s, p) => s + WEIGHT[p], 0);
    const free = width - gap * (fit.length - 1);
    let cursor = 0;
    return fit.map((p) => {
      const w = (free * WEIGHT[p]) / totalWeight;
      const box = { kind: p, x: cursor, w };
      cursor += w + gap;
      return box;
    });
  }

  function draw() {
    if (!width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const pad = 10;
    const gap = opts.gap ?? 20;
    const boxes = layout();
    boxes.forEach((box, i) => {
      ctx.save();
      drawers[box.kind](box.x + 2, pad, box.w - 4 - (box.kind === "stereo" ? 10 : 0), height - pad * 2);
      ctx.restore();
      if (i < boxes.length - 1) {
        ctx.fillStyle = withAlpha(params.ink, 0.08);
        ctx.fillRect(Math.round(box.x + box.w + gap / 2), 0, 1, height);
      }
    });
  }

  function frame(now: number) {
    if (running) raf = requestAnimationFrame(frame);
    if (scrolling) {
      last = now;
      return;
    }
    if (now - last < FRAME_MS) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    simulate(dt);
    draw();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  for (let i = 0; i < 40; i++) simulate(1 / 60);
  draw();

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    set(next: Partial<StripParams>) {
      params = { ...params, ...next };
      if (!running) draw();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}
