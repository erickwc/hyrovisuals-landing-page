// @ts-nocheck
/* Copia del reproductor .hvl. El original (y la definición del formato) vive en
   Hyro visual/web-loops/site/hvl-player.js: si cambia allí, vuelve a copiarlo. Los loops se graban con
   node web-loops/scripts/record.mjs --landing (escribe public/loops/). */
// Hyro Visual Loop (.hvl) player — replays recorded Canvas 2D draw calls on a <canvas>.
// No dependencies. A .hvl file is gzip of:
//   "HVL1" | u32 headerLength | header JSON | u32 opsLength | ops bytes | number bytes
// Every frame: varint op count, a flag byte, then per op one opcode byte (+ one argument-count
// byte for ops of variable length). Numbers are quantised integers stored as zigzag varints.
// Flag 1 (the frame makes exactly the previous frame's calls): each number is the change from
// the number at the same position last frame. Flag 0: each number is the change from the last
// number of the same call and argument position in this frame.

/** Quantisation of each argument kind: stored integer = round(value * scale). */
export const SCALE = { c: 16, a: 1e4, m: 1e4, w: 100, u: 1e3, s: 1, b: 1, i: 1 };
/** Sentinel for NaN. */
export const NAN_CODE = 1073741823;

/** [name, argument kinds, variable length]. A '*' marks the kind of every further argument. */
export const OPS = [
  ['beginPath', ''], ['closePath', ''], ['moveTo', 'cc'], ['lineTo', 'cc'],
  ['bezierCurveTo', 'cccccc'], ['quadraticCurveTo', 'cccc'], ['arc', 'cccaa*b', 1],
  ['arcTo', 'ccccc'], ['ellipse', 'ccccaaa*b', 1], ['rect', 'cccc'], ['roundRect', 'cccc*c', 1],
  ['fill', '*s', 1], ['stroke', ''], ['clip', '*s', 1], ['fillRect', 'cccc'], ['strokeRect', 'cccc'],
  ['clearRect', 'cccc'], ['fillText', 'scc*c', 1], ['strokeText', 'scc*c', 1], ['save', ''],
  ['restore', ''], ['translate', 'cc'], ['rotate', 'a'], ['scale', 'mm'], ['setTransform', 'mmmmcc'],
  ['transform', 'mmmmcc'], ['resetTransform', ''], ['setLineDash', '*w', 1], ['drawLayer', 'i*c', 1],
  // Properties (one argument each) from here on.
  ['fillStyle', 'i'], ['strokeStyle', 'i'], ['lineWidth', 'w'], ['lineCap', 's'], ['lineJoin', 's'],
  ['miterLimit', 'w'], ['globalAlpha', 'u'], ['globalCompositeOperation', 's'], ['font', 's'],
  ['textAlign', 's'], ['textBaseline', 's'], ['shadowBlur', 'w'], ['shadowColor', 's'],
  ['shadowOffsetX', 'w'], ['shadowOffsetY', 'w'], ['lineDashOffset', 'w'], ['filter', 's'],
  ['letterSpacing', 's'], ['wordSpacing', 's'], ['direction', 's'], ['fontKerning', 's'],
  ['imageSmoothingEnabled', 'b'], ['imageSmoothingQuality', 's'],
];
export const OP_INDEX = Object.fromEntries(OPS.map((op, i) => [op[0], i]));
export const FIRST_PROPERTY = OP_INDEX.fillStyle;

/** Per-op lists of argument scales: fixed head, then one tail scale for the rest. */
const SPECS = OPS.map(([, kinds, variable]) => {
  const star = kinds.indexOf('*');
  const head = (star < 0 ? kinds : kinds.slice(0, star)).split('').map(k => SCALE[k]);
  return { head, tail: star < 0 ? 1 : SCALE[kinds[star + 1]], variable: !!variable, kinds };
});

const text = new TextDecoder();

export function parse(bytes) {
  if (text.decode(bytes.subarray(0, 4)) !== 'HVL1') throw new Error('not a .hvl file');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(4, true);
  const header = JSON.parse(text.decode(bytes.subarray(8, 8 + headerLength)));
  const opsLength = view.getUint32(8 + headerLength, true);
  const ops = bytes.subarray(12 + headerLength, 12 + headerLength + opsLength);
  const nums = bytes.subarray(12 + headerLength + opsLength);
  return { ...header, ops, nums };
}

export async function load(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`hvl ${response.status} ${url}`);
  const raw = response.body.pipeThrough(new DecompressionStream('gzip'));
  const data = parse(new Uint8Array(await new Response(raw).arrayBuffer()));
  data.images = await Promise.all((data.layers || []).map(src => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src;
  })));
  return data;
}

