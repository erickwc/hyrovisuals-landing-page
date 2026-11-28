import type { Dict } from './es';

// English texts (served under /en/).
const en: Dict = {
  meta: {
    title: 'Hyro Visuals',
    description: 'Real-time audio visualizer for Windows and macOS. 40 graphs that react to your music. One-time payment, no subscriptions.',
    locale: 'en_US',
  },
  a11y: {
    skip: 'Skip to content', mainnav: 'Main', lang: 'Change language', theme: 'Change theme', menu: 'Menu', search: 'Search',
    layout: 'Layout', galtype: 'Graph type', gallist: 'Graphs', sections: 'Sections', prev: 'Previous', next: 'Next',
  },
  nav: {
    features: 'Features', action: 'In action', reviews: 'Reviews', faq: 'FAQ', pricing: 'Get it',
    login: 'Log in', signup: 'Sign up', account: 'My account',
  },
  ticker: ['One-time payment', 'From 20 US$', 'Lifetime access', 'Mac and Windows', 'For producers, DJs and creators', '40 audio graphs'],
  hero: {
    t0: 'It’s not just another visualizer, it’s', t1a: 'The', t1b: 'best', t2: 'in the industry',
    lead: 'Stick with the same visuals as always or pick something that makes a difference. You decide how your music looks.',
    cta: 'Get Hyro Visuals', cta2: 'See it in action',
    pills: ['40 graphs', 'Windows & macOS', 'One-time payment', 'Lifetime license'],
  },
  stage: { live: 'Live' },
  feat: {
    live: 'Live · 30 fps', caption: 'live, not a video: the app’s real strokes',
    items: [
      ['Fits on its own', 'The strip lives on top and arranges the apps you have open, on one or several monitors.'],
      ['Your style', '10 styles, 12 palettes and your own tone: Hyro dresses up in every producer’s essence.'],
      ['Windows & Mac', 'No system limits: the same experience on Windows 10 · 11 and macOS 14.2+.'],
    ],
  },
  act: {
    eyebrow: 'In action', t1: 'How Hyro', t2: 'Visuals works', lead: 'See everything you can do with it.',
    steps: [
      ['Spectrums & graphs', '40 graphs: turn on, remove and reorder the ones you want; they spread out on their own in the strip.'],
      ['Per-graph settings', 'Tap a graph to give it its own style, color, background and thickness, without touching the rest.'],
      ['Style', 'Ten styles that change the character of every graph in one click.'],
      ['Palette', 'Twelve palettes, or your own primary and secondary color.'],
      ['Mode', 'Cloud White, Space Dark, Space Black, following your system or with your own background.'],
      ['Audio response', 'Sensitivity, motion and smoothing: how much the visuals react, without changing the meter readings.'],
      ['Individual mode', 'Pop each graph out into its own window and place it wherever you like.'],
      ['Grid mode', 'The graphs line up in rows and fill the whole window.'],
      ['Presets', 'Save your combinations, import them and export them to share.'],
      ['Screens mode', 'A strip on each monitor, each one with its own graphs.'],
      ['Random visual', 'Random style, mode, palette and graphs; go back if you liked the previous one.'],
      ['Audio capture', 'Listen to system audio, an input from your interface or a file.'],
      ['Optimization', 'Cap the graphs at 30 fps to save CPU and battery.'],
      ['Strip', 'It lives at the top edge, always visible and never covering your DAW. You choose its height.'],
      ['Auto-adjust', 'Other windows settle below the strip so nothing gets covered.'],
    ],
  },
  mk: {
    customize: 'Customize', source: 'Choose audio source', license: 'Manage my license', status: 'System audio',
    src: ['System audio', 'Audio input', 'Audio file', 'Demo'],
    general: 'General settings', theme: 'Style', gridlbl: 'Grid', yes: 'Yes', no: 'No', palette: 'Palette',
    primary: 'Primary', secondary: 'Secondary', mode: 'Mode', modes: ['Cloud White', 'Space Gray', 'Space Black', 'System'],
    sliders: [['Sensitivity', '+4.0 dB', 58], ['Motion', '1.40×', 56], ['Spectrum smoothing', '0%', 0], ['VU reference', '0 VU = -9 dBFS', 80], ['Strip height', '180 px', 28]],
    autofit: 'Automatically adjust open apps.',
    collection: 'Spectrums and visuals', editing: 'Editing', pick: 'Select a visual', general2: 'General style', search: 'Search by name',
    presets: 'Presets', save: 'Save new preset', export: 'Export', import: 'Import',
    themes: ['Original', 'Vintage', 'Cosmic', 'Constellation', 'Blueprint', 'Phosphor', 'Brutalism', 'Arcade', 'Analog'],
    palettes: ['Original palette', 'Live', 'Sage', 'Amber', 'Lavender', 'Glacier', 'Night Rose', 'Ocean', 'Terracotta', 'Graphite', 'Paper', 'Ivory', 'Cloud', 'Blossom'],
  },
  gal: {
    eyebrow: 'Graphs', t1: 'A graph', t2: 'for every ear',
    lead: 'Meters that don’t lie and visuals that dance with your music: every photo is the app’s real graph.',
    all: 'All', meter: 'Metering', wave: 'Spectrum & wave', gen: 'Generative', filter: 'Filter',
    use: {
      meter: 'Great for mixing and mastering.',
      wave: 'Great for seeing what’s going on in your mix.',
      gen: 'Great for streams, videos and live sets.',
    },
  },
  rev: {
    eyebrow: 'Reviews', t1: 'What producers', t2: 'are saying', lead: 'Producers who keep Hyro Visuals open in every session.',
    verified: 'Verified customer', anon: 'Hyro customer',
    empty: 'No reviews yet. Customers can leave theirs from their library.', error: 'We couldn’t load the reviews.',
  },
  faq: {
    t1: 'Frequent', t2: 'questions', min: 'Minimum requirements',
    cols: [
      [
        { q: 'When do I get my key and the installers?', a: 'Instantly. As soon as the payment is confirmed, your activation key and the Windows and macOS installers show up in your account library, ready to download and activate.' },
        { q: 'Can I download the installers again?', a: 'Yes. Sign in and you will find your product in your library with the installers for the latest version, ready to download again whenever you need them, for example when you switch computers or reinstall.' },
        { q: 'Does HYRO work on Windows and macOS?', a: 'Yes. There are installers for 64-bit Windows 10 and 11 and for macOS 14.2 or later, on both Apple Silicon and Intel Macs.' },
        { q: 'How many computers can I use the license on?', a: 'Each key activates one computer at a time. Personal includes 1 key and Teams includes 3. If you switch computers, unlink the old one and activate the new one.' },
        { q: 'Do I need to set anything up for it to hear my music?', a: 'No. Hyro Visuals listens to system audio as soon as it opens. On macOS 14.2 or later you only need to allow system audio recording the first time. You can also pick an input from your interface or a file.' },
      ],
      [
        { q: 'Windows requirements', spec: [['System', '64-bit Windows 10 or Windows 11.'], ['Processor', '64-bit Intel or AMD.'], ['Memory', '8 GB of RAM.'], ['Storage', '500 MB free.']], rec: ['Recommended', 'Windows 11 and 16 GB of RAM to use Hyro alongside your DAW and other apps.'] },
        { q: 'Mac requirements', spec: [['System', 'macOS Sonoma 14.2 or later.'], ['Processor', '64-bit Intel or Apple Silicon.'], ['Memory', '8 GB of RAM.']], rec: ['Recommended', 'Apple Silicon and 16 GB of RAM to use Hyro alongside your DAW and other apps.'] },
        { q: 'Are my files or my audio uploaded anywhere?', a: 'No. All processing happens on your computer. Hyro Visuals doesn’t upload files, doesn’t record your screen and includes no analytics. It only connects to validate your license.' },
        { q: 'Can I save and share my settings?', a: 'Yes. Save your combinations as presets and export or import them as a file to share them with other producers.' },
        { q: 'Is it a subscription?', a: 'No. You pay once and the license is yours for life.' },
        { q: 'What’s the difference between Personal and Teams?', a: 'Only the number of activation keys. Personal includes 1 key and Teams includes 3 independent keys, managed from your account. The features are exactly the same.' },
      ],
    ],
  },
  ribbonA: ['For producers', 'DJs', 'Creators'],
  ribbonB: ['One purchase', 'Lifetime access'],
  buy: {
    eyebrow: 'License', t1: 'Get it', t2: 'today',
    lead: 'One-time payment, lifetime license. Every plan includes everything: only the number of keys changes.',
    choose: 'Choose your license',
    incl: ['40 graphs, from meters to generative visuals', 'Installers for Windows and macOS', 'Lifetime updates', 'Your keys and downloads in your account', 'No subscriptions'],
    lifetime: 'Lifetime', software: 'Software license', invoiceNo: 'No.',
    licl: 'License', date: 'Date', keysl: 'Keys', os: 'System', total: 'Total', once: 'One-time payment',
    cta: 'Buy now', preparing: 'Preparing your checkout…', secure: 'Secure payment',
    plan: { personal: 'Personal', equipos: 'Teams' },
    keyShort: ['key', 'keys'], months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  },
  foot: {
    t1: 'Ready to see', t2: 'your sound?', mascot: 'Hyro Visuals mascot',
    map: 'Sitemap', home: 'Home', buy: 'Buy',
    terms: 'Terms', privacy: 'Privacy', cookies: 'Cookies', refunds: 'Refunds', company: 'Company details',
    news: 'Subscribe', newsd: 'New spectrums, presets and news. No spam.', email: 'Email address', ph: 'you@email.com', sub: 'Subscribe',
    consent: 'I agree to receive news by email and to the', consentLink: 'privacy policy',
    ok: 'Done! We’ll keep you posted.', err: 'Enter a valid email.', needConsent: 'Check the box to allow the emails.', fail: 'Couldn’t send it. Please try again.',
    rights: 'All rights reserved.', made: 'Made for producers', top: 'Back to top',
  },
  search: {
    title: 'Search Hyro Visuals', ph: 'Search features, questions, spectrums…', nav: 'navigate', open: 'open', close: 'close',
    empty: 'No results for', suggest: 'Suggestions', module: 'Hyro Visuals graph', step: 'Tour step', section: 'Section', faq: 'Question',
  },
};

export default en;
