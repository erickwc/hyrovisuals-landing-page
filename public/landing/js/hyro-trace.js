/* Reproductor de trazos de Hyro. Una grabación (.hvt) guarda las instrucciones de dibujo ya calculadas de cada cuadro:
   no contiene el motor del programa. Se redibuja a la resolución de cada pantalla, así que siempre se ve nítida.
   El grabador está en tools/visual-capture.

   Formato: gzip de [4 bytes: largo del encabezado][encabezado JSON][operaciones][números][curvas: operaciones]
   [curvas: números][imágenes]. Los números van como enteros varint con signo, restando el de la misma posición del
   cuadro anterior: lo que no se mueve casi no ocupa. */

// [nombre, tipos de argumento]: c = coordenada (1/32 de píxel), r = razón o ángulo (1/100000), b = entero, s = texto, * = lista
export const OPS = [
  ["save", ""], ["restore", ""], ["scale", "rr"], ["rotate", "r"], ["translate", "cc"], ["transform", "rrrrcc"],
  ["setTransform", "rrrrcc"], ["resetTransform", ""], ["clearRect", "cccc"], ["fillRect", "cccc"], ["strokeRect", "cccc"],
  ["beginPath", ""], ["closePath", ""], ["moveTo", "cc"], ["lineTo", "cc"], ["bezierCurveTo", "cccccc"],
  ["quadraticCurveTo", "cccc"], ["arc", "ccrrrb"], ["arcTo", "ccccc"], ["ellipse", "ccccrrrb"], ["rect", "cccc"],
  ["roundRect", "cccc*"], ["fill", "b"], ["stroke", ""], ["clip", "b"], ["fillText", "scc"], ["strokeText", "scc"],
  ["setLineDash", "*"], ["fillStyle", "s"], ["strokeStyle", "s"], ["fillGradient", "b"], ["strokeGradient", "b"],
  ["globalAlpha", "r"], ["globalCompositeOperation", "s"], ["lineWidth", "r"], ["lineCap", "s"], ["lineJoin", "s"],
  ["miterLimit", "r"], ["lineDashOffset", "c"], ["font", "s"], ["textAlign", "s"], ["textBaseline", "s"],
  ["shadowBlur", "c"], ["shadowColor", "s"], ["shadowOffsetX", "c"], ["shadowOffsetY", "c"], ["pathStart", ""],
  ["pathEnd", ""], ["fillPath", "b"], ["strokePath", ""], ["clipPath", "b"], ["usePath", "b"], ["smoothing", "b"],
  ["drawSprite", "bbbbbcccc"], ["fillTextFit", "sccc"], ["strokeTextFit", "sccc"],
];
export const OP = Object.fromEntries(OPS.map(([name], i) => [name, i]));
// una grabación puede guardar sus números con menos precisión (head.scale), como las miles de partículas del ADN
export const SCALE = { c: 32, r: 100000, b: 1 };
const RULES = ["nonzero", "evenodd"];

function unzip(bytes) {
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}

