import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { gsap } from 'gsap';
export function initCarousel(reduced: boolean) {
  const stage = document.querySelector<HTMLElement>('[data-carousel]')!;
  const videos = Array.from(stage.querySelectorAll<HTMLVideoElement>('video'));
  const button = stage.querySelector<HTMLButtonElement>(
    '[data-motion-toggle]',
  )!;
  button.hidden = reduced;
  const controller = new AbortController();
  const signal = controller.signal;
  const css = getComputedStyle(document.documentElement);
  const duration = parseFloat(css.getPropertyValue('--duration-crossfade'));
  const interval = parseFloat(css.getPropertyValue('--duration-slide')) * 1000;
  let active = 0,
    paused = reduced,
    destroyed = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  let transition: gsap.core.Tween | undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 8;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const color = (video: HTMLVideoElement) => {
    if (!context) return;
    try {
      context.drawImage(video, 0, 0, 48, 8);
      const pixels = context.getImageData(0, 0, 48, 8).data;
      let r = 0,
        g = 0,
        b = 0,
        w = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const max = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
        const min = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
        const weight = (max - min) / 255;
        if (max > 45 && weight > 0.2) {
          r += pixels[i] * weight;
          g += pixels[i + 1] * weight;
          b += pixels[i + 2] * weight;
          w += weight;
        }
      }
      if (w)
        stage.style.setProperty(
          '--visual-tint',
          `${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)}`,
        );
    } catch {}
  };
  const updateButton = () => {
    button.dataset.i18n = paused ? 'play' : 'pause';
    button.textContent = (document.documentElement.lang === 'es' ? es : en)[
      paused ? 'play' : 'pause'
    ];
    button.setAttribute('aria-pressed', String(paused));
  };
  const schedule = (delay = interval) => {
    clearTimeout(timer);
    if (!paused && !destroyed && !document.hidden)
      timer = setTimeout(next, delay);
  };
  const next = async () => {
    if (paused || destroyed || document.hidden) return;
    const index = (active + 1) % videos.length;
    const incoming = videos[index];
    const outgoing = videos[active];
    if (incoming.readyState < 2) {
      incoming.load();
      schedule();
      return;
    }
    incoming.currentTime = 0;
    try {
      await incoming.play();
    } catch {
      schedule();
      return;
    }
    if (destroyed || paused) return;
    const reveal = () => {
      if (destroyed || paused) return;
      incoming.style.zIndex = '2';
      outgoing.style.zIndex = '1';
      color(incoming);
      transition = gsap.to(incoming, {
        opacity: 1,
        duration,
        ease: 'sine.inOut',
        onComplete: () => {
          outgoing.style.opacity = '0';
          outgoing.pause();
          incoming.style.zIndex = '1';
          active = index;
          schedule(interval - duration * 1000);
        },
      });
    };
    if ('requestVideoFrameCallback' in incoming)
      incoming.requestVideoFrameCallback(reveal);
    else requestAnimationFrame(reveal);
  };
  videos.forEach((v) => {
    v.muted = true;
    v.style.opacity = '0';
    v.style.zIndex = '0';
    v.pause();
  });
  const start = () => {
    if (destroyed) return;
    videos[0].style.opacity = '1';
    color(videos[0]);
    if (!paused)
      videos[0]
        .play()
        .then(() => schedule(interval - duration * 1000))
        .catch(() => {
          paused = true;
          updateButton();
        });
  };
  if (videos[0].readyState >= 2) start();
  else videos[0].addEventListener('loadeddata', start, { once: true, signal });
  button.addEventListener(
    'click',
    () => {
      if (reduced) return;
      paused = !paused;
      updateButton();
      if (paused) {
        clearTimeout(timer);
        videos.forEach((v) => v.pause());
        transition?.pause();
      } else {
        videos
          .filter((v) => v.style.opacity !== '0')
          .forEach((v) => v.play().catch(() => {}));
        transition?.resume();
        schedule();
      }
    },
    { signal },
  );
  if (reduced) {
    button.hidden = true;
    videos.forEach((v) => {
      v.removeAttribute('autoplay');
      v.pause();
    });
  }
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        clearTimeout(timer);
        videos.forEach((v) => v.pause());
        transition?.pause();
      } else if (!paused) {
        videos
          .filter((v) => v.style.opacity !== '0')
          .forEach((v) => v.play().catch(() => {}));
        transition?.resume();
        schedule();
      }
    },
    { signal },
  );
  document.addEventListener('hyro:language', updateButton, { signal });
  updateButton();
  return () => {
    destroyed = true;
    clearTimeout(timer);
    controller.abort();
    transition?.kill();
    videos.forEach((v) => v.pause());
  };
}