/** Steps through the frames of one loop, drawing each into a context. */
export class Loop {
  constructor(data) {
    this.d = data; this.n = data.n; this.fps = data.fps;
    this.prev = []; this.last = new Float64Array(OPS.length * 32); this.grads = new WeakMap();
    this.rewind();
  }
  rewind() { this.op = 0; this.np = 0; this.frame = 0; this.prev = []; }
  varint(bytes, key) {
    let value = 0, scale = 1, byte, p = this[key];
    do { byte = bytes[p++]; value += (byte & 127) * scale; scale *= 128; } while (byte & 128);
    this[key] = p;
    return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
  }
  gradient(ctx, id) {
    let cache = this.grads.get(ctx);
    if (!cache) { cache = []; this.grads.set(ctx, cache); }
    if (!cache[id]) {
      const g = this.d.grads[id], args = g.a;
      const made = g.k === 'L' ? ctx.createLinearGradient(...args) : g.k === 'R' ? ctx.createRadialGradient(...args) : ctx.createConicGradient(...args);
      for (const [offset, color] of g.s) made.addColorStop(offset, this.d.strings[color]);
      cache[id] = made;
    }
    return cache[id];
  }
  /** Decodes the next frame; draws it when ctx is given. sx, sy: playback pixels per recorded pixel. */
  next(ctx, sx = 1, sy = 1) {
    if (this.frame >= this.n) this.rewind();
    const { ops, nums } = this.d, prev = this.prev, cur = [];
    const count = this.varint(ops, 'op'), same = ops[this.op++] === 1, last = this.last.fill(0);
    const args = [];
    for (let k = 0; k < count; k++) {
      const code = ops[this.op++], spec = SPECS[code];
      const argc = spec.variable ? ops[this.op++] : spec.head.length;
      args.length = 0;
      for (let a = 0; a < argc; a++) {
        const index = cur.length, key = code * 32 + Math.min(a, 31);
        const value = this.varint(nums, 'np') + (same ? prev[index] : last[key]);
        last[key] = value;
        cur.push(value);
        args.push(value);
      }
      if (ctx) this.apply(ctx, code, argc, args, spec, sx, sy);
    }
    this.prev = cur; this.frame++;
  }
  /** Moves to frame `target`, decoding (not drawing) the frames in between. */
  seek(target) {
    target = ((target % this.n) + this.n) % this.n;
    if (target < this.frame) this.rewind();
    while (this.frame < target) this.next(null);
  }
  apply(ctx, code, argc, e, spec, sx, sy) {
    for (let i = 0; i < argc; i++) {
      const scale = i < spec.head.length ? spec.head[i] : spec.tail;
      e[i] = e[i] === NAN_CODE ? NaN : e[i] / scale;
    }
    const S = this.d.strings;
    switch (OPS[code][0]) {
      case 'beginPath': ctx.beginPath(); break;
      case 'closePath': ctx.closePath(); break;
      case 'moveTo': ctx.moveTo(e[0], e[1]); break;
      case 'lineTo': ctx.lineTo(e[0], e[1]); break;
      case 'bezierCurveTo': ctx.bezierCurveTo(e[0], e[1], e[2], e[3], e[4], e[5]); break;
      case 'quadraticCurveTo': ctx.quadraticCurveTo(e[0], e[1], e[2], e[3]); break;
      case 'arc': ctx.arc(e[0], e[1], e[2], e[3], e[4], argc > 5 && !!e[5]); break;
      case 'arcTo': ctx.arcTo(e[0], e[1], e[2], e[3], e[4]); break;
      case 'ellipse': ctx.ellipse(e[0], e[1], e[2], e[3], e[4], e[5], e[6], argc > 7 && !!e[7]); break;
      case 'rect': ctx.rect(e[0], e[1], e[2], e[3]); break;
      case 'roundRect': ctx.roundRect(e[0], e[1], e[2], e[3], argc > 5 ? e.slice(4, argc) : argc === 5 ? e[4] : 0); break;
      case 'fill': argc ? ctx.fill(S[e[0]]) : ctx.fill(); break;
      case 'stroke': ctx.stroke(); break;
      case 'clip': argc ? ctx.clip(S[e[0]]) : ctx.clip(); break;
      case 'fillRect': ctx.fillRect(e[0], e[1], e[2], e[3]); break;
      case 'strokeRect': ctx.strokeRect(e[0], e[1], e[2], e[3]); break;
      case 'clearRect': ctx.clearRect(e[0], e[1], e[2], e[3]); break;
      case 'fillText': argc > 3 ? ctx.fillText(S[e[0]], e[1], e[2], e[3]) : ctx.fillText(S[e[0]], e[1], e[2]); break;
      case 'strokeText': argc > 3 ? ctx.strokeText(S[e[0]], e[1], e[2], e[3]) : ctx.strokeText(S[e[0]], e[1], e[2]); break;
      case 'save': ctx.save(); break;
      case 'restore': ctx.restore(); break;
      case 'translate': ctx.translate(e[0], e[1]); break;
      case 'rotate': ctx.rotate(e[0]); break;
      case 'scale': ctx.scale(e[0], e[1]); break;
      // Absolute transforms get the playback scale in front, so the loop fills any canvas size.
      case 'setTransform': ctx.setTransform(e[0] * sx, e[1] * sy, e[2] * sx, e[3] * sy, e[4] * sx, e[5] * sy); break;
      case 'resetTransform': ctx.setTransform(sx, 0, 0, sy, 0, 0); break;
      case 'transform': ctx.transform(e[0], e[1], e[2], e[3], e[4], e[5]); break;
      case 'setLineDash': ctx.setLineDash(e.slice(0, argc)); break;
      case 'drawLayer': {
        const image = this.d.images[e[0]];
        if (!image) break;
        if (argc === 3) ctx.drawImage(image, e[1], e[2]);
        else if (argc === 5) ctx.drawImage(image, e[1], e[2], e[3], e[4]);
        else if (argc === 9) ctx.drawImage(image, e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8]);
        break;
      }
      case 'fillStyle': ctx.fillStyle = e[0] < 0 ? this.gradient(ctx, -1 - e[0]) : S[e[0]]; break;
      case 'strokeStyle': ctx.strokeStyle = e[0] < 0 ? this.gradient(ctx, -1 - e[0]) : S[e[0]]; break;
      // Shadows ignore the transform: scale them by hand.
      case 'shadowBlur': ctx.shadowBlur = e[0] * (sx + sy) / 2; break;
      case 'shadowOffsetX': ctx.shadowOffsetX = e[0] * sx; break;
      case 'shadowOffsetY': ctx.shadowOffsetY = e[0] * sy; break;
      case 'imageSmoothingEnabled': ctx.imageSmoothingEnabled = !!e[0]; break;
      default: {
        const name = OPS[code][0];
        ctx[name] = spec.kinds === 's' ? S[e[0]] : e[0];
      }
    }
  }
}