function decodeNumbers(ops, raw, numCount, frameOps, frameNums, kinds, scale = SCALE) {
  const nums = new Float32Array(numCount);
  const last = new Map();
  let at = 0;
  let n = 0;
  let beforeSlots = new Int32Array(0), beforeValues = new Int32Array(0);
  let slots = new Int32Array(0), values = new Int32Array(0);
  let inFrame = 0, frame = 0, nextFrame = frameOps[1];
  const newFrame = (count) => {
    beforeSlots = slots; beforeValues = values;
    slots = new Int32Array(count); values = new Int32Array(count);
    inFrame = 0;
  };
  newFrame(frameNums[1] - frameNums[0]);
  const varint = () => {
    let shift = 0;
    let value = 0;
    for (;;) {
      const byte = raw[at++];
      value += (byte & 127) * 2 ** shift;
      if (byte < 128) break;
      shift += 7;
    }
    return value % 2 ? -(value + 1) / 2 : value / 2;
  };
  const read = (slot, kind) => {
    const same = inFrame < beforeSlots.length && beforeSlots[inFrame] === slot + 1;
    const value = (same ? beforeValues[inFrame] : last.get(slot) ?? 0) + varint();
    last.set(slot, value);
    slots[inFrame] = slot + 1; values[inFrame++] = value;
    if (kinds) kinds[n] = kind === "c" ? 1 : kind === "r" ? 2 : 0;
    nums[n++] = value / scale[kind];
  };
  for (let i = 0; i < ops.length; i++) {
    while (i >= nextFrame) {
      frame++;
      nextFrame = frameOps[frame + 1];
      newFrame(frameNums[frame + 1] - frameNums[frame]);
    }
    const code = ops[i];
    const types = OPS[code][1];
    for (let a = 0; a < types.length; a++) {
      const type = types[a];
      if (type === "*") {
        read(code * 16 + a, "b");
        const count = nums[n - 1];
        for (let j = 0; j < count; j++) read(code * 16 + a + 8, "c");
      } else read(code * 16 + a, type === "s" ? "b" : type);
    }
  }
  return nums;
}

/* Las curvas repetidas (como la estela del espectro) se guardan una sola vez y los cuadros las citan por número. */
function buildPaths(ops, nums) {
  const paths = [];
  let p = null;
  let n = 0;
  for (let i = 0; i < ops.length; i++) {
    switch (ops[i]) {
      case OP.pathStart: p = new Path2D(); break;
      case OP.pathEnd: paths.push(p); break;
      case OP.closePath: p.closePath(); break;
      case OP.moveTo: p.moveTo(nums[n], nums[n + 1]); n += 2; break;
      case OP.lineTo: p.lineTo(nums[n], nums[n + 1]); n += 2; break;
      case OP.bezierCurveTo: p.bezierCurveTo(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], nums[n + 5]); n += 6; break;
      case OP.quadraticCurveTo: p.quadraticCurveTo(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.arc: p.arc(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], !!nums[n + 5]); n += 6; break;
      case OP.arcTo: p.arcTo(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4]); n += 5; break;
      case OP.ellipse: p.ellipse(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], nums[n + 5], nums[n + 6], !!nums[n + 7]); n += 8; break;
      case OP.rect: p.rect(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.roundRect: {
        const x = nums[n], y = nums[n + 1], w = nums[n + 2], h = nums[n + 3], count = nums[n + 4];
        n += 5;
        p.roundRect(x, y, w, h, Array.from(nums.subarray(n, n + count)));
        n += count;
        break;
      }
    }
  }
  return paths;
}

export function parseTrace(buffer) {
  const data = new Uint8Array(buffer);
  const headLength = new DataView(buffer).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(data.subarray(4, 4 + headLength)));
  let at = 4 + headLength;
  const take = (size) => data.subarray(at, (at += size));
  const ops = take(head.opCount);
  const numBytes = take(head.numBytes);
  const pathOps = take(head.pathOpCount);
  const pathBytes = take(head.pathNumBytes);
  const sheetData = (head.sheetInfo ?? []).map((sheet) => ({ type: sheet.type, bytes: take(sheet.size) }));
  const kinds = new Uint8Array(head.numCount);
  const scale = { ...SCALE, ...head.scale };
  const nums = decodeNumbers(ops, numBytes, head.numCount, head.frameOps, head.frameNums, kinds, scale);
  const pathNums = decodeNumbers(pathOps, pathBytes, head.pathNumCount, [0, head.pathOpCount], [0, head.pathNumCount], null, scale);
  // dos cuadros seguidos con las mismas operaciones se pueden interpolar
  const same = new Uint8Array(head.frames);
  let longest = 0;
  for (let f = 0; f < head.frames; f++) {
    longest = Math.max(longest, head.frameNums[f + 1] - head.frameNums[f]);
    // con partículas que nacen y mueren, el mismo lugar de la lista no es la misma partícula: no se interpola
    if (f === head.frames - 1 || head.interpolate === false) continue;
    const a = head.frameOps[f], b = head.frameOps[f + 1], length = b - a;
    if (head.frameOps[f + 2] - b !== length) continue;
    let equal = 1;
    for (let i = 0; i < length; i++) if (ops[a + i] !== ops[b + i]) { equal = 0; break; }
    same[f] = equal;
  }
  return { ...head, ops, nums, kinds, same, sheetData, sheets: [], mix: new Float32Array(longest), paths: buildPaths(pathOps, pathNums), frameOps: Uint32Array.from(head.frameOps), frameNums: Uint32Array.from(head.frameNums) };
}

