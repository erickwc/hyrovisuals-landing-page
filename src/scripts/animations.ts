import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
export function initAnimations(reduced: boolean) {
  if (reduced) return () => {};
  const css = getComputedStyle(document.documentElement);
  const number = (name: string) => parseFloat(css.getPropertyValue(name));
  const ease = css.getPropertyValue('--ease-gsap').trim();
  const base = number('--duration-base');
  const slow = number('--duration-slow');
  const stagger = number('--stagger');
  const splits: SplitText[] = [];
  const controller = new AbortController();
  const context = gsap.context(() => {
    const timeline = gsap.timeline({ defaults: { ease } });
    document.querySelectorAll<HTMLElement>('.title-line').forEach((line) => {
      const split = SplitText.create(line, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit(self) {
          return gsap.from(self.lines, {
            y: 10,
            autoAlpha: 0,
            duration: slow * 0.72,
            stagger: 0.08,
            ease,
          });
        },
      });
      splits.push(split);
    });
    timeline
      .from(
        '[data-anim="line"]',
        { autoAlpha: 0, duration: slow * 0.55, stagger: stagger * 0.5 },
        0,
      )
      .from(
        '[data-anim="label"]',
        {
          y: 4,
          autoAlpha: 0,
          duration: base * 0.65,
        },
        base * 0.28,
      )
      .from(
        '[data-anim="description"]',
        { y: 6, autoAlpha: 0, duration: base * 0.75 },
        base * 0.42,
      )
      .from(
        '[data-anim="button"]',
        { autoAlpha: 0, duration: base * 0.65 },
        base * 0.55,
      )
      .from(
        '[data-anim="visual"]',
        {
          scale: 0.996,
          autoAlpha: 0,
          filter: 'blur(8px)',
          duration: slow * 0.95,
        },
        base * 0.62,
      );
    gsap.to('[data-anim="dots"]', {
      opacity: number('--dot-pulse-opacity'),
      duration: number('--duration-pulse'),
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      stagger,
    });
    gsap.from('[data-anim="feature"]', {
      y: 7,
      autoAlpha: 0,
      stagger,
      duration: base * 0.75,
      ease,
      scrollTrigger: { trigger: '.features', start: 'top 92%', once: true },
    });
    gsap
      .timeline({
        scrollTrigger: {
          trigger: '.purchase-section',
          start: 'top 72%',
          once: true,
        },
      })
      .from('[data-anim="purchase-copy"]', {
        y: 8,
        autoAlpha: 0,
        duration: base * 0.75,
        stagger: 0.075,
        ease,
      })
      .from(
        '[data-anim="purchase-benefit"]',
        {
          y: 5,
          autoAlpha: 0,
          duration: base * 0.65,
          stagger: 0.055,
          ease,
        },
        '-=0.3',
      )
      .from(
        '[data-anim="purchase-card"]',
        { y: 8, autoAlpha: 0, duration: slow * 0.65, ease },
        0.16,
      );
    const mobile = matchMedia('(max-width: 767px)').matches;
    gsap.to('[data-anim="visual"]', {
      y: number(mobile ? '--parallax-mobile' : '--parallax-desktop'),
      ease: 'none',
      scrollTrigger: {
        trigger: '.visual-stage',
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
    if (
      matchMedia('(hover:hover) and (pointer:fine) and (min-width:768px)')
        .matches
    ) {
      const button = document.querySelector<HTMLElement>(
        '[data-anim="button"]',
      )!;
      button.addEventListener(
        'pointermove',
        (e) => {
          const bounds = button.getBoundingClientRect();
          gsap.to(button, {
            x:
              (e.clientX - bounds.left - bounds.width / 2) *
              number('--magnet-strength'),
            y:
              (e.clientY - bounds.top - bounds.height / 2) *
              number('--magnet-strength'),
            duration: base,
            ease,
          });
        },
        { signal: controller.signal },
      );
      button.addEventListener(
        'pointerleave',
        () => gsap.to(button, { x: 0, y: 0, duration: base, ease }),
        { signal: controller.signal },
      );
    }
  });
  const revertSplit = () => splits.forEach((s) => s.revert());
  document.addEventListener('hyro:before-language', revertSplit, {
    signal: controller.signal,
  });
  return () => {
    controller.abort();
    revertSplit();
    context.revert();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
}
