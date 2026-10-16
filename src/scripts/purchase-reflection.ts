export function initPurchaseReflection(reducedMotion: boolean) {
  const card = document.querySelector<HTMLElement>('.purchase-card');
  if (
    !card ||
    reducedMotion ||
    !matchMedia('(hover: hover) and (pointer: fine)').matches
  )
    return () => {};

  const controller = new AbortController();
  let frame = 0;
  let x = 50;
  let y = 50;

  card.addEventListener(
    'pointermove',
    (event) => {
      const bounds = card.getBoundingClientRect();
      x = Math.max(
        0,
        Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
      );
      y = Math.max(
        0,
        Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100),
      );
      if (frame) return;
      frame = requestAnimationFrame(() => {
        card.style.setProperty('--reflection-x', `${x}%`);
        card.style.setProperty('--reflection-y', `${y}%`);
        frame = 0;
      });
    },
    { signal: controller.signal },
  );

  return () => {
    controller.abort();
    cancelAnimationFrame(frame);
    card.style.removeProperty('--reflection-x');
    card.style.removeProperty('--reflection-y');
  };
}
