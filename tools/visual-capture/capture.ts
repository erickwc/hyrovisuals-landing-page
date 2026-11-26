/* Graba las instrucciones de dibujo de las gráficas reales del programa, con su señal demo y un reloj controlado,
   y comprueba que el reproductor deje la misma imagen. No modifica nada en la carpeta del programa. */
// @ts-expect-error módulo JS de la landing
import { OP, OPS, SCALE, parseTrace, loadSheets, drawFrame, makeGradients } from "@player/hyro-trace.js";
// @ts-expect-error módulo JS de la landing
import { COMBOS, BARS, slots } from "@player/hero-combos.js";
import "@hyro/src/typography.css";

let clock = 1000;
performance.now = () => clock;
let pixelRatio = 1; // 2 solo al sacar cuadros para video
Object.defineProperty(window, "devicePixelRatio", { get: () => pixelRatio });

type Out = (name: string, args?: unknown[]) => void;
type Log = { ops: [string, unknown[]][]; raster: boolean; scrolling: boolean; version: number; columns: number; strips: { at: number; image: ImageData }[]; tapeStart: number | null };

let rec: { op: Out; problems: Record<string, number> } | null = null;
let target: CanvasRenderingContext2D | null = null;
let comparing = false;
const problem = (name: string) => { if (rec) rec.problems[name] = (rec.problems[name] ?? 0) + 1; };

// lo que se dibuja en canvas auxiliares se guarda para poder repetirlo como trazos dentro de la gráfica
const logs = new WeakMap<CanvasRenderingContext2D, Log>();
const contextOf = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
const logOf = (c: CanvasRenderingContext2D) => {
  let log = logs.get(c);
  if (!log) { log = { ops: [], raster: false, scrolling: false, version: 0, columns: 0, strips: [], tapeStart: null }; logs.set(c, log); }
  return log;
};
const outFor = (c: CanvasRenderingContext2D): Out | null => {
  if (comparing) return null;
  if (c === target) return rec ? rec.op : null;
  return (name, args = []) => {
    const log = logOf(c);
    if (log.ops.length > 150000) { log.raster = true; log.ops = []; return; }
    log.ops.push([name, args]);
  };
};
const nativeGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: unknown[]) {
  const c = (nativeGetContext as (...a: unknown[]) => unknown).apply(this, args);
  if (args[0] === "2d" && c) contextOf.set(this, c as CanvasRenderingContext2D);
  return c;
} as typeof HTMLCanvasElement.prototype.getContext;
for (const side of ["width", "height"] as const) {
  const d = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, side)!;
  Object.defineProperty(HTMLCanvasElement.prototype, side, {
    ...d,
    set(value) {
      d.set!.call(this, value);
      const c = contextOf.get(this);
      if (c && c !== target) logs.delete(c);
    },
  });
}

const NativePath = window.Path2D;
const pathData = new WeakMap<Path2D, [string, unknown[]][]>();
class RecordedPath extends NativePath {
  constructor(from?: Path2D | string) {
    super(from as Path2D);
    pathData.set(this, from instanceof NativePath ? [...(pathData.get(from) ?? [])] : []);
    if (typeof from === "string") problem("path-svg");
  }
}
window.Path2D = RecordedPath as typeof Path2D;
const pathProto = NativePath.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
for (const name of ["moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arc", "arcTo", "ellipse", "rect", "roundRect", "closePath"]) {
  const original = pathProto[name];
  pathProto[name] = function (this: Path2D, ...args: unknown[]) {
    pathData.get(this)?.push([name, args]);
    return original.apply(this, args);
  };
}
const nativeAddPath = pathProto.addPath;
pathProto.addPath = function (this: Path2D, ...args: unknown[]) { problem("path-add"); return nativeAddPath.apply(this, args); };

const gradientInfo = new WeakMap<CanvasGradient, { t: string; a: number[]; s: [number, string][] }>();
const nativeStop = CanvasGradient.prototype.addColorStop;
CanvasGradient.prototype.addColorStop = function (offset: number, color: string) {
  gradientInfo.get(this)?.s.push([offset, color]);
  return nativeStop.call(this, offset, color);
};
const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
for (const [name, t] of [["createLinearGradient", "l"], ["createRadialGradient", "r"], ["createConicGradient", "c"]] as const) {
  const original = proto[name];
  proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    const g = original.apply(this, args) as CanvasGradient;
    gradientInfo.set(g, { t, a: args as number[], s: [] });
    return g;
  };
}

const rule = (value: unknown) => (value === "evenodd" ? 1 : 0);
let pathEncoder: { op: Out } | null = null;
let pathIds = new Map<string, number>();
const emitPath = (path: Path2D) => {
  const data = pathData.get(path) ?? [];
  const key = JSON.stringify(data.map(([name, args]) => [name, args.map((x) => (typeof x === "number" ? Math.round(x * 4096) : x))]));
  let id = pathIds.get(key);
  if (id === undefined) {
    id = pathIds.size;
    pathIds.set(key, id);
    const out = pathEncoder!.op;
    out("pathStart");
    for (const [name, args] of data) emitBuild(name, args, out);
    out("pathEnd");
  }
  rec!.op("usePath", [id]);
};
function emitBuild(name: string, args: unknown[], out: Out) {
  if (name === "arc") out("arc", [args[0], args[1], args[2], args[3], args[4], args[5] ? 1 : 0]);
  else if (name === "ellipse") out("ellipse", [...args.slice(0, 7), args[7] ? 1 : 0]);
  else if (name === "roundRect") {
    const r = args[4];
    const radii = (Array.isArray(r) ? r : [r ?? 0]) as (number | DOMPointInit)[];
    if (radii.some((x) => typeof x !== "number")) problem("roundRect-point");
    out("roundRect", [args[0], args[1], args[2], args[3], radii.map(Number)]);
  } else out(name, args);
}
const usePath = (c: CanvasRenderingContext2D, out: Out, kind: "fillPath" | "strokePath" | "clipPath", path: Path2D, fillRule?: unknown) => {
  if (c === target) {
    emitPath(path);
    out(kind, kind === "strokePath" ? [] : [rule(fillRule)]);
  } else out("@path", [kind, path, rule(fillRule)]);
};

