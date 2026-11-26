/* Combinaciones de gráficas del inicio. Se turnan en una cuadrícula de dos filas, cada una con su tramo de la canción
   de referencia (2 compases seguidos por combinación). La usan app.js (para acomodarlas) y el grabador
   (tools/visual-capture, para grabar cada gráfica justo al tamaño de su lugar). Si cambias algo, vuelve a grabar.
   Cada fila: [gráfica del programa, fracción del ancho]. */
export const STAGE = { w: 1240, h: 540 };
export const BARS = 2;

// 19 gráficas, ninguna se repite entre combinaciones
export const COMBOS = [
  [[['spectrogram', .33], ['spectrum', .37], ['vumodern', .30]], [['mascot', .22], ['pixelorb', .46], ['dynamics', .32]]],
  [[['rgbwaves', .44], ['storm', .28], ['comet', .28]], [['dna', .56], ['ephemeris', .44]]],
  [[['wavetrail', .62], ['membrane', .38]], [['phasecore', .45], ['tunerpiano', .55]]],
  [[['threads', .5], ['mirror', .5]], [['sparks', .45], ['synapse', .55]]],
];

/* Lugares en píxeles enteros (las líneas entre gráficas quedan nítidas). Franja e Individual (app.js) usan las mismas
   grabaciones: solo las reacomodan conservando la proporción de cada una. */
function place(rows, prefix, W, H) {
  const out = [];
  rows.forEach((row, r) => {
    const y0 = Math.round((H * r) / rows.length), y1 = Math.round((H * (r + 1)) / rows.length);
    let acc = 0;
    row.forEach(([module, f], i) => {
      const x0 = Math.round(acc * W);
      acc += f;
      const x1 = i === row.length - 1 ? W : Math.round(acc * W);
      out.push({ id: `${prefix}-${module}`, module, x: x0, y: y0, w: x1 - x0, h: y1 - y0, end: i === row.length - 1, bottom: r === rows.length - 1 });
    });
  });
  return out;
}
export const slots = (index, W = STAGE.w, H = STAGE.h) => place(COMBOS[index], `c${index + 1}`, W, H);
