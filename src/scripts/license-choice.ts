export function initLicenseChoice() {
  const dialog = document.querySelector<HTMLDialogElement>(
    '[data-license-dialog]',
  );
  if (!dialog) return () => {};

  const opener = document.querySelector<HTMLButtonElement>(
    '[data-license-dialog-open]',
  );
  const options = Array.from(
    dialog.querySelectorAll<HTMLButtonElement>('[data-license-option]'),
  );
  const pending = dialog.querySelector<HTMLElement>('[data-license-pending]');
  const proceed = dialog.querySelector<HTMLAnchorElement>(
    '[data-license-continue]',
  );
  const controller = new AbortController();
  const { signal } = controller;
  let selected: 'personal' | 'teams' | null = null;

  opener?.addEventListener(
    'click',
    () => {
      selected = null;
      options.forEach((option) => {
        option.setAttribute('aria-checked', 'false');
        option.classList.remove('is-selected');
      });
      if (pending) pending.hidden = true;
      if (proceed) proceed.setAttribute('aria-disabled', 'true');
      dialog.showModal();
    },
    { signal },
  );

  options.forEach((option, index) => {
    option.addEventListener(
      'click',
      () => {
        selected = option.dataset.licenseOption as 'personal' | 'teams';
        options.forEach((entry) => {
          const active = entry === option;
          entry.setAttribute('aria-checked', String(active));
          entry.classList.toggle('is-selected', active);
        });
        const isPersonal = selected === 'personal';
        if (pending) pending.hidden = isPersonal;
        if (proceed) proceed.setAttribute('aria-disabled', String(!isPersonal));
      },
      { signal },
    );
    option.addEventListener(
      'keydown',
      (event) => {
        let next: number;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
          next = (index + 1) % options.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
          next = (index - 1 + options.length) % options.length;
        else return;
        event.preventDefault();
        options[next].focus();
        options[next].click();
      },
      { signal },
    );
  });

  proceed?.addEventListener(
    'click',
    (event) => {
      if (selected !== 'personal') event.preventDefault();
    },
    { signal },
  );

  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) dialog.close();
    },
    { signal },
  );

  return () => controller.abort();
}