const direct = ["save", "restore", "scale", "rotate", "translate", "transform", "resetTransform", "clearRect", "fillRect", "strokeRect", "beginPath", "closePath", "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "arc", "arcTo", "ellipse", "rect", "roundRect"];
for (const name of direct) {
  const original = proto[name];
  proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    const out = outFor(this);
    if (out) emitBuild(name, args, out);
    return original.apply(this, args);
  };
}
const nativeSet = proto.setTransform;
proto.setTransform = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
  const out = outFor(this);
  if (out) {
    if (args.length === 6) out("setTransform", args);
    else {
      const m = (args[0] ?? new DOMMatrix()) as DOMMatrix2DInit;
      out("setTransform", [m.a ?? 1, m.b ?? 0, m.c ?? 0, m.d ?? 1, m.e ?? 0, m.f ?? 0]);
    }
  }
  return nativeSet.apply(this, args);
};
for (const [name, plain, withPath] of [["fill", "fill", "fillPath"], ["clip", "clip", "clipPath"]] as const) {
  const original = proto[name];
  proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    const out = outFor(this);
    if (out) {
      if (args[0] instanceof NativePath) usePath(this, out, withPath, args[0], args[1]);
      else out(plain, [rule(args[0])]);
    }
    return original.apply(this, args);
  };
}
const nativeStroke = proto.stroke;
proto.stroke = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
  const out = outFor(this);
  if (out) {
    if (args[0] instanceof NativePath) usePath(this, out, "strokePath", args[0]);
    else out("stroke");
  }
  return nativeStroke.apply(this, args);
};
for (const name of ["fillText", "strokeText"]) {
  const original = proto[name];
  proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    const out = outFor(this);
    if (out) {
      if (args[3] !== undefined) out(`${name}Fit`, [String(args[0]), args[1], args[2], args[3]]);
      else out(name, [String(args[0]), args[1], args[2]]);
    }
    return original.apply(this, args);
  };
}
const nativeDash = proto.setLineDash;
proto.setLineDash = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
  const out = outFor(this);
  if (out) out("setLineDash", [args[0]]);
  return nativeDash.apply(this, args);
};

