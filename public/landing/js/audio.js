/* Hyro Visuals — motor de audio sintético y silencioso.
   Imita una pista a 124 BPM (groove → build → drop) para que todos los visuales
   de la web reaccionen sin pedir micrófono ni reproducir sonido. */
(function () {
  'use strict';
  const BANDS = 112, WAVE = 512, HIST = 420;
  const spec = new Float32Array(BANDS), peaks = new Float32Array(BANDS), raw = new Float32Array(BANDS);
  const wave = new Float32Array(WAVE), waveR = new Float32Array(WAVE);
  const hist = new Float32Array(HIST);
  const freqs = Array.from({ length: BANDS }, (_, i) => 20 * Math.pow(1000, i / (BANDS - 1)));
  const logF = freqs.map(f => Math.log2(f));
  let head = 0;

  const S = {
    t: 0, dt: 1 / 60, bpm: 124, beat: 0, beatIndex: 0, bar: 0, section: 0,
    kick: 0, snare: 0, hat: 0, bass: 0, bassHz: 55, energy: .7, level: .5,
    rms: -14, peak: -3, tp: 0, tpHold: 0, lufsM: -10, lufsS: -11, corr: .8,
    low: 0, mid: 0, high: 0, onBeat: false
  };

  const fract = x => x - Math.floor(x);
  const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453) * 2 - 1;
  function noise(x) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return hash(i) * (1 - u) + hash(i + 1) * u;
  }
  const gauss = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

  let tpTimer = 0, tpMax = -6;

  function update(now) {
    const t = now / 1000;
    S.dt = S.t ? Math.min(.05, Math.max(.001, t - S.t)) : 1 / 60;
    S.t = t;
    const period = 60 / S.bpm, beats = t / period, beatI = Math.floor(beats), ph = beats - beatI;
    S.onBeat = beatI !== S.beatIndex;
    S.beatIndex = beatI; S.beat = ph;
    const bar = Math.floor(beats / 4) % 16, inBar = beatI % 4;
    const section = bar < 8 ? 0 : bar < 12 ? 1 : 2;
    S.bar = bar; S.section = section;

    const progress = ((bar - 8) * 4 + inBar + ph) / 16;
    const energyTarget = section === 0 ? .72 : section === 1 ? .42 + .45 * progress : 1;
    S.energy += (energyTarget - S.energy) * Math.min(1, S.dt * 4);

    const kickOn = !(section === 1 && bar >= 10);
    S.kick = kickOn ? Math.exp(-ph * 7) : S.kick * .9;
    let sn = inBar % 2 === 1 ? Math.exp(-ph * 6) : 0;
    if (section === 1) {
      const div = bar >= 10 ? 4 : 2, p2 = fract(beats * div);
      sn = Math.max(sn, Math.exp(-p2 * 9) * (.35 + .55 * progress));
    }
    S.snare = sn;
    const hp = fract(beats * 2);
    S.hat = Math.exp(-hp * 14) * (Math.floor(beats * 2) % 2 ? 1 : .45) * (section === 1 ? .6 + .4 * progress : 1);
    const notes = [0, 0, 3, 5, 7, 5, 3, -2];
    S.bassHz = 55 * Math.pow(2, notes[Math.floor(beats / 2) % 8] / 12);
    S.bass = (section === 1 ? .22 : .72 * S.energy) * (.55 + .45 * Math.exp(-ph * 3));

    // Espectro en dB (−96 … 0) → 0…1
    const kickC = Math.log2(52 + 34 * S.kick), bassC = Math.log2(S.bassHz);
    const f1 = Math.log2(520 * Math.pow(2, Math.sin(t * .31) * .5));
    const f2 = Math.log2(1600 * Math.pow(2, Math.sin(t * .23 + 1) * .6));
    const f3 = Math.log2(3300 * Math.pow(2, Math.sin(t * .17 + 2) * .45));
    const lead = (.55 + .45 * Math.sin(t * 2.1)) * S.energy;
    let low = 0, mid = 0, high = 0;
    for (let i = 0; i < BANDS; i++) {
      const f = freqs[i], lf = logF[i];
      let db = -40 - 4.6 * Math.max(0, lf - 6.9) - 11 * Math.pow(Math.max(0, 5.32 - lf), 1.3);
      if (f > 14000) db -= 20 * Math.log2(f / 14000);
      db += S.kick * 27 * gauss(lf, kickC, .62);
      db += S.bass * 23 * gauss(lf, bassC, .32) + S.bass * 13 * gauss(lf, bassC + 1, .28) + S.bass * 7 * gauss(lf, bassC + 1.58, .25);
      db += S.snare * (19 * gauss(lf, 7.64, .55) + 14 * gauss(lf, 11.8, 1.5));
      db += S.hat * 19 * gauss(lf, 13.1, .85);
      db += lead * (13 * gauss(lf, f1, .26) + 11 * gauss(lf, f2, .24) + 9 * gauss(lf, f3, .22));
      db += (S.energy - 1) * 9;
      db += noise(i * .37 + t * 3.3) * 4.2 + hash(i * 3.1 + Math.floor(t * 30)) * 1.4;
      const v = clamp((db + 96) / 96);
      raw[i] = v;
      const cur = spec[i];
      spec[i] = v > cur ? cur + (v - cur) * .6 : cur + (v - cur) * .14;
      peaks[i] = Math.max(spec[i], peaks[i] - S.dt * .22);
      if (f < 250) low += spec[i]; else if (f < 4000) mid += spec[i]; else high += spec[i];
    }
    S.low = low / 40; S.mid = mid / 46; S.high = high / 26;

    // Oscilograma instantáneo (24 ms)
    for (let k = 0; k < WAVE; k++) {
      const tau = k / WAVE * .024;
      let s = S.kick * .78 * Math.sin(6.2832 * (46 + 62 * S.kick) * tau + t * 7)
        + S.bass * .5 * Math.sin(6.2832 * S.bassHz * tau + t * 3)
        + .17 * S.energy * Math.sin(6.2832 * 440 * tau + t * 11) * Math.sin(6.2832 * 3 * tau + t)
        + S.snare * .34 * hash(k * 1.37 + Math.floor(t * 60) * 7.7)
        + S.hat * .12 * hash(k * 7.1 + Math.floor(t * 60) * 3.3);
      s = clamp(s, -1, 1);
      wave[k] = s;
      waveR[k] = clamp(s * .84 + .22 * S.energy * Math.sin(6.2832 * 660 * tau + t * 5) + .08 * hash(k * 3.3 + t * 55), -1, 1);
    }

    // Historial de amplitud (forma de onda desplazable)
    const amp = clamp(.12 + .55 * S.kick * S.energy + .25 * S.snare + .1 * S.hat + .12 * Math.abs(hash(t * 91)) * S.energy);
    hist[head] = amp; head = (head + 1) % HIST;

    // Medidores
    const rmsTarget = -21 + 9 * S.energy + 3.5 * S.kick + 1.2 * S.snare;
    S.rms += (rmsTarget - S.rms) * Math.min(1, S.dt * 8);
    S.peak = Math.min(.3, S.rms + 9 + 3 * S.kick);
    S.level = clamp((S.rms + 30) / 24);
    S.tp = -1.1 + 1.45 * S.kick * S.energy + .25 * hash(t * 13);
    tpMax = Math.max(tpMax, S.tp); tpTimer += S.dt;
    if (tpTimer > .45) { S.tpHold = tpMax; tpMax = -6; tpTimer = 0; }
    S.lufsM += ((S.rms + 3.2) - S.lufsM) * Math.min(1, S.dt * 2.5);
    S.lufsS += ((S.rms + 2.4) - S.lufsS) * Math.min(1, S.dt * .6);
    S.corr = clamp(.72 + .18 * Math.sin(t * .4) + .06 * noise(t * 2), -1, 1);
  }

  function history(i) { return hist[(head - 1 - i + HIST * 2) % HIST]; }

  window.HA = { spec, peaks, raw, wave, waveR, freqs, BANDS, WAVE, HIST, S, update, history, noise, hash };
})();
