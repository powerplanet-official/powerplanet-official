import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const base = process.argv[2] || 'https://powerplanet.pk';
const output = process.argv[3] || '/tmp/powerplanet-browser-audit.json';
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox'],
});
const report = {
  base,
  capturedAt: new Date().toISOString(),
  note: 'Single unthrottled lab samples. Event duration is not field INP; field Core Web Vitals require CrUX/Search Console.',
  pages: [],
};
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: mobile ? 390 : 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
      ...(mobile
        ? {
            userAgent:
              'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
          }
        : {}),
    });
    if (process.env.BROWSER_API_ORIGIN) {
      await context.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        await route.fulfill({
          response: await route.fetch({
            url: process.env.BROWSER_API_ORIGIN + url.pathname + url.search,
          }),
        });
      });
    }
    await context.addInitScript(() => {
      window.seoVitals = { lcp: null, cls: 0, maxEventDuration: null };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.seoVitals.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.seoVitals.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (entry.interactionId)
            window.seoVitals.maxEventDuration = Math.max(
              window.seoVitals.maxEventDuration || 0,
              entry.duration,
            );
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    });
    const page = await context.newPage();
    for (const path of ['/', '/category/solar-inverters', '/product/w11-35462']) {
      const errors = [];
      const onError = (error) => errors.push(error.message);
      page.on('pageerror', onError);
      try {
        const response = await page.goto(base + path, { waitUntil: 'load', timeout: 45000 });
        await page.locator('footer').waitFor({ timeout: 20000 });
        await page.waitForTimeout(1800);
        if (path === '/') {
          await page
            .getByRole('button', {
              name: mobile ? 'Open categories' : 'Shop By Category',
              exact: mobile,
            })
            .first()
            .click();
          await page.waitForTimeout(150);
        }
        const sample = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0];
          return {
            title: document.title,
            canonical: document.querySelector('link[rel="canonical"]')?.href || null,
            headings: [...document.querySelectorAll('h1')].map((node) => node.textContent.trim()),
            productLinks: document.querySelectorAll('a[href^="/product/"]').length,
            overflow: document.documentElement.scrollWidth > innerWidth,
            ...window.seoVitals,
            ttfb: navigation.responseStart - navigation.requestStart,
            domContentLoaded: navigation.domContentLoadedEventEnd,
            transferBytes: performance
              .getEntriesByType('resource')
              .reduce((sum, item) => sum + item.transferSize, navigation.transferSize),
          };
        });
        report.pages.push({ path, mobile, status: response.status(), ...sample, errors });
      } catch (error) {
        report.pages.push({ path, mobile, error: error.message, errors });
      }
      page.off('pageerror', onError);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
