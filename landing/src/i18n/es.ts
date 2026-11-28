// Textos en español (idioma por defecto, en la raíz del sitio).
const es = {
  meta: {
    title: 'Hyro Visuals',
    description: 'Visualizador de audio en tiempo real para Windows y macOS. 40 gráficas que reaccionan a tu música. Pago único, sin suscripciones.',
    locale: 'es_LA',
  },
  a11y: {
    skip: 'Saltar al contenido', mainnav: 'Principal', lang: 'Cambiar idioma', theme: 'Cambiar tema', menu: 'Menú', search: 'Buscar',
    layout: 'Distribución', galtype: 'Tipo de gráfica', gallist: 'Gráficas', sections: 'Secciones', prev: 'Anterior', next: 'Siguiente',
  },
  nav: {
    features: 'Funciones', action: 'En acción', reviews: 'Reseñas', faq: 'Preguntas', pricing: 'Adquirir',
    login: 'Iniciar sesión', signup: 'Crear cuenta', account: 'Mi cuenta',
  },
  ticker: ['Pago único', 'Desde 20 US$', 'Acceso de por vida', 'Windows y Mac', 'Para productores, DJs y creadores', '40 gráficas de audio'],
  hero: {
    t0: 'No es otro visuals, es', t1a: 'El', t1b: 'mejor', t2: 'de la industria',
    lead: 'Quédate con los mismos visuales de siempre o elige algo que marque la diferencia. Tú decides cómo se ve tu música.',
    cta: 'Obtener Hyro Visuals', cta2: 'Míralo en acción',
    pills: ['40 gráficas', 'Windows y macOS', 'Pago único', 'Licencia de por vida'],
  },
  stage: { live: 'En vivo' },
  feat: {
    live: 'En vivo · 30 fps', caption: 'en vivo, no es un vídeo: los trazos reales de la app',
    items: [
      ['Se adapta solo', 'La franja vive arriba y acomoda las apps que tengas abiertas, en uno o varios monitores.'],
      ['A tu estilo', '10 temáticas, 12 paletas y tu propio tono: Hyro se viste con la esencia de cada productor.'],
      ['Windows y Mac', 'Sin límites de sistema: la misma experiencia en Windows 10 · 11 y macOS 14.2+.'],
    ] as [string, string][],
  },
  act: {
    eyebrow: 'En acción', t1: 'Así funciona', t2: 'Hyro Visuals', lead: 'Mira todo lo que puedes hacer con él.',
    steps: [
      ['Espectros y gráficas', '40 gráficas: activa, quita y ordena las que quieras; se reparten solas en la franja.'],
      ['Ajustes individuales', 'Toca una gráfica para darle su propia temática, color, fondo y grosor, sin tocar las demás.'],
      ['Temática', 'Diez temáticas que cambian el carácter de todas las gráficas con un clic.'],
      ['Paleta', 'Doce paletas, o tu propio color principal y secundario.'],
      ['Modo', 'Blanco nube, Space Dark, Space Black, según tu sistema o con tu propio fondo.'],
      ['Respuesta al audio', 'Sensibilidad, movimiento y suavizado: cuánto reaccionan los visuales, sin alterar la lectura de los medidores.'],
      ['Modo individual', 'Saca cada gráfica a su propia ventana y colócala donde quieras.'],
      ['Modo cuadrícula', 'Las gráficas se ordenan en filas y llenan toda la ventana.'],
      ['Presets', 'Guarda tus combinaciones, impórtalas y expórtalas para compartirlas.'],
      ['Modo Pantallas', 'Una franja en cada monitor, cada una con sus propias gráficas.'],
      ['Visual aleatorio', 'Temática, modo, paleta y gráficas al azar; vuelve atrás si te gustaba la anterior.'],
      ['Captura del audio', 'Escucha el audio del sistema, una entrada de tu interfaz o un archivo.'],
      ['Optimización', 'Limita las gráficas a 30 fps para ahorrar procesador y batería.'],
      ['Franja', 'Vive en el borde de arriba, siempre visible y sin tapar tu DAW. Tú eliges su altura.'],
      ['Ajustar automáticamente', 'Las demás ventanas se acomodan debajo de la franja para que nada quede tapado.'],
    ] as [string, string][],
  },
  mk: {
    customize: 'Personalizar', source: 'Elegir fuente de audio', license: 'Administrar mi licencia', status: 'Audio del sistema',
    src: ['Audio del sistema', 'Entrada de audio', 'Archivo de audio', 'Demo'],
    general: 'Ajustes generales', theme: 'Temática', gridlbl: 'Cuadrícula', yes: 'Sí', no: 'No', palette: 'Paleta',
    primary: 'Principal', secondary: 'Secundario', mode: 'Modo', modes: ['Blanco nube', 'Space Gray', 'Space Black', 'Según sistema'],
    sliders: [['Sensibilidad', '+4.0 dB', 58], ['Movimiento', '1.40×', 56], ['Suavizado del espectro', '0%', 0], ['Referencia del VU', '0 VU = -9 dBFS', 80], ['Altura de la franja', '180 px', 28]] as [string, string, number][],
    autofit: 'Ajustar automáticamente aplicaciones en uso.',
    collection: 'Espectros y gráficas', editing: 'Editando', pick: 'Selecciona una gráfica', general2: 'Temática general', search: 'Buscar por nombre',
    presets: 'Presets', save: 'Guardar nuevo preset', export: 'Exportar', import: 'Importar',
    themes: ['Original', 'Vintage', 'Espacial', 'Constelación', 'Plano técnico', 'Fósforo', 'Brutalismo', 'Arcade', 'Análogo'],
    palettes: ['Paleta original', 'Live', 'Salvia', 'Ámbar', 'Lavanda', 'Glaciar', 'Rosa nocturna', 'Océano', 'Terracota', 'Grafito', 'Papel', 'Marfil', 'Nube', 'Flor'],
  },
  gal: {
    eyebrow: 'Gráficas', t1: 'Una gráfica', t2: 'para cada oído',
    lead: 'Medidores que no mienten y visuales que bailan con tu música: cada foto es la gráfica real de la app.',
    all: 'Todas', meter: 'Medición', wave: 'Espectro y onda', gen: 'Generativas', filter: 'Filtrar',
    use: {
      meter: 'Ideal para mezclar y masterizar.',
      wave: 'Ideal para ver qué está pasando en tu mezcla.',
      gen: 'Ideal para streams, videos y sets en vivo.',
    } as Record<string, string>,
  },
  rev: {
    eyebrow: 'Reseñas', t1: 'Lo que dicen', t2: 'los productores', lead: 'Productores que ya tienen Hyro Visuals abierto en cada sesión.',
    verified: 'Cliente verificado', anon: 'Cliente de Hyro',
    empty: 'Todavía no hay reseñas. Los clientes pueden dejar la suya desde su biblioteca.', error: 'No pudimos cargar las reseñas.',
  },
  faq: {
    t1: 'Preguntas', t2: 'frecuentes', min: 'Requisitos mínimos',
    cols: [
      [
        { q: '¿Cuándo recibo mi clave y los instaladores?', a: 'Al instante. En cuanto se confirma el pago, tu clave de activación y los instaladores para Windows y macOS aparecen en la biblioteca de tu cuenta, listos para descargar y activar.' },
        { q: '¿Puedo volver a descargar los instaladores?', a: 'Sí. Entra a tu cuenta y en tu biblioteca encontrarás tu producto con los instaladores de la última versión, listos para descargarlos de nuevo cuando los necesites, por ejemplo al cambiar de equipo o al reinstalar.' },
        { q: '¿HYRO funciona en Windows y macOS?', a: 'Sí. Hay instaladores para Windows 10 y 11 de 64 bits y para macOS 14.2 o posterior, tanto en Mac con Apple Silicon como con Intel.' },
        { q: '¿En cuántos equipos puedo usar la licencia?', a: 'Cada clave activa un equipo a la vez. Personal incluye 1 clave y Equipos incluye 3. Si cambias de computadora, desvincula la anterior y activa la nueva.' },
        { q: '¿Necesito configurar algo para que escuche mi música?', a: 'No. Hyro Visuals escucha el audio del sistema en cuanto se abre. En macOS 14.2 o posterior solo tienes que autorizar la grabación de audio del sistema la primera vez. También puedes elegir una entrada de tu interfaz o un archivo.' },
      ],
      [
        { q: 'Requisitos para Windows', spec: [['Sistema', 'Windows 10 o Windows 11 de 64 bits.'], ['Procesador', 'Intel o AMD de 64 bits.'], ['Memoria', '8 GB de RAM.'], ['Almacenamiento', '500 MB libres.']], rec: ['Recomendado', 'Windows 11 y 16 GB de RAM para usar Hyro junto con tu DAW y otras aplicaciones.'] },
        { q: 'Requisitos para Mac', spec: [['Sistema', 'macOS Sonoma 14.2 o posterior.'], ['Procesador', 'Intel de 64 bits o Apple Silicon.'], ['Memoria', '8 GB de RAM.']], rec: ['Recomendado', 'Apple Silicon y 16 GB de RAM para usar Hyro junto con tu DAW y otras aplicaciones.'] },
        { q: '¿Mis archivos o mi audio se suben a algún servidor?', a: 'No. Todo el procesamiento ocurre en tu equipo. Hyro Visuals no sube archivos, no graba tu pantalla y no incluye analítica. Solo se conecta para validar tu licencia.' },
        { q: '¿Puedo guardar y compartir mis ajustes?', a: 'Sí. Guarda tus combinaciones como presets y expórtalas o impórtalas como archivo para compartirlas con otros productores.' },
        { q: '¿Es una suscripción?', a: 'No. Pagas una sola vez y la licencia es tuya de por vida.' },
        { q: '¿Cuál es la diferencia entre Personal y Equipos?', a: 'Solo la cantidad de claves de activación. Personal incluye 1 clave y Equipos incluye 3 claves independientes, administradas desde tu cuenta. Las funciones son exactamente las mismas.' },
      ],
    ] as FaqItem[][],
  },
  ribbonA: ['Para productores', 'DJs', 'Creadores'],
  ribbonB: ['Un solo pago', 'Acceso de por vida'],
  buy: {
    eyebrow: 'Licencia', t1: 'Adquiérelo', t2: 'hoy',
    lead: 'Pago único y licencia de por vida. Todos los planes incluyen todo: solo cambia la cantidad de claves.',
    choose: 'Elige tu licencia',
    incl: ['40 gráficas, de los medidores a las generativas', 'Instaladores para Windows y macOS', 'Actualizaciones de por vida', 'Tus claves y descargas en tu cuenta', 'Sin suscripciones'],
    lifetime: 'De por vida', software: 'Licencia de software', invoiceNo: 'N.º',
    licl: 'Licencia', date: 'Fecha', keysl: 'Claves', os: 'Sistema', total: 'Total', once: 'Pago único',
    cta: 'Comprar ahora', preparing: 'Preparando tu compra…', secure: 'Pago seguro',
    plan: { personal: 'Personal', equipos: 'Equipos' } as Record<string, string>,
    keyShort: ['clave', 'claves'], months: ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'],
  },
  foot: {
    t1: '¿Listo para ver', t2: 'tu sonido?', mascot: 'Mascota de Hyro Visuals',
    map: 'Mapa del sitio', home: 'Inicio', buy: 'Comprar',
    terms: 'Términos', privacy: 'Privacidad', cookies: 'Cookies', refunds: 'Reembolsos', company: 'Datos de la empresa',
    news: 'Suscríbete', newsd: 'Nuevos espectros, presets y novedades. Sin spam.', email: 'Correo electrónico', ph: 'tu@correo.com', sub: 'Suscribirme',
    consent: 'Acepto recibir novedades por correo y la', consentLink: 'política de privacidad',
    ok: '¡Listo! Te avisaremos de las novedades.', err: 'Escribe un correo válido.', needConsent: 'Marca la casilla para autorizar los correos.', fail: 'No se pudo enviar. Inténtalo de nuevo.',
    rights: 'Todos los derechos reservados.', made: 'Hecho para productores', top: 'Volver arriba',
  },
  search: {
    title: 'Buscar en Hyro Visuals', ph: 'Busca funciones, preguntas, espectros…', nav: 'navegar', open: 'abrir', close: 'cerrar',
    empty: 'Sin resultados para', suggest: 'Sugerencias', module: 'Gráfica de Hyro Visuals', step: 'Paso del recorrido', section: 'Sección', faq: 'Pregunta',
  },
};

export type FaqItem = { q: string; a?: string; spec?: [string, string][]; rec?: [string, string] };
export type Dict = typeof es;
export default es;