/** Mounts every <canvas data-hvl="url"> on the page: loads near the viewport, plays only while visible. */
export function mountAll(root = document) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const players = [];
  const cache = new Map();
  const fetchLoop = url => { if (!cache.has(url)) cache.set(url, load(url)); return cache.get(url); };
  const start = performance.now();
  let scheduled = 0;
  const frame = () => {
    scheduled = 0;
    const elapsed = (performance.now() - start) / 1000;
    let any = false;
    for (const p of players) {
      if (!p.loop || !p.visible) continue;
      any = true;
      const target = reduced.matches ? 0 : Math.floor(elapsed * p.loop.fps) % p.loop.n;
      if (target === p.drawn && !p.dirty) continue;
      const c = p.canvas, dpr = Math.min(2, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      p.loop.seek(target);
      const ctx = p.ctx, d = p.loop.d;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = d.bg; ctx.fillRect(0, 0, w, h);
      p.loop.next(ctx, w / d.w, h / d.h);
      p.drawn = target; p.dirty = false;
    }
    if (any && !reduced.matches) schedule();
  };
  const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(frame); };
  // The old loop keeps playing until the new one is ready, so switching theme never flashes.
  const request = p => {
    p.requested = true;
    const url = p.canvas.dataset.hvl;
    fetchLoop(url).then(data => {
      if (p.canvas.dataset.hvl !== url) return;
      p.loop = new Loop(data); p.canvas.style.background = data.bg; p.dirty = true; schedule();
    }).catch(error => console.warn(error));
  };
  const near = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const p = players.find(q => q.canvas === entry.target);
      if (entry.isIntersecting && !p.requested) request(p);
    }
  }, { rootMargin: '600px 0px' });
  // Changing data-hvl (a theme switch, say) loads the new loop in place.
  const swapped = new MutationObserver(records => {
    for (const record of records) { const p = players.find(q => q.canvas === record.target); if (p) request(p); }
  });
  const seen = new IntersectionObserver(entries => {
    for (const entry of entries) { const p = players.find(q => q.canvas === entry.target); p.visible = entry.isIntersecting; p.dirty = true; }
    schedule();
  });
  const resized = new ResizeObserver(() => { for (const p of players) p.dirty = true; schedule(); });
  for (const canvas of root.querySelectorAll('canvas[data-hvl]')) {
    const p = { canvas, ctx: canvas.getContext('2d'), loop: null, visible: false, requested: false, drawn: -1, dirty: true };
    players.push(p);
    near.observe(canvas); seen.observe(canvas); resized.observe(canvas);
    swapped.observe(canvas, { attributes: true, attributeFilter: ['data-hvl'] });
  }
  reduced.addEventListener('change', () => { for (const p of players) p.dirty = true; schedule(); });
  return players;
}
