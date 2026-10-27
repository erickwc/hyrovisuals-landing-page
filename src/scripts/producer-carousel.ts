import en from '../i18n/en.json';
import es from '../i18n/es.json';

export function initProducerCarousel() {
  const carousel = document.querySelector<HTMLElement>('[data-producer-carousel]');
  const previous = document.querySelector<HTMLButtonElement>('[data-producer-prev]');
  const next = document.querySelector<HTMLButtonElement>('[data-producer-next]');
  const pause = document.querySelector<HTMLButtonElement>('[data-producer-pause]');
  if (!carousel || !previous || !next || !pause) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let inView = false;
  let hovered = false;
  let focused = false;
  let manuallyPaused = false;

  const move = (direction: -1 | 1) => {
    const card = carousel.querySelector<HTMLElement>('.producer-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const limit = carousel.scrollWidth - carousel.clientWidth;
    if (limit <= 1) return;
    const target = direction > 0 && carousel.scrollLeft >= limit - 2
      ? 0
      : direction < 0 && carousel.scrollLeft <= 2
        ? limit
        : Math.max(0, Math.min(limit, carousel.scrollLeft + direction * step));
    carousel.scrollTo({ left: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };

  const updatePauseLabel = () => {
    const copy = document.documentElement.lang === 'es' ? es : en;
    pause.setAttribute('aria-label', manuallyPaused ? copy.producerResume : copy.producerPause);
    pause.setAttribute('aria-pressed', String(manuallyPaused));
    pause.querySelector('span')!.textContent = manuallyPaused ? '▶' : 'Ⅱ';
  };

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
  }, { threshold: 0.25 });
  observer.observe(carousel);

  previous.addEventListener('click', () => move(-1), { signal });
  next.addEventListener('click', () => move(1), { signal });
  pause.addEventListener('click', () => {
    manuallyPaused = !manuallyPaused;
    updatePauseLabel();
  }, { signal });
  carousel.addEventListener('pointerenter', () => { hovered = true; }, { signal });
  carousel.addEventListener('pointerleave', () => { hovered = false; }, { signal });
  carousel.addEventListener('focusin', () => { focused = true; }, { signal });
  carousel.addEventListener('focusout', () => { focused = carousel.contains(document.activeElement); }, { signal });
  document.addEventListener('hyro:language', updatePauseLabel, { signal });

  const timer = window.setInterval(() => {
    if (inView && !hovered && !focused && !manuallyPaused && !reducedMotion.matches && !document.hidden) move(1);
  }, 5500);

  return () => {
    window.clearInterval(timer);
    observer.disconnect();
    controller.abort();
  };
}
