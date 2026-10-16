import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initPreferences } from './preferences';
import { initAnimations } from './animations';
import { initCarousel } from './carousel';
import { initPurchaseReflection } from './purchase-reflection';
import { initPurchaseCheckout } from './purchase-checkout';
gsap.registerPlugin(ScrollTrigger, SplitText);
let cleanup = () => {};
async function init() {
  cleanup();
  let cancelled = false;
  let stopAnimations = () => {};
  let stopCarousel = () => {};
  let stopReflection = () => {};
  const stopCheckout = initPurchaseCheckout();
  let lenis: Lenis | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stopPreferences = initPreferences(() => {
    document.dispatchEvent(new Event('hyro:language'));
    ScrollTrigger.refresh();
  });
  const tick = (time: number) => lenis?.raf(time * 1000);
  const motion = () => {
    stopAnimations();
    stopCarousel();
    stopReflection();
    lenis?.destroy();
    gsap.ticker.remove(tick);
    lenis = undefined;
    if (!reduced.matches) {
      lenis = new Lenis({ anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
    }
    stopAnimations = initAnimations(reduced.matches);
    stopCarousel = initCarousel(reduced.matches);
    stopReflection = initPurchaseReflection(reduced.matches);
  };
  cleanup = () => {
    cancelled = true;
    stopPreferences();
    stopAnimations();
    stopCarousel();
    stopReflection();
    stopCheckout();
    lenis?.destroy();
    gsap.ticker.remove(tick);
    reduced.removeEventListener('change', motion);
  };
  if (cancelled) return;
  motion();
  document.documentElement.dataset.hyroReady = 'true';
  reduced.addEventListener('change', motion);
}
document.addEventListener('astro:page-load', init);
document.addEventListener('astro:before-swap', () => cleanup());
init();
