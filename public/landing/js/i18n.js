/* Hyro Visuals — textos ES / EN.
   El español vive en el HTML (se lee al iniciar); aquí está el inglés
   y los textos que genera JavaScript en ambos idiomas. */
(function () {
  'use strict';
  const EN = {
    'a11y.skip': 'Skip to content', 'a11y.mainnav': 'Main', 'a11y.lang': 'Change language', 'a11y.theme': 'Change theme', 'a11y.menu': 'Menu',
    'a11y.layout': 'Layout', 'a11y.sections': 'Sections', 'a11y.prev': 'Previous', 'a11y.next': 'Next',
    'nav.features': 'Features', 'nav.action': 'In action', 'nav.faq': 'FAQ', 'nav.pricing': 'Pricing', 'nav.cta': 'Get it',
    'nav.reviews': 'Reviews', 'nav.login': 'Log in', 'nav.signup': 'Sign up', 'nav.account': 'My account',
    'rev.eyebrow': 'Reviews', 'rev.t1': 'What producers', 'rev.t2': 'are saying', 'rev.lead': 'Producers, DJs and creators who keep Hyro Visuals open in every session.',
    'hero.t0': 'It’s not just another visualizer, it’s', 'hero.t1a': 'The', 'hero.t1b': 'best', 'hero.t2': 'in the industry',
    'a11y.search': 'Search', 'search.title': 'Search Hyro Visuals', 'search.ph': 'Search features, questions, spectrums…', 'search.nav': 'navigate', 'search.open': 'open', 'search.close': 'close',
    'hero.lead': 'Stick with the same visuals as always or pick something that makes a difference. You decide how your music looks.',
    'hero.cta': 'Get Hyro Visuals', 'hero.cta2': 'See it in action',
    'hero.p1': '30+ spectrums', 'hero.p2': 'Windows & macOS', 'hero.p3': 'One-time payment', 'hero.p4': '100% local',
    'hf.live': 'Live', 'hf.theme': 'Style', 'hf.brutal': 'Brutalism', 'hf.palettes': '12 palettes',
    'stage.strip': 'Strip', 'stage.grid': 'Grid', 'stage.float': 'Separate', 'stage.meta': 'Live demo · 124 BPM',
    'stage.d.strip': 'The strip lives at the top and your apps fit below it.',
    'feat.eyebrow': 'Features', 'feat.t1': 'Built for', 'feat.t2': 'producers', 'feat.lead': 'The essentials of Hyro Visuals in four points. Everything you see here is running live.',
    'feat.next': 'Show the next spectrum', 'feat.hint': 'Click to switch',
    'feat.1.t': '30+ audio spectrums', 'feat.1.d': 'More than 30 unique spectrums to choose from.',
    'feat.2.tag': 'Readjust windows', 'feat.2.t': 'Fits your screen completely', 'feat.2.d': 'Automatically arranges the apps you have open, on one or several monitors.',
    'feat.3.t': 'Fully customizable', 'feat.3.d': 'Hyro Visuals doesn’t have just one style: it adapts to every producer’s essence.',
    'feat.4.win': 'Windows 10 · 11 (64-bit)', 'feat.4.mac': 'macOS 13+ · Apple Silicon & Intel', 'feat.4.t': 'Made for Windows and Mac', 'feat.4.d': 'No system limits. The same experience on both.',
    'act.eyebrow': 'In action', 'act.t1': 'See it in', 'act.t2': 'action', 'act.lead': 'Tour the app section by section. Pick a title and watch it move inside the program.',
    'mk.customize': 'Customize', 'mk.source': 'Choose audio source', 'mk.license': 'Manage my license', 'mk.status': 'System audio',
    'mk.src1': 'System audio', 'mk.src2': 'Audio input', 'mk.src3': 'Audio file', 'mk.src4': 'Demo',
    'mk.general': 'General settings', 'mk.theme': 'Style', 'mk.gridlbl': 'Grid', 'mk.yes': 'Yes', 'mk.no': 'No', 'mk.palette': 'Palette',
    'mk.primary': 'Primary', 'mk.secondary': 'Secondary', 'mk.mode': 'Mode', 'mk.m1': 'Cloud White', 'mk.m2': 'Space Gray', 'mk.m3': 'Space Black', 'mk.m4': 'System',
    'mk.s1': 'Sensitivity', 'mk.s2': 'Motion', 'mk.s3': 'Spectrum smoothing', 'mk.s4': 'VU reference', 'mk.s5': 'Strip height', 'mk.s6': 'Automatically adjust open apps.',
    'mk.collection': 'Spectrums and visuals', 'mk.editing': 'Editing', 'mk.pick': 'Select a visual', 'mk.general2': 'General style', 'mk.search': 'Search by name',
    'mk.presets': 'Presets', 'mk.mine': 'My preset', 'mk.save': 'Save new preset', 'mk.export': 'Export', 'mk.import': 'Import',
    'faq.eyebrow': 'FAQ', 'faq.t1': 'Frequent', 'faq.t2': 'questions', 'faq.lead': 'Everything you need to know before you buy.',
    'faq.q1': 'When do I get my key and the installers?', 'faq.a1': 'Instantly. As soon as the payment is confirmed you get an email with your activation key and the download links for Windows and macOS.',
    'faq.q2': 'Can I download the installers again?', 'faq.a2': 'Yes. Use the link in your purchase email whenever you need it, for example when you switch computers or reinstall.',
    'faq.q3': 'Does HYRO work on Windows and macOS?', 'faq.a3': 'Yes. There are installers for 64-bit Windows 10 and 11 and for macOS 13 or later, on both Apple Silicon and Intel Macs.',
    'faq.q4': 'How many computers can I use the license on?', 'faq.a4': 'Each key activates one computer at a time. Personal includes 1 key and Teams includes 3. If you switch computers, unlink the old one and activate the new one.',
    'faq.q5': 'Do I need to set anything up for it to hear my music?', 'faq.a5': 'No. Hyro Visuals listens to system audio as soon as it opens. On macOS 14.2 or later you only need to allow system audio recording the first time. You can also pick an input from your interface or a file.',
    'faq.q6': 'What systems do I need?', 'faq.a6': '64-bit Windows 10 or 11, or macOS 13 or later. Capturing system audio directly on Mac requires macOS 14.2 or later; on earlier versions you can use a loopback input or a file.',
    'faq.q7': 'Are my files or my audio uploaded anywhere?', 'faq.a7': 'No. All processing happens on your computer. Hyro Visuals doesn’t upload files, doesn’t record your screen and includes no analytics. It only connects to validate your license.',
    'faq.q8': 'Can I save and share my settings?', 'faq.a8': 'Yes. Save your combinations as presets and export or import them as a file to share them with other producers.',
    'faq.q9': 'Is it a subscription?', 'faq.a9': 'No. You pay once and the license is yours for life.',
    'faq.q10': 'What’s the difference between Personal and Teams?', 'faq.a10': 'Only the number of activation keys. Personal includes 1 key and Teams includes 3 independent keys, managed from your account. The features are exactly the same.',
    'buy.eyebrow': 'License', 'buy.t1': 'Buy', 'buy.lead': 'One-time payment, lifetime license. Both plans include everything: only the number of keys changes.',
    'buy.personal': 'Personal', 'buy.teams': 'Teams', 'buy.keys1': '1 activation key', 'buy.keys3': '3 activation keys',
    'buy.i1': 'Over 30 spectrums and visuals', 'buy.i2': 'Styles, palettes and presets', 'buy.i3': 'Installers for Windows and macOS', 'buy.i4': '100% local processing', 'buy.i5': 'No subscriptions',
    'buy.lifetime': 'Lifetime', 'buy.software': 'Software license', 'buy.invoice': 'Invoice', 'buy.choose': 'Choose your license',
    'buy.pd': 'One activation key for one computer at a time.', 'buy.td': 'Three independent keys, managed from your account.', 'buy.k1': '1 key', 'buy.k3': '3 keys',
    'buy.concept': 'Item', 'buy.amount': 'Amount', 'buy.keysrow': 'Activation keys', 'buy.incl': 'Included', 'buy.osrow': 'Windows + macOS', 'buy.lifetime2': 'Lifetime license',
    'buy.total': 'Total', 'buy.once': 'One-time payment', 'buy.coupon': 'Have a coupon? Apply it at checkout.', 'buy.cta': 'Buy now', 'buy.secure': 'Secure payment',
    'foot.t1': 'Ready to see', 'foot.t2': 'your sound?', 'foot.desc': 'Modular audio visualizer for Windows and macOS. Made so you can see what you hear.',
    'foot.map': 'Sitemap', 'foot.home': 'Home', 'foot.buy': 'Buy', 'foot.privacy': 'Privacy', 'foot.terms': 'Terms', 'foot.license': 'License', 'foot.social': 'Social',
    'foot.news': 'Subscribe', 'foot.newsd': 'New spectrums, presets and news. No spam.', 'foot.email': 'Email address', 'foot.ph': 'you@email.com', 'foot.sub': 'Subscribe',
    'foot.rights': 'All rights reserved.', 'foot.made': 'Made for producers', 'foot.top': 'Back to top'
  };

  // Textos generados por JS
  const JS = {
    es: {
      'stage.d.strip': 'La franja vive arriba y tus apps se acomodan debajo.',
      'stage.d.grid': 'Cuadrícula autoadaptable: los módulos se reparten solos, sin scroll.',
      'stage.d.float': 'Separa cada visual como un cuadro independiente.',
      'news.ok': '¡Listo! Te avisaremos de las novedades.', 'news.err': 'Escribe un correo válido.', 'news.fail': 'No se pudo enviar. Inténtalo de nuevo.',
      'rv.verified': 'Cliente verificado', 'rv.anon': 'Cliente de Hyro', 'rv.empty': 'Todavía no hay reseñas. Los clientes pueden dejar la suya desde su biblioteca.', 'rv.error': 'No pudimos cargar las reseñas.',
      'mk.nosrc': 'Sin fuente', 'mk.src1': 'Audio del sistema',
      ticker: ['Pago único', 'Desde 20 US$', 'Acceso de por vida', 'Windows y Mac', 'Para productores, DJs y creadores', '30+ espectros de audio'],
      ribbonA: ['Para productores', 'DJs', 'Creadores'], ribbonB: ['Un solo pago', 'Acceso de por vida'],
      months: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
      plan: { personal: 'Personal', teams: 'Equipos' }, invoiceNo: 'N.º',
      'search.empty': 'Sin resultados para', 'search.suggest': 'Sugerencias', 'search.module': 'Espectro disponible en Hyro Visuals', 'search.step': 'Paso del recorrido', 'search.plan1': '1 clave de activación · {p}', 'search.plan3': '3 claves de activación · {p}'
    },
    en: {
      'stage.d.strip': 'The strip lives at the top and your apps fit below it.',
      'stage.d.grid': 'Self-adapting grid: modules spread out on their own, no scrolling.',
      'stage.d.float': 'Pull each visual apart as an independent square.',
      'news.ok': 'Done! We’ll keep you posted.', 'news.err': 'Enter a valid email.', 'news.fail': 'Couldn’t send it. Please try again.',
      'rv.verified': 'Verified customer', 'rv.anon': 'Hyro customer', 'rv.empty': 'No reviews yet. Customers can leave theirs from their library.', 'rv.error': 'We couldn’t load the reviews.',
      'mk.nosrc': 'No source', 'mk.src1': 'System audio',
      ticker: ['One-time payment', 'From 20 US$', 'Lifetime access', 'Mac and Windows', 'For producers, DJs and creators', '30+ audio spectrums'],
      ribbonA: ['For producers', 'DJs', 'Creators'], ribbonB: ['One purchase', 'Lifetime access'],
      months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
      plan: { personal: 'Personal', teams: 'Teams' }, invoiceNo: 'No.',
      'search.empty': 'No results for', 'search.suggest': 'Suggestions', 'search.module': 'Spectrum available in Hyro Visuals', 'search.step': 'Tour step', 'search.plan1': '1 activation key · {p}', 'search.plan3': '3 activation keys · {p}'
    }
  };

  // Catálogo completo de módulos de la app (37)
  const MODULES = [
    ['spectrum', 'Espectro', 'Spectrum'], ['pixels', 'Matriz de píxeles', 'Pixel Matrix'], ['mesh', 'Malla orbital', 'Orbital Mesh'],
    ['mascot', 'Mascota Hyro', 'Hyro Mascot'], ['phase', 'Estéreo & fase', 'Stereo & Phase'], ['waves3d', 'Ondas 3D', '3D Waves'],
    ['dynamics', 'True Peak & RMS', 'True Peak & RMS'], ['geometry', 'Trama geométrica', 'Geometric Grid'], ['spectrogram', 'Espectrograma', 'Spectrogram'],
    ['waveform', 'Forma de onda', 'Waveform'], ['threads', 'Red de hilos', 'Thread Network'], ['levels', 'Niveles', 'Levels'],
    ['particles', 'Nube de partículas', 'Particle Cloud'], ['dotspectrum', 'Espectro de puntos', 'Dot Spectrum'], ['vu', 'VU Meter', 'VU Meter'],
    ['scope', 'Osciloscopio', 'Oscilloscope'], ['orbit', 'Órbita', 'Orbit'], ['rta', 'Espectro RTA', 'RTA Spectrum'],
    ['loudness', 'Sonoridad LUFS', 'LUFS Loudness'], ['ephemeris', 'Efemérides', 'Ephemeris'], ['vuclassic', 'VU clásico', 'Classic VU'],
    ['samplewave', 'Señal muestreada', 'Sampled Signal'], ['interference', 'Interferencia', 'Interference'], ['diffraction', 'Difracción', 'Diffraction'],
    ['bands', 'Bandas', 'Bands'], ['wavetrail', 'Onda con rastro', 'Wave Trail'], ['mirror', 'Onda espejo', 'Mirror Wave'],
    ['granules', 'Esfera granular', 'Granular Sphere'], ['synapse', 'Sinapsis', 'Synapse'], ['filaments', 'Filamentos', 'Filaments'],
    ['spikes', 'Esfera de picos', 'Spiked Sphere'], ['sparks', 'Destellos', 'Sparkles'], ['membrane', 'Membrana', 'Membrane'],
    ['dna', 'ADN', 'DNA'], ['storm', 'Tormenta', 'Storm'], ['pointwave', 'Onda de partículas', 'Particle Wave'], ['terrain', 'Relieve espectral', 'Spectral Terrain']
  ];

  const THEMES = [
    ['classic', 'Original', 'Original'], ['vintage', 'Vintage', 'Vintage'], ['cosmos', 'Espacial', 'Cosmic'], ['constellation', 'Constelación', 'Constellation'],
    ['blueprint', 'Plano técnico', 'Blueprint'], ['crt', 'Fósforo', 'Phosphor'], ['brutal', 'Brutalismo', 'Brutalism'], ['arcade', 'Arcade', 'Arcade'], ['analog', 'Análogo', 'Analog']
  ];
  const PALETTES = [
    ['original', 'Paleta original', 'Original palette', null], ['live', 'Live', 'Live', '#58d0df'], ['mint', 'Salvia', 'Sage', '#b5f3cc'], ['amber', 'Ámbar', 'Amber', '#f5cf89'],
    ['violet', 'Lavanda', 'Lavender', '#c9b6ff'], ['ice', 'Glaciar', 'Glacier', '#62dbef'], ['rose', 'Rosa nocturna', 'Night Rose', '#f8b4c7'], ['ocean', 'Océano', 'Ocean', '#85afff'],
    ['ember', 'Terracota', 'Terracotta', '#ffa47c'], ['mono', 'Grafito', 'Graphite', '#ededeb'], ['paper', 'Papel', 'Paper', '#337558'], ['ivory', 'Marfil', 'Ivory', '#976328'],
    ['cloud', 'Nube', 'Cloud', '#456dbe'], ['blossom', 'Flor', 'Blossom', '#9d527b']
  ];

  const STEPS = [
    { id: 'overview', es: ['Vista general', 'Así es Hyro Visuals: la franja de visuales arriba y el panel de ajustes debajo, en una sola ventana.'], en: ['Overview', 'This is Hyro Visuals: the strip of visuals on top and the settings panel below, all in one window.'] },
    { id: 'strip', es: ['La franja', 'Vive en el borde superior de tu pantalla, siempre visible y sin tapar tu DAW. Pasa el cursor para ver sus controles.'], en: ['The strip', 'It lives at the top edge of your screen, always visible and never covering your DAW. Hover to reveal its controls.'] },
    { id: 'reorder', es: ['Arrastra y reordena', 'Suelta una gráfica sobre otra para cambiar su posición. El orden se guarda solo, sin reiniciar nada.'], en: ['Drag to reorder', 'Drop one visual onto another to swap places. The order saves itself, nothing restarts.'] },
    { id: 'source', es: ['Fuente de audio', 'Escucha el audio del sistema en cuanto abre. También puedes elegir una entrada de tu interfaz o un archivo.'], en: ['Audio source', 'Listens to system audio as soon as it opens. You can also pick an input from your interface or a file.'] },
    { id: 'themes', es: ['Temáticas', 'Original, Vintage, Espacial, Plano técnico, Fósforo, Brutalismo, Arcade y Análogo. Cada módulo puede llevar la suya.'], en: ['Styles', 'Original, Vintage, Cosmic, Blueprint, Phosphor, Brutalism, Arcade and Analog. Each module can wear its own.'] },
    { id: 'palette', es: ['Paletas y color', 'Doce paletas y tu propio tono. Claro, oscuro o según tu sistema.'], en: ['Palettes & color', 'Twelve palettes plus your own tone. Light, dark or following your system.'] },
    { id: 'modules', es: ['Espectros y gráficas', 'Activa, quita y ordena más de 30 módulos. Se reparten solos en el espacio disponible.'], en: ['Spectrums & visuals', 'Turn on, remove and reorder over 30 modules. They spread out on their own in the available space.'] },
    { id: 'sliders', es: ['Sensibilidad y movimiento', 'Ajusta cuánto reaccionan los visuales generativos sin alterar la lectura real de los medidores.'], en: ['Sensitivity & motion', 'Tune how much the generative visuals react without touching the real meter readings.'] },
    { id: 'presets', es: ['Presets', 'Guarda tus combinaciones favoritas y compártelas exportándolas como archivo.'], en: ['Presets', 'Save your favorite combinations and share them by exporting them as a file.'] }
  ];

  const nodes = [];
  let lang = document.documentElement.lang === 'en' ? 'en' : 'es';

  function collect() {
    document.querySelectorAll('[data-i18n]').forEach(el => nodes.push({ el, key: el.dataset.i18n, es: el.innerHTML }));
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(';').forEach(pair => {
        const [attr, key] = pair.split(':');
        nodes.push({ el, key, attr, es: el.getAttribute(attr) || '' });
      });
    });
  }
  function apply(next) {
    lang = next === 'en' ? 'en' : 'es';
    document.documentElement.lang = lang;
    for (const n of nodes) {
      const val = lang === 'en' ? (EN[n.key] ?? n.es) : n.es;
      if (n.attr) n.el.setAttribute(n.attr, val); else if (n.el.innerHTML !== val) n.el.innerHTML = val;
    }
    try { localStorage.setItem('hyro.lang', lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }
  const t = key => (JS[lang][key] ?? EN[key] ?? key);
  const name = list => id => { const r = list.find(x => x[0] === id); return r ? r[lang === 'en' ? 2 : 1] : id; };

  window.I18N = {
    collect, apply, t, get lang() { return lang; },
    js: k => JS[lang][k], MODULES, THEMES, PALETTES, STEPS,
    moduleName: name(MODULES), themeName: name(THEMES), paletteName: name(PALETTES)
  };
})();
