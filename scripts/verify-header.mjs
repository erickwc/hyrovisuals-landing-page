import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  locale: 'en-US',
  colorScheme: 'dark',
});
const page = await context.newPage();
const errors = [];
page.on(
  'pageerror',
  (e) => (errors.push(e.message), console.log('PAGE ERROR', e.message)),
);
for (const width of [1440, 768, 360]) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
  await page.goto('http://127.0.0.1:4323');
  await page.waitForFunction(
    () => document.documentElement.dataset.hyroReady === 'true',
  );
  await page.waitForTimeout(2600);
  await page.screenshot({
    path: `artifacts/header-${width}.png`,
    fullPage: true,
  });
  console.log(
    width,
    await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      width: innerWidth,
      title: document.querySelector('h1').getBoundingClientRect().toJSON(),
      videos: [...document.querySelectorAll('video')].map((v) => ({
        ready: v.readyState,
        opacity: getComputedStyle(v).opacity,
        time: v.currentTime,
      })),
      theme: document.documentElement.dataset.theme,
      lang: document.documentElement.lang,
    })),
  );
}
await page.selectOption('#language', 'es');
console.log('Spanish', await page.locator('.hero-title').innerText());
await page.locator('[data-theme-toggle]').click();
console.log('Theme', await page.locator('html').getAttribute('data-theme'));
await page.reload();
console.log(
  'Persistence',
  await page.locator('html').getAttribute('data-theme'),
  await page.locator('html').getAttribute('lang'),
);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(700);
console.log(
  'Reduced',
  await page.locator('video').evaluateAll((v) => v.every((x) => x.paused)),
);
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.reload();
await page.waitForFunction(
  () => document.documentElement.dataset.hyroReady === 'true',
);
await page.waitForTimeout(2200);
const frames = await page.evaluate(async () => {
  const results = [];
  for (let n = 0; n < 165; n++) {
    const videos = [...document.querySelectorAll('video')];
    results.push(
      videos.map((v) => ({
        opacity: Number(getComputedStyle(v).opacity),
        ready: v.readyState,
      })),
    );
    await new Promise((r) => setTimeout(r, 80));
  }
  return results;
});
console.log(
  'Invalid frames',
  frames
    .filter((f) => !f.some((v) => v.opacity > 0.99 && v.ready >= 2))
    .slice(0, 5),
);
const seen = new Set();
for (const frame of frames) {
  assert.ok(
    frame.some((v) => v.opacity > 0.99 && v.ready >= 2),
    'Missing opaque decoded video',
  );
  frame.forEach((v, i) => {
    if (v.opacity > 0.99) seen.add(i);
  });
}
assert.equal(seen.size, 4);
assert.equal(errors.length, 0);
console.log('Crossfade: all four videos, opaque decoded coverage throughout');
await page.screenshot({
  path: 'artifacts/header-light-es.png',
  fullPage: true,
});
console.log('Errors', errors);
await browser.close();