// imágenes que usa la gráfica (sprites de la mascota, cinta del espectrograma)
// si una imagen cambia (la tinta de Onda espejo), cada versión se apila como otra fila de la misma hoja
// el halo cambia en cada cuadro: cada uno es otra fila de su hoja, guardada en WebP porque es una mancha difuminada
type Sheet = { copies: HTMLCanvasElement[]; rows: Map<number, number>; height: number; tape: Log | null; lossy?: boolean };
let sheetList: Sheet[] = [];
let sheetIds = new Map<object, number>();
let haloPass = false;
let haloCount = 0;
const HALO_SHRINK = 2;
const tapeSheet = (log: Log) => {
  let id = sheetIds.get(log);
  if (id === undefined) {
    id = sheetList.length;
    sheetIds.set(log, id);
    sheetList.push({ copies: [], rows: new Map(), height: 0, tape: log });
  }
  return id;
};
const spriteSheet = (source: HTMLCanvasElement, version: number, lossy = false): [number, number] => {
  let id = sheetIds.get(source);
  if (id === undefined) {
    id = sheetList.length;
    sheetIds.set(source, id);
    sheetList.push({ copies: [], rows: new Map(), height: 0, tape: null, lossy });
  }
  const sheet = sheetList[id];
  let y = sheet.rows.get(version);
  if (y === undefined) {
    // el halo (difuminado) se guarda a la mitad de su tamaño: al estirarlo se ve igual
    const k = lossy ? HALO_SHRINK : 1;
    y = sheet.height;
    sheet.rows.set(version, y);
    const copy = document.createElement("canvas");
    copy.width = Math.ceil(source.width / k); copy.height = Math.ceil(source.height / k);
    sheet.height += copy.height;
    const wasComparing = comparing;
    comparing = true;
    copy.getContext("2d")!.drawImage(source, 0, 0, copy.width, copy.height);
    comparing = wasComparing;
    sheet.copies.push(copy);
  }
  return [id, y];
};
const replay = (log: Log) => {
  for (const [name, args] of log.ops) {
    if (name === "@path") {
      emitPath(args[1] as Path2D);
      rec!.op(args[0] as string, args[0] === "strokePath" ? [] : [args[2]]);
    } else {
      if (name === "setTransform" || name === "resetTransform") problem("layer-transform");
      rec!.op(name, args);
    }
  }
};
const nativeDraw = proto.drawImage;
proto.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
  if (!comparing && this !== target) {
    const log = logOf(this);
    if (args[0] === this.canvas) log.scrolling = true;
    log.raster = true;
  }
  if (!comparing && this === target && rec) {
    const source = args[0];
    if (!(source instanceof HTMLCanvasElement)) problem("drawImage-source");
    else {
      const n = args.slice(1) as number[];
      const [sx, sy, sw, sh, dx, dy, dw, dh] = n.length === 2 ? [0, 0, source.width, source.height, n[0], n[1], source.width, source.height]
        : n.length === 4 ? [0, 0, source.width, source.height, n[0], n[1], n[2], n[3]] : n;
      const c = contextOf.get(source);
      const log = c ? logOf(c) : null;
      if (log?.scrolling) {
        log.tapeStart ??= log.columns - source.width;
        rec.op("drawSprite", [tapeSheet(log), log.columns - source.width - log.tapeStart + sx, sy, sw, sh, dx, dy, dw, dh]);
      } else if (log?.raster || !log || (source.width <= 128 && source.height <= 128)) {
        // imágenes y destellos pequeños: se guardan una vez y se reutilizan
        if (haloPass) {
          const [sheet, row] = spriteSheet(source, -++haloCount, true), k = HALO_SHRINK;
          rec.op("drawSprite", [sheet, Math.floor(sx / k), Math.floor(sy / k) + row, Math.ceil(sw / k), Math.ceil(sh / k), dx, dy, dw, dh]);
        } else {
          const [sheet, row] = spriteSheet(source, log?.version ?? 0);
          rec.op("drawSprite", [sheet, sx, sy + row, sw, sh, dx, dy, dw, dh]);
        }
      } else {
        if (this.globalAlpha !== 1) problem("layer-alpha");
        rec.op("save");
        rec.op("translate", [dx, dy]);
        rec.op("scale", [dw / sw, dh / sh]);
        rec.op("translate", [-sx, -sy]);
        replay(log);
        rec.op("restore");
      }
    }
  }
  return nativeDraw.apply(this, args);
};
const nativePut = proto.putImageData;
proto.putImageData = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
  if (!comparing) {
    if (this === target) problem("putImageData");
    else {
      const log = logOf(this);
      log.raster = true;
      log.version++;
      if (log.scrolling) {
        const image = args[0] as ImageData;
        log.strips.push({ at: log.columns, image: new ImageData(new Uint8ClampedArray(image.data), image.width, image.height) });
        log.columns += image.width;
      }
    }
  }
  return nativePut.apply(this, args);
};
const nativeRead = proto.getImageData;
proto.getImageData = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
  if (!comparing && this === target && rec) problem("getImageData");
  return nativeRead.apply(this, args);
};

const PROPS = ["fillStyle", "strokeStyle", "globalAlpha", "globalCompositeOperation", "lineWidth", "lineCap", "lineJoin", "miterLimit", "lineDashOffset", "font", "textAlign", "textBaseline", "shadowBlur", "shadowColor", "shadowOffsetX", "shadowOffsetY", "imageSmoothingEnabled"] as const;
const nativeProps = new Map<string, PropertyDescriptor>();
const emitProp = (prop: string, value: unknown, out: Out) => {
  if (prop === "imageSmoothingEnabled") out("smoothing", [value ? 1 : 0]);
  else if ((prop === "fillStyle" || prop === "strokeStyle") && typeof value !== "string") {
    if (value instanceof CanvasGradient) out(prop === "fillStyle" ? "fillGradient" : "strokeGradient", [value]);
    else problem("pattern");
  } else out(prop, [value]);
};
for (const prop of PROPS) {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, prop)!;
  nativeProps.set(prop, d);
  Object.defineProperty(CanvasRenderingContext2D.prototype, prop, {
    ...d,
    set(value) {
      d.set!.call(this, value);
      const out = outFor(this);
      if (out) emitProp(prop, d.get!.call(this), out);
    },
  });
}
const filterProp = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, "filter")!;
Object.defineProperty(CanvasRenderingContext2D.prototype, "filter", {
  ...filterProp,
  set(value) { if (rec && this === target && value !== "none") problem("filter"); filterProp.set!.call(this, value); },
});

function createEncoder(scale: Record<string, number> = SCALE) {
  const ops: number[] = [];
  const bytes: number[] = [];
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  const gradients: { t: string; a: number[]; s: [number, number][] }[] = [];
  const gradientIndex = new Map<string, number>();
  const last = new Map<number, number>();
  let numCount = 0;
  const text = (s: string) => {
    let i = stringIndex.get(s);
    if (i === undefined) { i = strings.length; strings.push(s); stringIndex.set(s, i); }
    return i;
  };
  const gradient = (g: CanvasGradient) => {
    const info = gradientInfo.get(g)!;
    const def = { t: info.t, a: info.a.map((x) => Math.round(x * 100) / 100), s: info.s.map(([o, color]) => [Math.round(o * 10000) / 10000, text(color)] as [number, number]) };
    const key = JSON.stringify(def);
    let i = gradientIndex.get(key);
    if (i === undefined) { i = gradients.length; gradients.push(def); gradientIndex.set(key, i); }
    return i;
  };
  const varint = (value: number) => {
    let v = value >= 0 ? value * 2 : -value * 2 - 1;
    while (v >= 128) { bytes.push((v % 128) | 128); v = Math.floor(v / 128); }
    bytes.push(v);
  };
  let beforeSlots: number[] = [], beforeValues: number[] = [], slots: number[] = [], values: number[] = [];
  const nextFrame = () => { beforeSlots = slots; beforeValues = values; slots = []; values = []; };
  const put = (slot: number, scaled: number) => {
    const value = Math.round(scaled);
    const at = slots.length;
    const same = at < beforeSlots.length && beforeSlots[at] === slot + 1;
    varint(value - (same ? beforeValues[at] : last.get(slot) ?? 0));
    last.set(slot, value);
    slots.push(slot + 1); values.push(value);
    numCount++;
  };
  const op: Out = (name, args = []) => {
    const code = OP[name];
    if (code === undefined) throw new Error(`operación desconocida ${name}`);
    const types: string = OPS[code][1];
    ops.push(code);
    for (let a = 0; a < types.length; a++) {
      const type = types[a];
      const value = args[a];
      const slot = code * 16 + a;
      if (type === "*") {
        const list = value as number[];
        put(slot, list.length);
        for (const x of list) put(slot + 8, x * scale.c);
      } else if (type === "s") put(slot, text(String(value)));
      else if (name === "fillGradient" || name === "strokeGradient") put(slot, gradient(value as CanvasGradient));
      else put(slot, Number(value) * scale[type]);
    }
  };
  return { op, nextFrame, ops, bytes, strings, gradients, get numCount() { return numCount; } };
}

