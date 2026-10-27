export function initProducerCarousel() {
  const carousel = document.querySelector<HTMLElement>('[data-producer-carousel]');
  const previous = document.querySelector<HTMLButtonElement>('[data-producer-prev]');
  const next = document.querySelector<HTMLButtonElement>('[data-producer-next]');
  if (!carousel || !previous || !next) return () => {};

  const controller = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const move = (direction: -1 | 1) => {
    const card = carousel.querySelector<HTMLElement>('.producer-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(carousel).columnGap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const limit = carousel.scrollWidth - carousel.clientWidth;
    const target = direction > 0 && carousel.scrollLeft >= limit - 2
      ? 0
      : direction < 0 && carousel.scrollLeft <= 2
        ? limit
        : Math.max(0, Math.min(limit, carousel.scrollLeft + direction * step));
    carousel.scrollTo({ left: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  };
  previous.addEventListener('click', () => move(-1), { signal: controller.signal });
  next.addEventListener('click', () => move(1), { signal: controller.signal });
  return () => controller.abort();
}
