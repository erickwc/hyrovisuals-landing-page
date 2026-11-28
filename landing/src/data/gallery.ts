/* Todas las gráficas del programa, en foto (public/gallery/<id>-<tema>.webp). Mismo orden y textos que el
   selector de gráficas de la app. [id, tipo, nombre ES, nombre EN, qué muestra ES, qué muestra EN] */
export type GraphCat = 'meter' | 'wave' | 'gen';
export const CATS: GraphCat[] = ['meter', 'wave', 'gen'];
export const GRAPHS: [string, GraphCat, string, string, string, string][] = [
  ['spectrum', 'wave', 'Espectro', 'Spectrum', 'Energía por frecuencia, de 20 Hz a 20 kHz, en una curva suavizada.', 'Energy per frequency, from 20 Hz to 20 kHz, as a smoothed curve.'],
  ['vumodern', 'meter', 'VU Moderno', 'Modern VU', 'VU de estudio con escala en dB y una luz que se enciende al pasar de 0 VU.', 'Studio VU with a dB scale and a light that turns on past 0 VU.'],
  ['dna', 'gen', 'ADN', 'DNA', 'Corrientes de partículas de color guiadas por frecuencia y pico.', 'Streams of colored particles driven by frequency and peak.'],
  ['membrane', 'gen', 'Membrana', 'Membrane', 'Superficie viva de puntos que se pliega con el sonido.', 'Living surface of dots that folds with the sound.'],
  ['spectrogram', 'wave', 'Espectrograma', 'Spectrogram', 'Frecuencia a lo largo del tiempo, como un mapa de calor que avanza.', 'Frequency over time, as a scrolling heat map.'],
  ['synapse', 'gen', 'Sinapsis', 'Synapse', 'Red horizontal de conexiones que se encienden con la energía.', 'Horizontal network of links that light up with the energy.'],
  ['pixelorb', 'gen', 'Mapa de píxeles', 'Pixel Map', 'Matriz de luz que se llena con el sonido.', 'Grid of light that fills up with the sound.'],
  ['loudness', 'meter', 'Sonoridad LUFS', 'LUFS Loudness', 'Sonoridad LUFS momentánea, de corto plazo e integrada.', 'Momentary, short-term and integrated LUFS loudness.'],
  ['particles', 'gen', 'Nube de partículas', 'Particle Cloud', 'Nube de granos de luz que reacciona al audio.', 'Cloud of light grains that reacts to the audio.'],
  ['vumotor', 'meter', 'VU Motor', 'Motor VU', 'Dial iluminado con aguja que sigue el nivel RMS.', 'Illuminated dial with a needle following the RMS level.'],
  ['levels', 'meter', 'Niveles', 'Levels', 'Barras de nivel RMS por canal, con ventana de 300 ms.', 'RMS level bars per channel, over a 300 ms window.'],
  ['dynamics', 'meter', 'True Peak & RMS', 'True Peak & RMS', 'Pico real con sobremuestreo 4× junto al nivel RMS.', 'True peak with 4× oversampling next to the RMS level.'],
  ['phase', 'meter', 'Estéreo & fase', 'Stereo & Phase', 'Correlación entre canales y energía Mid / Side del estéreo.', 'Correlation between channels and Mid / Side stereo energy.'],
  ['bands', 'meter', 'Bandas', 'Bands', 'Cinco bandas en dBFS: SUB, LOW, MID, HIGH y AIR.', 'Five bands in dBFS: SUB, LOW, MID, HIGH and AIR.'],
  ['tuner', 'meter', 'Afinador', 'Tuner', 'Nota y desviación en cents, con A4 a 440 Hz.', 'Note and deviation in cents, with A4 at 440 Hz.'],
  ['tunerpiano', 'meter', 'Afinador piano', 'Piano Tuner', 'Historial del tono sobre un teclado, con A4 a 440 Hz.', 'Pitch history over a keyboard, with A4 at 440 Hz.'],
  ['rta', 'wave', 'Espectro RTA', 'RTA Spectrum', 'Analizador en tiempo real por bandas de frecuencia.', 'Real-time analyzer split into frequency bands.'],
  ['waveform', 'wave', 'Forma de onda', 'Waveform', 'La señal tal cual llega: una ventana de 4096 muestras.', 'The signal as it arrives: a window of 4096 samples.'],
  ['scope', 'wave', 'Osciloscopio', 'Oscilloscope', 'Trazo mono estable, sincronizado en el cruce por cero.', 'Steady mono trace, synced at the zero crossing.'],
  ['mirror', 'wave', 'Onda espejo', 'Mirror Wave', 'Envolvente del volumen reflejada arriba y abajo.', 'Volume envelope mirrored above and below.'],
  ['wavetrail', 'wave', 'Onda con rastro', 'Wave Trail', 'Ondas acumuladas de los últimos 1,8 segundos.', 'Stacked waves from the last 1.8 seconds.'],
  ['rgbwaves', 'wave', 'Ondas cromáticas', 'Chroma Waves', 'Dos curvas de color para graves, medios y agudos.', 'Two colored curves for lows, mids and highs.'],
  ['threads', 'wave', 'Hilo', 'Thread', 'Un hilo que fluye con la música y acelera en cada golpe.', 'A thread that flows with the music and speeds up on each hit.'],
  ['prism', 'wave', 'Haz prismático', 'Prism Beam', 'Haz de luz dispersa que toma la forma del volumen.', 'Beam of scattered light shaped by the volume.'],
  ['interference', 'wave', 'Interferencia', 'Interference', 'Dos ondas que interfieren según su fase y amplitud.', 'Two waves interfering by phase and amplitude.'],
  ['orbit', 'gen', 'Órbita', 'Orbit', 'Geometría generativa que gira y se deforma con la música.', 'Generative geometry that spins and bends with the music.'],
  ['pixels', 'gen', 'Matriz de píxeles', 'Pixel Matrix', 'Campo de píxeles tramados que se elevan con la energía.', 'Field of dithered pixels that rise with the energy.'],
  ['ephemeris', 'gen', 'Efemérides', 'Ephemeris', 'Esfera de referencia con un cuerpo que reacciona al audio.', 'Reference globe with a body that reacts to the audio.'],
  ['pointwave', 'gen', 'Onda de partículas', 'Particle Wave', 'Trama de puntos que ondula con el pulso de la señal.', 'Dot pattern that ripples with the pulse of the signal.'],
  ['storm', 'gen', 'Tormenta', 'Storm', 'Rayos ramificados que estallan con los graves y los golpes.', 'Branching lightning that strikes with bass and hits.'],
  ['granules', 'gen', 'Esfera granular', 'Granular Sphere', 'Esfera de partículas que gira y late con el audio.', 'Sphere of particles that spins and pulses with the audio.'],
  ['filaments', 'gen', 'Filamentos', 'Filaments', 'Hilos de luz que se mueven con las frecuencias.', 'Threads of light that move with the frequencies.'],
  ['spikes', 'gen', 'Esfera de picos', 'Spiked Sphere', 'Geometría elástica con picos que responden a golpes y frecuencias.', 'Elastic geometry with spikes that respond to hits and frequencies.'],
  ['sparks', 'gen', 'Destellos', 'Sparkles', 'Puntos intermitentes que siguen la energía y las frecuencias.', 'Blinking dots that follow the energy and frequencies.'],
  ['comet', 'gen', 'Estela de luz', 'Light Trail', 'Una luz viajera que deja rastro según la energía.', 'A traveling light that leaves a trail with the energy.'],
  ['nebula', 'gen', 'Nebulosa', 'Nebula', 'Partículas densas movidas por graves, medios, agudos y golpes.', 'Dense particles moved by lows, mids, highs and hits.'],
  ['mascot', 'gen', 'Mascota Hyro', 'Hyro Mascot', 'La mascota de Hyro: escucha, sigue el ritmo y reacciona.', 'The Hyro mascot: it listens, follows the beat and reacts.'],
  ['pixelglobe', 'gen', 'Esfera de píxeles', 'Pixel Globe', 'Esfera de píxeles con ondas de luz que laten.', 'Pixel sphere with pulsing waves of light.'],
  ['phasecore', 'gen', 'Núcleo de fase', 'Phase Core', 'Espiral que se pliega en 4D con la energía del audio.', 'Spiral folding in 4D with the energy of the audio.'],
  ['vu', 'meter', 'VU Meter', 'VU Meter', 'Aguja de nivel estéreo con referencia RMS, como un VU de estudio.', 'Stereo level needle with an RMS reference, like a studio VU.'],
];

export const graphName = (id: string, lang: 'es' | 'en') => {
  const g = GRAPHS.find((x) => x[0] === id);
  return g ? (lang === 'en' ? g[3] : g[2]) : id;
};
