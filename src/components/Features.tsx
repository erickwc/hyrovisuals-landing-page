import { useRef, type CSSProperties } from "react";
import { motion, useInView } from "motion/react";
import { usePrefs } from "../lib/prefs";
import { swatches } from "../data/content";
import { EASE, HyroStrip, Reveal, SplitHeading, useLoop } from "./ui";
import "../styles/features.css";

function TileText({ title, text }: { title: string; text: string }) {
  return (
    <div className="tile__txt">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

/* Cada ilustración corre sola mientras está en pantalla. */
function useTileLoop(ms: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-10% 0px -10% 0px" });
  const t = useLoop(ms, inView);
  return { ref, t };
}

/* 1 · Selección de espectros dentro del programa */
const ORDER = [3, 7, 1, 8, 5, 9, 0, 6, 2, 4];
const INIT = [true, false, false, false, true, false, false, true, false, false];

function SpectraTile() {
  const { c } = usePrefs();
  const names = c.spectraNames.slice(0, 10);
  const { ref, t } = useTileLoop(1100);
  const lap = Math.floor(t / ORDER.length);
  const pos = t % ORDER.length;
  const target = ORDER[pos];
  const checked = names.map((_, j) => {
    const k = ORDER.indexOf(j);
    const toggles = lap + (k <= pos ? 1 : 0);
    return INIT[j] !== (toggles % 2 === 1);
  });
  const count = checked.filter(Boolean).length;
  return (
    <>
      <div className="tile__vis sp" ref={ref} aria-hidden="true">
        <div className="sp__head">
          <span>{c.features.ui.list}</span>
          <b>
            {count} {c.features.ui.active}
          </b>
        </div>
        <div className="sp__grid">
          {names.map((n, j) => (
            <div className="sp__row" key={n} data-on={checked[j]} data-hot={j === target}>
              <i />
              <span>{n}</span>
            </div>
          ))}
          <svg className="sp__cursor" viewBox="0 0 24 24" style={{ "--c": target % 2, "--r": Math.floor(target / 2) } as CSSProperties}>
            <path d="M5 3l14 8-6 1.8L10.2 19z" fill="#f4f2ef" stroke="#0a0a0a" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <TileText {...c.features.spectra} />
    </>
  );
}

/* 2 · Se adapta a tu pantalla */
const deskParams = { primary: "#ff2a3d", secondary: "#f4f2ef", sensitivityDb: 1, motion: 1, smoothing: 0.5 };
const HEIGHTS = [20, 34, 26, 40];

function AdaptTile() {
  const { c } = usePrefs();
  const a = c.features.adapt;
  const { ref, t } = useTileLoop(2200);
  const h = HEIGHTS[t % HEIGHTS.length];
  return (
    <>
      <div className="tile__vis ad" ref={ref} aria-hidden="true">
        <div className="hud">
          {a.height} <b>{Math.round(h * 3.4 + 40)} px</b>
        </div>
        <div className="desk" style={{ "--h": `${h}%` } as CSSProperties}>
          <div className="desk__strip">
            <HyroStrip className="desk__cv" panels={["spectrum", "levels"]} params={deskParams} label={c.hero.stripLabel} labels={false} minPanelWidth={50} gap={10} />
          </div>
          <div className="desk__apps">
            <div className="win w1">
              <i>{a.apps[0]}</i>
              <b />
              <b />
            </div>
            <div className="win">
              <i>{a.apps[1]}</i>
            </div>
            <div className="win">
              <i>{a.apps[2]}</i>
            </div>
          </div>
        </div>
      </div>
      <TileText title={a.title} text={a.text} />
    </>
  );
}

/* 3 · Temáticas y paletas (sin caja dentro de otra caja) */
const SCENES = [
  { theme: 0, pal: 0, mode: 2 },
  { theme: 1, pal: 2, mode: 2 },
  { theme: 2, pal: 3, mode: 1 },
  { theme: 3, pal: 1, mode: 0 },
  { theme: 4, pal: 4, mode: 0 },
  { theme: 2, pal: 0, mode: 2 },
];
const PAL = ["#ff2a3d", "#ff8a1f", "#2ad4ff", "#b6ff2a", "#a855ff"];
const MODE_INK = ["#0a0a0a", "#f4f2ef", "#f4f2ef"];

function ModesTile() {
  const { c } = usePrefs();
  const m = c.features.modes;
  const u = c.features.ui;
  const { ref, t } = useTileLoop(2200);
  const sc = SCENES[t % SCENES.length];
  const acc = PAL[sc.pal];
  const params = { primary: acc, secondary: sc.mode === 0 ? "#555" : "#f4f2ef", sensitivityDb: 2, motion: 1, smoothing: 0.5 };
  return (
    <>
      <div className="tile__vis mo" ref={ref} data-mode={sc.mode} style={{ "--acc": acc } as CSSProperties} aria-hidden="true">
        <div className="mo__strip">
          <HyroStrip className="mo__cv" panels={["spectrum", "vu"]} params={params} ink={MODE_INK[sc.mode]} label={c.hero.stripLabel} labels={false} minPanelWidth={60} gap={10} />
        </div>
        <div className="mo__chips">
          {u.themes.map((x, i) => (
            <em key={x} data-on={i === sc.theme}>
              {x}
            </em>
          ))}
        </div>
        <div className="mo__foot">
          <div className="mo__dots">
            {PAL.map((p, i) => (
              <i key={p} data-on={i === sc.pal} style={{ background: p }} />
            ))}
          </div>
          <span>{u.modes[sc.mode]}</span>
        </div>
      </div>
      <TileText title={m.title} text={m.text} />
    </>
  );
}

/* 4 · Personalizable: los controles se mueven solos */
const CFG = [
  { db: 2, mv: 1, sm: 55, sw: 0 },
  { db: 8, mv: 1.7, sm: 20, sw: 2 },
  { db: -4, mv: 0.6, sm: 85, sw: 3 },
  { db: 5, mv: 1.3, sm: 40, sw: 4 },
];

function FakeRange({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <div className="fk">
      <span className="fk__row">
        <span>{label}</span>
        <output>{value}</output>
      </span>
      <span className="fk__track">
        <i style={{ width: `${pct}%` }} />
        <b style={{ left: `${pct}%` }} />
      </span>
    </div>
  );
}

function CustomTile() {
  const { c } = usePrefs();
  const k = c.features.custom;
  const { ref, t } = useTileLoop(2200);
  const cf = CFG[t % CFG.length];
  const s = swatches[cf.sw];
  const params = { primary: s.primary, secondary: s.secondary, sensitivityDb: cf.db, motion: cf.mv, smoothing: cf.sm / 100 };
  return (
    <>
      <div className="tile__vis cu" ref={ref} aria-hidden="true">
        <div className="cu__live">
          <HyroStrip className="cu__cv" panels={["spectrum", "pixels"]} params={params} label={c.hero.stripLabel} labels={false} minPanelWidth={56} gap={10} />
        </div>
        <div className="cu__ctl">
          <div className="sw">
            {swatches.map((x, i) => (
              <i key={x.id} data-on={i === cf.sw} style={{ background: x.primary }} />
            ))}
          </div>
          <FakeRange label={k.sensitivity} pct={((cf.db + 12) / 24) * 100} value={`${cf.db > 0 ? "+" : ""}${cf.db.toFixed(1)} dB`} />
          <FakeRange label={k.motion} pct={((cf.mv - 0.3) / 1.7) * 100} value={`${cf.mv.toFixed(2)}×`} />
          <FakeRange label={k.smoothing} pct={(cf.sm / 95) * 100} value={`${cf.sm}%`} />
        </div>
      </div>
      <TileText title={k.title} text={k.text} />
    </>
  );
}

export function Features() {
  const { c } = usePrefs();
  const f = c.features;
  const tiles = [SpectraTile, AdaptTile, ModesTile, CustomTile];
  return (
    <section id="funciones" aria-labelledby="features-title">
      <div className="wrap">
        <SplitHeading lines={[f.title]} id="features-title" />
        <div className="bento">
          {tiles.map((Tile, i) => (
            <Reveal as="article" className="tile" delay={(i % 2) * 0.1} key={i}>
              <Tile />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Hecho para: solo palabras grandes alineadas; el color cambia al pasar el cursor */
export function Who() {
  const { c } = usePrefs();
  return (
    <section aria-labelledby="who-title" className="whos">
      <div className="wrap">
        <SplitHeading lines={[c.who.title]} id="who-title" />
        <ul className="who">
          {c.who.items.map((it, i) => (
            <li className="wr" key={it.word} data-i={i}>
              <h3>{it.word}</h3>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Pasos */
export function Steps() {
  const { c } = usePrefs();
  return (
    <section aria-labelledby="steps-title">
      <div className="wrap">
        <SplitHeading lines={[c.steps.title]} id="steps-title" />
        <div className="steps">
          <motion.span
            className="steps__line"
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "0px 0px -20% 0px" }}
            transition={{ duration: 1.5, ease: EASE, delay: 0.2 }}
          />
          <ol className="steps__list">
            {c.steps.items.map((s, i) => (
              <Reveal as="li" className="step" key={s.title} delay={i * 0.12}>
                <div className="sn">{i + 1}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