// cede el hilo sin setTimeout: con la página en segundo plano el navegador frena los temporizadores y la grabación se para
const nextPaint = () => new Promise<void>((done) => { const ch = new MessageChannel(); ch.port1.onmessage = () => done(); ch.port2.postMessage(0); });
async function zip(data: Uint8Array) {
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
}
const blobBytes = async (canvas: HTMLCanvasElement, type: string, quality?: number) => {
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), type, quality));
  return { type: blob.type, bytes: new Uint8Array(await blob.arrayBuffer()) };
};

/* La canción de referencia (audio/song.mp3, no se sube al repositorio) suena a 95 BPM. Se graba un tramo que
   empieza en un compás, con el mismo análisis que hace el programa con un archivo: ventana de 4096 muestras,
   espectro y medidores (RMS, pico, LUFS, VU) procesados muestra a muestra. */
const SONG = { url: "/audio/song.mp3", bpm: 95, start: 121.275 };
const BAR = (4 * 60) / SONG.bpm;
// El inicio usa 12 compases seguidos desde el «drop» de 70,7 s (justo después de un corte): cada combinación de
// hero-combos.js toma los 2 siguientes, así las gráficas siguen la canción de una combinación a la otra.
const SECTION = SONG.start - 20 * BAR;
// 150 pasos por compás (unos 59 por segundo): todos los bucles duran compases enteros y siguen el mismo pulso
const STEPS_PER_BAR = 150;
const FPS = STEPS_PER_BAR / BAR;
const OVERLAP = 60;
const WARM_UP_BARS = 6;

/* Los ajustes del programa de Erick (colores, estilo Clásico y ajustes individuales de cada gráfica). */
const SETTINGS = {
  theme: "ember", customColor: "#ff0000", customSecondary: "#ffffff", style: "classic",
  intensity: 1.5, sensitivity: 1.1885022274370185, smoothing: 0.95, vuReference: -10,
  // en la web el espectrograma corre 3× y las efemérides van a menos de la mitad: con la canción (muy fuerte) todas las
  // bandas llegaban al borde y se veía un círculo lleno
  mirrorSpeed: 1, mirrorGlow: 0, spectrogramSpeed: 3, phaseCoreSpeed: 1,
  moduleSensitivity: { pixelorb: 3, dna: 1.42, mascot: 2.25, ephemeris: 0.45 } as Record<string, number>,
  moduleTuning: {
    phase: { thickness: 1.3 },
    pixelorb: { transients: 1.7, shape: "rectangle" },
    mirror: { thickness: 1.1, mirrorBlend: "primary" },
    // en el programa va a 0.25× y transientes 120 %; en la web se mueve más rápido y salta más con cada golpe
    dna: { speed: 2, transients: 1.6, thickness: 1.3, halo: 0.6 },
    mascot: { transients: 2 },
  },
};
// En la web todas reaccionan más que en el programa, para que se note el audio: transientes al máximo (2) en las
// gráficas del inicio y sensibilidad general más fuerte (los refuerzos de cada gráfica se mantienen).
// Las ondas cromáticas quedan como en el programa: Erick las quiere así.
const KEEP = ["rgbwaves"];
SETTINGS.moduleSensitivity.rgbwaves = SETTINGS.sensitivity / 1.6;
// las efemérides quedan como Erick las aprobó (0,45 con la sensibilidad anterior): más fuerte vuelven a llenar el círculo
SETTINGS.moduleSensitivity.ephemeris = (0.45 * SETTINGS.sensitivity) / 1.6;
SETTINGS.sensitivity = 1.6;
for (const [id] of (COMBOS as [string, number][][][]).flat(2)) {
  if (KEEP.includes(id)) continue;
  const tune = SETTINGS.moduleTuning as Record<string, Record<string, unknown>>;
  tune[id] = { ...tune[id], transients: 2 };
}

