import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { initPreferences } from './preferences';
import { initAnimations } from './animations';
import { initCarousel } from './carousel';
import { initAccountPage } from './account';
import { initAdminPage } from './admin';
import { initPurchaseCheckout } from './purchase-checkout';
import { initLibraryPage } from './library';
import { initPurchaseProcessing } from './purchase-processing';
import { initWhopCheckout } from './whop-checkout';
import { initWompiHosted } from './wompi-hosted';
import { initAccountMenu } from './account-menu';
import { initLicenseChoice } from './license-choice';
import { initProducerCarousel } from './producer-carousel';
import { initFaq } from './faq';
gsap.registerPlugin(ScrollTrigger, SplitText);
let cleanup = () => {};
async function init() {
  cleanup();
  const stopAccountMenu = initAccountMenu();
  if (['account', 'admin', 'library', 'processing', 'checkout'].includes(document.body.dataset.page ?? '')) {
    const stopPreferences = initPreferences(() => {
      document.dispatchEvent(new Event('hyro:language'));
    });
    const stopAccount = document.body.dataset.page === 'admin' ? initAdminPage()
      : document.body.dataset.page === 'library' ? initLibraryPage()
      : document.body.dataset.page === 'processing' ? initPurchaseProcessing()
      : document.body.dataset.page === 'checkout' ? (document.querySelector('[data-wompi-hosted]') ? initWompiHosted() : initWhopCheckout()) : initAccountPage();
    cleanup = () => {
      stopAccount();
      stopPreferences();
      stopAccountMenu();
    };
    document.documentElement.dataset.hyroReady = 'true';
    return;
  }
  let cancelled = false;
  let stopAnimations = () => {};
  let stopCarousel = () => {};
  const stopCheckout = initPurchaseCheckout();
  const stopLicenseChoice = initLicenseChoice();
  const stopProducerCarousel = initProducerCarousel();
  const stopFaq = initFaq();
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
  };
  cleanup = () => {
    cancelled = true;
    stopPreferences();
    stopAnimations();
    stopCarousel();
    stopCheckout();
    stopLicenseChoice();
    stopProducerCarousel();
    stopFaq();
    stopAccountMenu();
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
