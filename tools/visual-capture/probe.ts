/* Mide qué funciones de canvas usa cada gráfica del programa, para saber cuáles se pueden grabar como trazos. */
let clock = 1000;
performance.now = () => clock;
Object.defineProperty(window, "devicePixelRatio", { get: () => 1 });

type Tally = Record<string, number>;
let tally: Tally = {};
const hit = (name: string, n = 1) => { tally[name] = (tally[name] ?? 0) + n; };
const proto = CanvasRenderingContext2D.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
const watched = ["fill", "stroke", "fillRect", "strokeRect", "clearRect", "lineTo", "moveTo", "arc", "ellipse", "bezierCurveTo", "quadraticCurveTo", "fillText", "strokeText", "clip", "drawImage", "getImageData", "putImageData", "createLinearGradient", "createRadialGradient", "createConicGradient", "createPattern", "save", "restore"];
for (const name of watched) {
  const original = proto[name];
  proto[name] = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
    hit(name);
    if (name === "drawImage") hit(args[0] instanceof HTMLCanvasElement ? "drawImage:canvas" : "drawImage:other");
    if ((name === "fill" || name === "stroke" || name === "clip") && args[0] instanceof Path2D) hit("path2d");
    return original.apply(this, args);
  };
}
for (const prop of ["filter", "shadowBlur", "globalCompositeOperation"] as const) {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, prop)!;
  Object.defineProperty(CanvasRenderingContext2D.prototype, prop, {
    ...d,
    set(value) {
      if (prop === "filter" && value !== "none") hit("filter");
      if (prop === "shadowBlur" && value) hit("shadowBlur");
      if (prop === "globalCompositeOperation" && value !== "source-over") hit("blend");
      d.set!.call(this, value);
    },
  });
}

const [{ Visualizer }, { AudioEngine }, { moduleIds }] = await Promise.all([
  import("@hyro/src/visuals/modules"),
  import("@hyro/src/audio/engine"),
  import("@hyro/src/settings"),
]);

async function probe(frames = 120) {
  const stage = document.getElementById("stage")!;
  const rows = [];
  for (const id of moduleIds) {
    // cede el hilo entre gráficas para que la página siga respondiendo
    await new Promise((done) => setTimeout(done));
    (window as unknown as { probeProgress: string }).probeProgress = `${rows.length}/${moduleIds.length}`;
    stage.innerHTML = "<canvas></canvas>";
    const canvas = stage.querySelector("canvas")!;
    const engine = new AudioEngine();
    engine.demo();
    let v;
    try {
      v = new Visualizer(canvas, id);
      v.measure();
      for (let i = 0; i < 180; i++) { clock += 1000 / 60; v.draw(engine.frame(0.72), "original", 1, clock); }
      tally = {};
      const started = Date.now();
      for (let i = 0; i < frames; i++) { clock += 1000 / 60; v.draw(engine.frame(0.72), "original", 1, clock); }
      const t = tally;
      const shapes = (t.lineTo ?? 0) + (t.arc ?? 0) + (t.ellipse ?? 0) + (t.bezierCurveTo ?? 0) + (t.quadraticCurveTo ?? 0) + (t.fillRect ?? 0) + (t.fillText ?? 0);
      rows.push({ id, perFrame: Math.round(shapes / frames), layers: t["drawImage:canvas"] ?? 0, pixels: (t.getImageData ?? 0) + (t.putImageData ?? 0), filter: t.filter ?? 0, pattern: t.createPattern ?? 0, gradients: Math.round(((t.createLinearGradient ?? 0) + (t.createRadialGradient ?? 0) + (t.createConicGradient ?? 0)) / frames), shadows: Math.round((t.shadowBlur ?? 0) / frames), blend: Math.round((t.blend ?? 0) / frames), path2d: t.path2d ?? 0, ms: Date.now() - started });
    } catch (error) {
      rows.push({ id, error: String(error).slice(0, 100) });
    } finally {
      v?.dispose();
      engine.stop();
    }
  }
  return rows;
}

(window as unknown as { probe: typeof probe }).probe = probe;
document.title = "probe-ready";