class SongEngine {
  private left = new Float32Array(4096);
  private right = new Float32Array(4096);
  private fft: { analyze: (l: Float32Array, r: Float32Array, s: number) => Float32Array; instantaneous: Float32Array };
  private programme: { process: (l: Float32Array, r: Float32Array) => void; read: () => object };
  private stereo: { process: (l: Float32Array, r: Float32Array) => void; read: () => object };
  private vu: { process: (l: Float32Array, r: Float32Array) => void; read: () => { rms: unknown } };
  private done: number;
  private blocks = 0;
  private metrics: object;
  constructor(private L: Float32Array, private R: Float32Array, private rate: number, from: number, lib: SongLib) {
    this.fft = new lib.SpectrumAnalyzer();
    this.programme = new lib.ProgrammeMeter(rate);
    this.stereo = new lib.StereoMeter(rate);
    this.vu = new lib.StereoMeter(rate, 0.02);
    this.metrics = lib.emptyMetrics();
    this.done = Math.max(0, Math.floor(from * rate) - rate * 3);
  }
  frame(seconds: number, smoothing: number) {
    const end = Math.min(this.L.length, Math.floor(seconds * this.rate));
    // como el worklet del programa: bloques de 128 muestras y una lectura cada 512
    for (; this.done + 128 <= end; this.done += 128) {
      const l = this.L.subarray(this.done, this.done + 128), r = this.R.subarray(this.done, this.done + 128);
      this.programme.process(l, r); this.stereo.process(l, r); this.vu.process(l, r);
      if (++this.blocks % 4 === 0) this.metrics = { ...this.programme.read(), ...this.stereo.read(), vuRms: this.vu.read().rms };
    }
    for (let i = 0; i < 4096; i++) {
      const at = end - 4096 + i;
      this.left[i] = at >= 0 ? this.L[at] : 0;
      this.right[i] = at >= 0 ? this.R[at] : 0;
    }
    return { left: this.left, right: this.right, spectrum: this.fft.analyze(this.left, this.right, smoothing), spectrumInstant: this.fft.instantaneous, spectrumSmoothing: smoothing, metrics: this.metrics, sampleRate: this.rate, time: seconds };
  }
}
type SongLib = { SpectrumAnalyzer: new () => SongEngine["fft"]; ProgrammeMeter: new (rate: number) => SongEngine["programme"]; StereoMeter: new (rate: number, seconds?: number) => SongEngine["stereo"] & SongEngine["vu"]; emptyMetrics: () => object };

let song: Promise<{ L: Float32Array; R: Float32Array; rate: number }> | null = null;
const loadSong = () => (song ??= (async () => {
  const bytes = await (await fetch(SONG.url)).arrayBuffer();
  const buffer = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(bytes);
  return { L: buffer.getChannelData(0), R: buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0), rate: buffer.sampleRate };
})());

// every: 2 = guarda un cuadro de cada dos (unos 30 por segundo); el reproductor calcula los intermedios. Sin every: los 59 reales
// at: compás del tramo donde empieza; bars: largo de la grabación en compases
// rec: tamaño al que se graba respecto a su lugar (las de miles de puntos se graban más chicas y se redibujan grandes)
type Job = { id: string; module: string; w: number; h: number; at?: number; every?: number; bars?: number; interpolate?: boolean; scale?: { c: number; r: number } };
const HEAVY: Record<string, Partial<Job> & { rec?: number }> = {
  // ADN: miles de partículas, a 15 cuadros por segundo y con coordenadas de 1/8 px
  dna: { every: 4, scale: { c: 8, r: 1000 }, rec: 0.75 },
  // muchas curvas por cuadro: a 30 cuadros por segundo, el reproductor calcula los intermedios
  phasecore: { every: 2 },
  // líneas que se desplazan: los intermedios mezclan puntos que suben y bajan mucho y la línea tiembla, así que van a
  // 60 cuadros reales sin intermedios
  threads: { interpolate: false }, wavetrail: { interpolate: false }, dynamics: { interpolate: false },
  tunerpiano: { interpolate: false }, mirror: { interpolate: false },
};
// una grabación por lugar de cada combinación, justo a su tamaño (2 filas en 1240 × 540)
const JOBS: Job[] = (COMBOS as unknown[]).flatMap((_, i) => (slots(i) as { id: string; module: string; w: number; h: number }[]).map((slot) => {
  const { rec = 1, ...extra } = HEAVY[slot.module] ?? {};
  return { id: slot.id, module: slot.module, w: Math.round(slot.w * rec), h: Math.round(slot.h * rec), at: i * BARS, bars: BARS, ...extra };
}));

