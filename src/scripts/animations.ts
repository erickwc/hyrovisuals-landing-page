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
    if (document.querySelector('.hero')) {
      const timeline = gsap.timeline({ defaults: { ease } });
      document.querySelectorAll<HTMLElement>('.title-line').forEach((line) => {
        const split = SplitText.create(line, {
          type: 'lines',
          mask: 'lines',
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 110,
              duration: slow,
              ease,
            });
          },
        });
        splits.push(split);
      });
      timeline
        .from('[data-anim="line"]', { scaleY: 0, duration: slow, stagger }, 0)
        .from(
          '[data-anim="label"],[data-anim="description"],[data-anim="button"]',
          { y: number('--reveal-y'), autoAlpha: 0, duration: base, stagger },
          base / 2,
        )
        .from(
          '[data-anim="visual"]',
          {
            scale: number('--visual-scale'),
            clipPath: 'inset(0 50% 0 50%)',
            duration: slow,
          },
          base,
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
        y: number('--reveal-y'),
        autoAlpha: 0,
        stagger,
        duration: base,
        ease,
        scrollTrigger: { trigger: '.features', start: 'top 92%', once: true },
      });
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
        );
        if (button) {
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
      }
    }
    if (document.querySelector('.purchase-section')) {
      gsap
        .timeline({
          scrollTrigger: {
            trigger: '.purchase-section',
            start: 'top 72%',
            once: true,
          },
        })
        .from('[data-anim="purchase-copy"]', {
          y: 24,
          autoAlpha: 0,
          duration: base,
          stagger: 0.09,
          ease,
        })
        .from(
          '[data-anim="purchase-benefit"]',
          {
            y: 16,
            autoAlpha: 0,
            duration: base * 0.8,
            stagger: 0.055,
            ease,
          },
          '-=0.3',
        )
        .from(
          '[data-anim="purchase-card"]',
          { y: 24, autoAlpha: 0, duration: slow, ease },
          0.16,
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