export async function loadSheets(trace) {
  trace.sheets = await Promise.all(trace.sheetData.map(({ type, bytes }) => createImageBitmap(new Blob([bytes], { type }))));
  trace.sheetData = [];
  return trace;
}

export async function loadTrace(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  const zipped = await response.arrayBuffer();
  const trace = parseTrace(await unzip(zipped));
  trace.bytes = zipped.byteLength;
  return loadSheets(trace);
}

function makeGradient(c, g, strings) {
  const out = g.t === "l" ? c.createLinearGradient(...g.a) : g.t === "r" ? c.createRadialGradient(...g.a) : c.createConicGradient(...g.a);
  for (const [offset, color] of g.s) out.addColorStop(offset, strings[color]);
  return out;
}

export function makeGradients(c, trace) {
  return trace.gradientDefs.map((g) => makeGradient(c, g, trace.strings));
}

/* Dibuja un cuadro. k es la escala (2 = el doble de píxeles que la grabación); ox y oy, el desplazamiento para centrarlo. */
export function drawFrame(c, trace, frame, k, gradients, between = 0, ox = 0, oy = 0) {
  const { ops, strings } = trace;
  let nums = trace.nums;
  let n = trace.frameNums[frame];
  const end = trace.frameOps[frame + 1];
  if (between > 0 && trace.same[frame]) {
    const a = n, b = trace.frameNums[frame + 1], { mix, kinds } = trace;
    for (let j = 0, length = b - a; j < length; j++) {
      const x = nums[a + j], y = nums[b + j], kind = kinds[a + j];
      // un salto grande (un ángulo que da la vuelta) no se interpola
      mix[j] = (kind === 1 && Math.abs(y - x) < 48) || (kind === 2 && Math.abs(y - x) < 1.5) ? x + (y - x) * between : x;
    }
    nums = mix;
    n = 0;
  }
  let path = null;
  c.setTransform(k, 0, 0, k, ox, oy);
  for (let i = trace.frameOps[frame]; i < end; i++) {
    switch (ops[i]) {
      case OP.save: c.save(); break;
      case OP.restore: c.restore(); break;
      case OP.scale: c.scale(nums[n], nums[n + 1]); n += 2; break;
      case OP.rotate: c.rotate(nums[n++]); break;
      case OP.translate: c.translate(nums[n], nums[n + 1]); n += 2; break;
      case OP.transform: c.transform(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], nums[n + 5]); n += 6; break;
      case OP.setTransform: c.setTransform(nums[n] * k, nums[n + 1] * k, nums[n + 2] * k, nums[n + 3] * k, nums[n + 4] * k + ox, nums[n + 5] * k + oy); n += 6; break;
      case OP.resetTransform: c.setTransform(k, 0, 0, k, ox, oy); break;
      case OP.clearRect: c.clearRect(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.fillRect: c.fillRect(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.strokeRect: c.strokeRect(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.beginPath: c.beginPath(); break;
      case OP.closePath: c.closePath(); break;
      case OP.moveTo: c.moveTo(nums[n], nums[n + 1]); n += 2; break;
      case OP.lineTo: c.lineTo(nums[n], nums[n + 1]); n += 2; break;
      case OP.bezierCurveTo: c.bezierCurveTo(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], nums[n + 5]); n += 6; break;
      case OP.quadraticCurveTo: c.quadraticCurveTo(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.arc: c.arc(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], !!nums[n + 5]); n += 6; break;
      case OP.arcTo: c.arcTo(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4]); n += 5; break;
      case OP.ellipse: c.ellipse(nums[n], nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], nums[n + 5], nums[n + 6], !!nums[n + 7]); n += 8; break;
      case OP.rect: c.rect(nums[n], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.roundRect: {
        const x = nums[n], y = nums[n + 1], w = nums[n + 2], h = nums[n + 3], count = nums[n + 4];
        n += 5;
        c.roundRect(x, y, w, h, Array.from(nums.subarray(n, n + count)));
        n += count;
        break;
      }
      case OP.fill: c.fill(RULES[nums[n++]]); break;
      case OP.stroke: c.stroke(); break;
      case OP.clip: c.clip(RULES[nums[n++]]); break;
      case OP.fillText: c.fillText(strings[nums[n]], nums[n + 1], nums[n + 2]); n += 3; break;
      case OP.strokeText: c.strokeText(strings[nums[n]], nums[n + 1], nums[n + 2]); n += 3; break;
      case OP.fillTextFit: c.fillText(strings[nums[n]], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.strokeTextFit: c.strokeText(strings[nums[n]], nums[n + 1], nums[n + 2], nums[n + 3]); n += 4; break;
      case OP.setLineDash: { const count = nums[n++]; c.setLineDash(Array.from(nums.subarray(n, n + count))); n += count; break; }
      case OP.fillStyle: c.fillStyle = strings[nums[n++]]; break;
      case OP.strokeStyle: c.strokeStyle = strings[nums[n++]]; break;
      case OP.fillGradient: c.fillStyle = gradients[nums[n++]]; break;
      case OP.strokeGradient: c.strokeStyle = gradients[nums[n++]]; break;
      case OP.globalAlpha: c.globalAlpha = nums[n++]; break;
      case OP.globalCompositeOperation: c.globalCompositeOperation = strings[nums[n++]]; break;
      case OP.lineWidth: c.lineWidth = nums[n++]; break;
      case OP.lineCap: c.lineCap = strings[nums[n++]]; break;
      case OP.lineJoin: c.lineJoin = strings[nums[n++]]; break;
      case OP.miterLimit: c.miterLimit = nums[n++]; break;
      case OP.lineDashOffset: c.lineDashOffset = nums[n++]; break;
      case OP.font: c.font = strings[nums[n++]]; break;
      case OP.textAlign: c.textAlign = strings[nums[n++]]; break;
      case OP.textBaseline: c.textBaseline = strings[nums[n++]]; break;
      // las sombras no siguen la transformación del canvas: se escalan aparte
      case OP.shadowBlur: c.shadowBlur = nums[n++] * k; break;
      case OP.shadowColor: c.shadowColor = strings[nums[n++]]; break;
      case OP.shadowOffsetX: c.shadowOffsetX = nums[n++] * k; break;
      case OP.shadowOffsetY: c.shadowOffsetY = nums[n++] * k; break;
      case OP.usePath: path = trace.paths[nums[n++]]; break;
      case OP.fillPath: c.fill(path, RULES[nums[n++]]); break;
      case OP.strokePath: c.stroke(path); break;
      case OP.clipPath: c.clip(path, RULES[nums[n++]]); break;
      case OP.smoothing: c.imageSmoothingEnabled = !!nums[n++]; break;
      case OP.drawSprite: {
        const sheet = trace.sheets[nums[n]];
        if (sheet) c.drawImage(sheet, nums[n + 1], nums[n + 2], nums[n + 3], nums[n + 4], nums[n + 5], nums[n + 6], nums[n + 7], nums[n + 8]);
        n += 9;
        break;
      }
    }
  }
}

/* Dibuja una grabación llenando su canvas (sin deformarla). Los últimos cuadros se funden con los primeros. */
export class TracePlayer {
  constructor(canvas, trace, { contain = false } = {}) {
    this.canvas = canvas;
    this.trace = trace;
    this.contain = contain; // true: se ve completa; false: llena el módulo y recorta los lados
    this.c = canvas.getContext("2d");
    this.blend = trace.overlap ? document.createElement("canvas") : null;
    this.blendC = this.blend ? this.blend.getContext("2d") : null;
    this.gradients = new Map();
    this.k = 1; this.ox = 0; this.oy = 0;
  }
  fit() {
    const { canvas, trace } = this;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (cw < 4 || ch < 4) return false;
    // si un contenedor la escala (celular o acercar), se redibuja a ese tamaño en vez de agrandar la imagen
    const zoom = Math.max(0.5, Math.min(4, canvas.getBoundingClientRect().width / cw));
    const res = Math.min(4, Math.min(window.devicePixelRatio || 1, 2) * zoom);
    const w = Math.max(1, Math.round(cw * res)), h = Math.max(1, Math.round(ch * res));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (this.blend && (this.blend.width !== w || this.blend.height !== h)) { this.blend.width = w; this.blend.height = h; }
    this.k = (this.contain ? Math.min : Math.max)(w / trace.w, h / trace.h);
    this.ox = (w - trace.w * this.k) / 2;
    this.oy = (h - trace.h * this.k) / 2;
    return true;
  }
  paint(c, frame, between) {
    let gradients = this.gradients.get(c);
    if (!gradients) { gradients = makeGradients(c, this.trace); this.gradients.set(c, gradients); }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.imageSmoothingQuality = "high";
    drawFrame(c, this.trace, frame, this.k, gradients, between, this.ox, this.oy);
    c.restore();
  }
  show(position) {
    if (!this.fit()) return;
    const t = this.trace;
    const frame = Math.floor(position);
    const between = position - frame;
    if (position < t.overlap) {
      this.paint(this.c, t.loop + frame, between);
      this.paint(this.blendC, frame, between);
      const c = this.c;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.shadowColor = "transparent";
      const x = position / t.overlap;
      // fundido real: una imagen baja lo mismo que sube la otra, también sobre fondo transparente
      c.globalAlpha = x * x * (3 - 2 * x);
      c.globalCompositeOperation = "destination-out";
      c.fillStyle = "#000";
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.globalCompositeOperation = "lighter";
      c.drawImage(this.blend, 0, 0);
      c.restore();
    } else this.paint(this.c, frame, between);
  }
}

/* Reproduce varias grabaciones con un solo reloj, para que todas sigan el mismo pulso. */
export class TraceDeck {
  constructor({ rate = 1, frozen = false, isPaused = null, skip = null, onError = null } = {}) {
    this.rate = rate;
    this.frozen = frozen;
    this.isPaused = isPaused;
    this.skip = skip;
    this.onError = onError;
    this.players = new Map();
    this.started = 0;
    this.raf = 0;
    this.visible = true;
    this.tick = this.tick.bind(this);
  }
  set(key, canvas, trace, options) { this.players.set(key, new TracePlayer(canvas, trace, options)); }
  remove(key) { this.players.delete(key); }
  start() {
    if (this.raf) return;
    if (!this.started) this.started = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.visible || document.hidden || (this.isPaused && this.isPaused())) return;
    const seconds = this.frozen ? 1.2 : ((now - this.started) / 1000) * this.rate;
    for (const [key, player] of this.players) {
      if (this.skip && this.skip(key)) continue;
      try {
        player.show((seconds * player.trace.fps) % player.trace.loop);
      } catch (error) {
        this.players.delete(key);
        if (this.onError) this.onError(key, error);
      }
    }
  }
}
