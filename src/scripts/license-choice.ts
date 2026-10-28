export function initLicenseChoice() {
  const choice = document.querySelector<HTMLElement>('[data-license-choice]');
  if (!choice) return () => {};

  const options = Array.from(
    choice.querySelectorAll<HTMLButtonElement>('[data-license-option]'),
  );
  const proceed = choice.querySelector<HTMLAnchorElement>('[data-license-continue]');
  const personalMessage = choice.querySelector<HTMLElement>('[data-license-message="personal"]');
  const teamsMessage = choice.querySelector<HTMLElement>('[data-license-message="teams"]');
  const price = choice.querySelector<HTMLElement>('[data-license-price]');
  const benefitLists = document.querySelectorAll<HTMLElement>('[data-license-benefits]');
  const controller = new AbortController();
  const { signal } = controller;
  let selected: 'personal' | 'teams' = 'personal';

  if (price) price.textContent = '20,00 US$';

  const select = (option: HTMLButtonElement) => {
    selected = option.dataset.licenseOption === 'teams' ? 'teams' : 'personal';
    options.forEach((entry) => {
      const active = entry === option;
      entry.setAttribute('aria-checked', String(active));
      entry.classList.toggle('is-selected', active);
    });
    const isPersonal = selected === 'personal';
    if (personalMessage) personalMessage.hidden = !isPersonal;
    if (teamsMessage) teamsMessage.hidden = isPersonal;
    benefitLists.forEach((list) => { list.hidden = list.dataset.licenseBenefits !== selected; });
    if (proceed) {
      proceed.setAttribute('aria-disabled', String(!isPersonal));
      proceed.tabIndex = isPersonal ? 0 : -1;
    }
  };

  options.forEach((option, index) => {
    option.addEventListener('click', () => select(option), { signal });
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
        select(options[next]);
      },
      { signal },
    );
  });

  proceed?.addEventListener('click', (event) => {
    if (selected !== 'personal') event.preventDefault();
  }, { signal });

  return () => controller.abort();
}
