export function initFaq() {
  const controller = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set<Animation>();

  document.querySelectorAll<HTMLDetailsElement>('.faq-item').forEach((details) => {
    const summary = details.querySelector('summary');
    const answer = details.querySelector<HTMLElement>('.faq-answer');
    if (!summary || !answer) return;
    let targetOpen = details.open;
    let currentAnimation: Animation | undefined;

    summary.addEventListener('click', (event) => {
      if (reducedMotion.matches) {
        targetOpen = !details.open;
        return;
      }
      event.preventDefault();
      targetOpen = !targetOpen;
      const currentHeight = details.open ? answer.getBoundingClientRect().height : 0;
      currentAnimation?.cancel();
      details.open = true;
      const fullHeight = answer.scrollHeight;
      const animation = answer.animate(
        [
          { height: `${currentHeight}px`, opacity: targetOpen ? 0.35 : 1 },
          { height: `${targetOpen ? fullHeight : 0}px`, opacity: targetOpen ? 1 : 0 },
        ],
        { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' },
      );
      currentAnimation = animation;
      animations.add(animation);
      animation.finished.then(() => {
        if (currentAnimation !== animation) return;
        if (!targetOpen) details.open = false;
        currentAnimation = undefined;
        animation.cancel();
      }).catch(() => {}).finally(() => animations.delete(animation));
    }, { signal: controller.signal });
  });

  return () => {
    controller.abort();
    animations.forEach((animation) => animation.cancel());
  };
}