async function record(job: Job, theme: "dark" | "light") {
  const [{ Visualizer }, tuning, mirror, dsp, programme, stereo, audio] = await Promise.all([
    import("@hyro/src/visuals/modules"), import("@hyro/src/visuals/tuning"), import("@hyro/src/visuals/mirror"), import("@hyro/src/audio/dsp"),
    import("@hyro/public/programme-meter.js"), import("@hyro/public/stereo-meter.js"), loadSong(),
  ]);
  await Promise.all([document.fonts.load('500 12px "Space Grotesk"'), document.fonts.ready]);
  tuning.setModuleTuning(SETTINGS.moduleTuning as never);
  mirror.setMirrorGlow(SETTINGS.mirrorGlow);
  const halo = tuning.Halo.prototype as unknown as { apply: (...a: unknown[]) => void; __wrapped?: boolean };
  if (!halo.__wrapped) {
    const native = halo.apply;
    halo.apply = function (this: unknown, ...args: unknown[]) { haloPass = true; try { native.apply(this, args); } finally { haloPass = false; } };
    halo.__wrapped = true;
  }
  const stage = document.getElementById("stage")!;
  stage.innerHTML = `<canvas style="width:${job.w}px;height:${job.h}px"></canvas>`;
  const canvas = stage.querySelector("canvas")!;
  clock = 1000;
  const from = SECTION + (job.at ?? 0) * BAR - WARM_UP_BARS * BAR;
  const engine = new SongEngine(audio.L, audio.R, audio.rate, from, { SpectrumAnalyzer: dsp.SpectrumAnalyzer, ProgrammeMeter: programme.ProgrammeMeter, StereoMeter: stereo.StereoMeter, emptyMetrics: dsp.emptyMetrics } as unknown as SongLib);
  let steps = 0;
  // mismo contexto de software que la comprobación, para comparar píxel contra píxel
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  target = context;
  rec = null;
  const v = new Visualizer(canvas, job.module as never);
  v.measure();
  const s = SETTINGS;
  // Space Black y Space White, como el modo «Según sistema» del programa
  const mode = theme === "dark" ? "black" : "light";
  const step = () => {
    clock += 1000 / FPS;
    const frame = engine.frame(from + (steps++ * BAR) / STEPS_PER_BAR, s.smoothing);
    v.draw(frame as never, s.theme as never, s.intensity, clock, s.vuReference, s.style as never, mode, s.customColor, s.sensitivity * (s.moduleSensitivity[job.module] || 1), "off", s.customSecondary, null, false, s.spectrogramSpeed, s.mirrorSpeed, "left", s.phaseCoreSpeed);
  };
  step();
  if (job.module === "mascot") {
    const began = Date.now();
    while (canvas.dataset.mascotReady !== "true" && Date.now() - began < 8000) { await new Promise((done) => setTimeout(done, 100)); step(); }
    if (canvas.dataset.mascotReady !== "true") throw new Error("la mascota no cargó");
  }
  // la canción suena desde unos compases antes, para que medidores, estelas y la mascota lleguen con su estado real
  const warmUp = WARM_UP_BARS * STEPS_PER_BAR;
  if (steps > warmUp) throw new Error("el calentamiento pasó el inicio del tramo");
  while (steps < warmUp) { step(); if (steps % 40 === 0) await nextPaint(); }

  const encoder = createEncoder({ ...SCALE, ...job.scale });
  const curves = createEncoder({ ...SCALE, ...job.scale });
  pathEncoder = curves;
  pathIds = new Map();
  sheetList = [];
  sheetIds = new Map();
  const problems: Record<string, number> = {};
  const frameOps: number[] = [];
  const frameNums: number[] = [];
  const checks: { frame: number; image: ImageData }[] = [];
  rec = { op: encoder.op, problems };
  const every = job.every ?? 1;
  const loop = ((job.bars ?? BARS) * STEPS_PER_BAR) / every;
  if (!Number.isInteger(loop)) throw new Error("el bucle no cae en un cuadro entero");
  const overlap = Math.round(OVERLAP / every);
  const total = loop + overlap;
  for (let f = 0; f < total; f++) {
    // el cuadro guardado va primero: todas las gráficas muestran el mismo instante de la canción
    if (f) for (let skip = 1; skip < every; skip++) { const saved = rec; rec = null; step(); rec = saved; }
    frameOps.push(encoder.ops.length);
    frameNums.push(encoder.numCount);
    encoder.nextFrame();
    // el estado completo al inicio de cada cuadro permite saltar cuadros sin que cambie la imagen
    for (const prop of PROPS) emitProp(prop, nativeProps.get(prop)!.get!.call(context), encoder.op);
    encoder.op("setLineDash", [context.getLineDash()]);
    step();
    if (f % 23 === 7) {
      const saved = rec; rec = null; comparing = true;
      checks.push({ frame: f, image: context.getImageData(0, 0, canvas.width, canvas.height) });
      comparing = false; rec = saved;
    }
    if (f % 20 === 0) await nextPaint();
  }
  rec = null;
  frameOps.push(encoder.ops.length);
  frameNums.push(encoder.numCount);

  // las imágenes: la cinta del espectrograma se arma con las columnas que llegaron
  const sheets: { type: string; bytes: Uint8Array }[] = [];
  for (const sheet of sheetList) {
    if (sheet.tape) {
      const tape = sheet.tape, start = tape.tapeStart ?? 0;
      const out = document.createElement("canvas");
      out.width = tape.columns - start;
      out.height = tape.strips[0].image.height;
      const oc = out.getContext("2d")!;
      comparing = true;
      for (const { at, image } of tape.strips) {
        if (at + image.width > start) oc.putImageData(image, at - start, 0);
      }
      comparing = false;
      sheets.push(await blobBytes(out, "image/webp", 0.92));
    } else {
      const out = document.createElement("canvas");
      out.width = sheet.copies[0].width;
      out.height = sheet.height;
      const oc = out.getContext("2d")!;
      comparing = true;
      let y = 0;
      for (const copy of sheet.copies) { oc.drawImage(copy, 0, y); y += copy.height; }
      comparing = false;
      sheets.push(sheet.lossy ? await blobBytes(out, "image/webp", 0.72) : await blobBytes(out, "image/png"));
    }
  }
  v.dispose();
  target = null;

  const sheetInfo = sheets.map((s) => ({ type: s.type, size: s.bytes.length }));
  const head = { v: 2, id: job.id, theme, scale: job.scale, interpolate: job.interpolate !== false, w: canvas.width, h: canvas.height, fps: FPS / every, loop, overlap, frames: total, opCount: encoder.ops.length, numCount: encoder.numCount, numBytes: encoder.bytes.length, pathOpCount: curves.ops.length, pathNumCount: curves.numCount, pathNumBytes: curves.bytes.length, sheetInfo, strings: encoder.strings, gradientDefs: encoder.gradients, frameOps, frameNums };
  const headBytes = new TextEncoder().encode(JSON.stringify(head));
  const parts: ArrayLike<number>[] = [encoder.ops, encoder.bytes, curves.ops, curves.bytes, ...sheets.map((s) => s.bytes)];
  const raw = new Uint8Array(4 + headBytes.length + parts.reduce((a, p) => a + p.length, 0));
  new DataView(raw.buffer).setUint32(0, headBytes.length, true);
  raw.set(headBytes, 4);
  let cursor = 4 + headBytes.length;
  for (const part of parts) { raw.set(part, cursor); cursor += part.length; }
  const zipped = await zip(raw);

  // comprobación: el reproductor debe dejar la misma imagen que el programa
  comparing = true;
  const trace = parseTrace(raw.buffer.slice(0));
  await loadSheets(trace);
  const test = document.createElement("canvas");
  test.width = canvas.width; test.height = canvas.height;
  const tc = test.getContext("2d", { willReadFrequently: true })!;
  const defs = makeGradients(tc, trace);
  const bg = theme === "dark" ? [0, 0, 0] : [255, 255, 255];
  // una línea de 1 px movida 1/32 de píxel ya cambia su borde unos 8 tonos: se cuenta como distinto lo que se nota
  let sum = 0, samples = 0, changed = 0;
  for (const { frame, image } of checks) {
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.clearRect(0, 0, test.width, test.height);
    tc.save();
    drawFrame(tc, trace, frame, 1, defs);
    tc.restore();
    const got = tc.getImageData(0, 0, test.width, test.height).data;
    const want = image.data;
    for (let i = 0; i < want.length; i += 4) {
      const over = (src: ArrayLike<number>, ch: number) => (src[i + ch] * src[i + 3] + bg[ch] * (255 - src[i + 3])) / 255;
      const e = Math.max(Math.abs(over(got, 0) - over(want, 0)), Math.abs(over(got, 1) - over(want, 1)), Math.abs(over(got, 2) - over(want, 2)));
      if (e > 32) changed++;
      sum += e; samples++;
    }
  }
  comparing = false;
  const name = `${job.id}-${theme}`;
  const saved = await fetch(`/save?name=${name}.hvt`, { method: "POST", body: zipped });
  const smooth = trace.frames > 1 ? Math.round((trace.same.reduce((a: number, x: number) => a + x, 0) / (trace.frames - 1)) * 100) : 0;
  return { name, smooth, kb: Math.round(zipped.length / 102.4) / 10, ops: Math.round(encoder.ops.length / total), curves: pathIds.size, sheets: sheets.length, problems, same: Math.round((1 - changed / samples) * 10000) / 100, mean: Math.round((sum / samples) * 100) / 100, saved: saved.ok };
}

