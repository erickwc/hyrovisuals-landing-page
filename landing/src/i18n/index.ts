import es from './es';
import en from './en';

export type Lang = 'es' | 'en';
export const DICTS = { es, en } as const;
export const useDict = (lang: Lang) => DICTS[lang];
/** Ruta de la misma página en el otro idioma (ES en la raíz, EN bajo /en/). */
export const homeOf = (lang: Lang) => (lang === 'en' ? '/en/' : '/');
