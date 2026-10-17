import en from '../i18n/en.json';
import es from '../i18n/es.json';
type Key = keyof typeof en;
export const readSaved = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
export function initPreferences(onLanguage: () => void) {
  const controller = new AbortController();
  const signal = controller.signal;
  const select = document.querySelector<HTMLSelectElement>('#language')!;
  const themeButton = document.querySelector<HTMLButtonElement>(
    '[data-theme-toggle]',
  )!;
  const menu = document.querySelector<HTMLButtonElement>('.menu-toggle')!;
  const links = document.querySelector('.nav-links')!;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let themeTransition: ViewTransition | undefined;
  let lang = readSaved('hyro-language');
  if (lang !== 'en' && lang !== 'es')
    lang = navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  let dictionary = lang === 'es' ? es : en;
  const labels = () => {
    themeButton.setAttribute(
      'aria-label',
      dictionary[
        document.documentElement.dataset.theme === 'dark'
          ? 'themeLight'
          : 'themeDark'
      ],
    );
    menu.setAttribute(
      'aria-label',
      dictionary[
        menu.getAttribute('aria-expanded') === 'true' ? 'menuClose' : 'menuOpen'
      ],
    );
  };
  const translate = () => {
    dictionary = lang === 'es' ? es : en;
    document.documentElement.lang = lang!;
    select.value = lang!;
    const accountPage = document.body.dataset.page === 'account';
    document.title = accountPage
      ? dictionary.accountPageTitle
      : dictionary.pageTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        accountPage
          ? dictionary.accountMetaDescription
          : dictionary.metaDescription,
      );
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n as Key;
      if (key in dictionary) el.textContent = dictionary[key];
    });
    document
      .querySelectorAll<HTMLElement>('[data-title-key]')
      .forEach((line) => {
        const key = line.dataset.titleKey as Key;
        if (!(key in dictionary)) return;
        const words = dictionary[key].trim().split(/\s+/);
        const lastWord = words.pop() ?? '';
        const leadingWords = words.join(' ');
        const leading = line.querySelector<HTMLElement>('[data-title-leading]');
        const last = line.querySelector<HTMLElement>('[data-title-last]');
        if (leading) leading.textContent = leadingWords;
        if (last) last.textContent = lastWord;
      });
    document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
      const key = el.dataset.i18nAria as Key;
      if (key in dictionary) el.setAttribute('aria-label', dictionary[key]);
    });
    labels();
  };
  const changeTheme = (theme: 'light' | 'dark') => {
    if (document.documentElement.dataset.theme === theme) return;
    themeTransition?.skipTransition();
    const apply = () => {
      document.documentElement.dataset.theme = theme;
      labels();
    };
    if (reducedMotion.matches || !document.startViewTransition) {
      apply();
      return;
    }
    const transition = document.startViewTransition(apply);
    themeTransition = transition;
    transition.finished.finally(() => {
      if (themeTransition === transition) themeTransition = undefined;
    });
  };
  translate();
  select.addEventListener(
    'change',
    () => {
      document.dispatchEvent(new Event('hyro:before-language'));
      lang = select.value;
      save('hyro-language', lang);
      translate();
      onLanguage();
    },
    { signal },
  );
  themeButton.addEventListener(
    'click',
    () => {
      const theme =
        document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      changeTheme(theme);
      save('hyro-theme', theme);
    },
    { signal },
  );
  system.addEventListener(
    'change',
    () => {
      if (!readSaved('hyro-theme')) {
        changeTheme(system.matches ? 'dark' : 'light');
      }
    },
    { signal },
  );
  const close = () => {
    links.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    labels();
  };
  menu.addEventListener(
    'click',
    () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      links.classList.toggle('is-open', open);
      menu.setAttribute('aria-expanded', String(open));
      labels();
    },
    { signal },
  );
  links.addEventListener('click', close, { signal });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') close();
    },
    { signal },
  );
  document.addEventListener(
    'click',
    (event) => {
      if (!document.querySelector('.navbar')?.contains(event.target as Node))
        close();
    },
    { signal },
  );
  return () => {
    controller.abort();
    themeTransition?.skipTransition();
  };
}