type State = { results: unknown[]; running: string; done: boolean; error?: string };
const state: State = { results: [], running: "", done: false };
async function runAll(ids?: string[], themes: ("dark" | "light")[] = ["dark", "light"]) {
  state.results = []; state.done = false; state.error = undefined;
  try {
    for (const job of JOBS.filter((j) => !ids || ids.includes(j.id))) {
      for (const theme of themes) {
        state.running = `${job.id}-${theme}`;
        state.results.push(await record(job, theme));
      }
    }
    await fetch("/save?name=index.json", { method: "POST", body: JSON.stringify(state.results, null, 2) });
  } catch (error) {
    state.error = `${state.running}: ${String(error)} ${(error as Error).stack?.slice(0, 400)}`;
  }
  state.done = true;
}
/* Hoja de contactos: todas las gráficas pedidas, con la canción y los ajustes de Erick, para elegir combinaciones. */
async function gallery(ids: string[], w = 300, h = 190, theme: "dark" | "light" = "dark", frames = 200) {
  const [{ Visualizer }, tuning, mirror, dsp, programme, stereo, audio] = await Promise.all([
    import("@hyro/src/visuals/modules"), import("@hyro/src/visuals/tuning"), import("@hyro/src/visuals/mirror"), import("@hyro/src/audio/dsp"),
    import("@hyro/public/programme-meter.js"), import("@hyro/public/stereo-meter.js"), loadSong(),
  ]);
  await document.fonts.ready;
  tuning.setModuleTuning(SETTINGS.moduleTuning as never);
  mirror.setMirrorGlow(SETTINGS.mirrorGlow);
  const stage = document.getElementById("stage")!;
  stage.style.cssText = "display:flex;flex-wrap:wrap;gap:6px";
  const s = SETTINGS, mode = theme === "dark" ? "black" : "light", from = SECTION - 2 * BAR;
  for (const id of ids) {
    const box = document.createElement("div");
    box.style.cssText = "font:11px monospace;color:#aaa";
    box.innerHTML = `<canvas style="width:${w}px;height:${h}px;display:block"></canvas>${id}`;
    stage.appendChild(box);
    const canvas = box.querySelector("canvas")!;
    try {
      const engine = new SongEngine(audio.L, audio.R, audio.rate, from, { SpectrumAnalyzer: dsp.SpectrumAnalyzer, ProgrammeMeter: programme.ProgrammeMeter, StereoMeter: stereo.StereoMeter, emptyMetrics: dsp.emptyMetrics } as unknown as SongLib);
      const v = new Visualizer(canvas, id as never);
      v.measure();
      for (let i = 0; i < frames; i++) {
        clock += 1000 / FPS;
        const frame = engine.frame(from + (i * BAR) / STEPS_PER_BAR, s.smoothing);
        v.draw(frame as never, s.theme as never, s.intensity, clock, s.vuReference, s.style as never, mode, s.customColor, s.sensitivity * (s.moduleSensitivity[id] || 1), "off", s.customSecondary, null, false, s.spectrogramSpeed, s.mirrorSpeed, "left", s.phaseCoreSpeed);
        if (i % 50 === 0) await nextPaint();
      }
    } catch (error) {
      box.append(` ERROR ${String(error).slice(0, 60)}`);
    }
    galleryState.done.push(id);
  }
  galleryState.finished = true;
}
const galleryState = { done: [] as string[], finished: false };

