import en from '../i18n/en.json';
import es from '../i18n/es.json';

type Mode = 'register' | 'login';

export function initAccountPage() {
  const root = document.querySelector<HTMLElement>('[data-auth-root]');
  if (!root) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const tabs = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-auth-tab]'),
  );
  const panels = Array.from(
    root.querySelectorAll<HTMLElement>('[data-auth-panel]'),
  );

  const show = (mode: Mode, focus = false) => {
    tabs.forEach((tab) => {
      const selected = tab.dataset.authTab === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.authPanel !== mode;
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(tab.dataset.authTab as Mode), {
      signal,
    });
    tab.addEventListener(
      'keydown',
      (event) => {
        let next: number;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft')
          next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        show(tabs[next].dataset.authTab as Mode, true);
      },
      { signal },
    );
  });

  const passwordButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-password-toggle]'),
  );
  const updatePasswordLabels = () => {
    const dictionary = document.documentElement.lang === 'es' ? es : en;
    passwordButtons.forEach((button) => {
      const input =
        button.parentElement?.querySelector<HTMLInputElement>('input');
      button.setAttribute(
        'aria-label',
        input?.type === 'text'
          ? dictionary.accountHidePassword
          : dictionary.accountShowPassword,
      );
    });
  };
  passwordButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const input =
          button.parentElement?.querySelector<HTMLInputElement>('input');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        updatePasswordLabels();
      },
      { signal },
    );
  });
  root.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => event.preventDefault(), {
      signal,
    });
  });
  document.addEventListener('hyro:language', updatePasswordLabels, { signal });
  updatePasswordLabels();

  return () => controller.abort();
}