/* Cuadros PNG (a 2× para pantallas retina) de las gráficas de miles de puntos: como trazos pesarían varios MB, como
   video pesan mucho menos. Mismo tramo, reloj y ajustes que las grabaciones; tools/visual-capture/encode.sh los junta. */
async function frames(ids: string[], themes: ("dark" | "light")[] = ["dark", "light"], ratio = 2) {
  const [{ Visualizer }, tuning, mirror, dsp, programme, stereo, audio, themesMod] = await Promise.all([
    import("@hyro/src/visuals/modules"), import("@hyro/src/visuals/tuning"), import("@hyro/src/visuals/mirror"), import("@hyro/src/audio/dsp"),
    import("@hyro/public/programme-meter.js"), import("@hyro/public/stereo-meter.js"), loadSong(), import("@hyro/src/themes"),
  ]);
  await Promise.all([document.fonts.load('500 12px "Space Grotesk"'), document.fonts.ready]);
  tuning.setModuleTuning(SETTINGS.moduleTuning as never);
  mirror.setMirrorGlow(SETTINGS.mirrorGlow);
  framesState.done = []; framesState.finished = false; framesState.error = "";
  const s = SETTINGS;
  try {
    for (const job of JOBS.filter((j) => ids.includes(j.id))) {
      for (const theme of themes) {
        const mode = theme === "dark" ? "black" : "light";
        const bg = (themesMod as unknown as { resolvePalette: (...a: unknown[]) => { bg: string } }).resolvePalette(s.theme, s.style, mode, s.customColor, s.customSecondary).bg;
        framesState.running = `${job.id}-${theme}`;
        pixelRatio = ratio;
        const stage = document.getElementById("stage")!;
        stage.innerHTML = `<canvas style="width:${job.w}px;height:${job.h}px"></canvas>`;
        const canvas = stage.querySelector("canvas")!;
        clock = 1000;
        const from = SECTION + (job.at ?? 0) * BAR - WARM_UP_BARS * BAR;
        const engine = new SongEngine(audio.L, audio.R, audio.rate, from, { SpectrumAnalyzer: dsp.SpectrumAnalyzer, ProgrammeMeter: programme.ProgrammeMeter, StereoMeter: stereo.StereoMeter, emptyMetrics: dsp.emptyMetrics } as unknown as SongLib);
        let steps = 0;
        const v = new Visualizer(canvas, job.module as never);
        v.measure();
        const step = () => {
          clock += 1000 / FPS;
          const frame = engine.frame(from + (steps++ * BAR) / STEPS_PER_BAR, s.smoothing);
          v.draw(frame as never, s.theme as never, s.intensity, clock, s.vuReference, s.style as never, mode, s.customColor, s.sensitivity * (s.moduleSensitivity[job.module] || 1), "off", s.customSecondary, null, false, s.spectrogramSpeed, s.mirrorSpeed, "left", s.phaseCoreSpeed);
        };
        step();
        if (job.module === "mascot") {
          const began = Date.now();
          while (canvas.dataset.mascotReady !== "true" && Date.now() - began < 8000) { await new Promise((done) => setTimeout(done, 100)); step(); }
        }
        const warmUp = WARM_UP_BARS * STEPS_PER_BAR;
        while (steps < warmUp) { step(); if (steps % 40 === 0) await nextPaint(); }
        // los cuadros llevan el fondo de la gráfica, porque el video no tiene transparencia
        const out = document.createElement("canvas");
        out.width = canvas.width; out.height = canvas.height;
        const oc = out.getContext("2d")!;
        const total = (job.bars ?? BARS) * STEPS_PER_BAR + OVERLAP;
        for (let f = 0; f < total; f++) {
          step();
          oc.fillStyle = bg; oc.fillRect(0, 0, out.width, out.height);
          oc.drawImage(canvas, 0, 0);
          const blob = await new Promise<Blob>((done) => out.toBlob((b) => done(b!), "image/png"));
          await fetch(`/frame?name=${job.id}-${theme}&n=${String(f).padStart(4, "0")}`, { method: "POST", body: blob });
        }
        v.dispose();
        pixelRatio = 1;
        framesState.done.push(`${job.id}-${theme} ${out.width}x${out.height} bg=${bg}`);
      }
    }
  } catch (error) {
    framesState.error = `${framesState.running}: ${String(error)}`;
  }
  pixelRatio = 1;
  framesState.finished = true;
}
const framesState = { done: [] as string[], finished: false, running: "", error: "" };

Object.assign(window, { runAll, captureState: state, gallery, galleryState, JOBS, frames, framesState, SETTINGS });
document.title = "capture-ready";
