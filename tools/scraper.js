import { chromium } from 'playwright';
import { detectSiteSignals } from './siteSignals.js';

export async function checkWebsiteExists(url) {
  if (!url) return false;

  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch (err) {
    console.warn(`[scraper] HEAD check failed for ${url}: ${err.message}`);
    return false;
  }
}

export async function scrapeWebsite(url) {
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const title = await page.title();

    const metaDescription = await page
      .locator('meta[name="description"]')
      .first()
      .getAttribute('content')
      .catch(() => null);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const textSnippet = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500);

    // Gathered from the same page visit — no extra scraping pass needed —
    // and fed into the pure detector so the qualifier can reason over real
    // signals (mobile-friendly, tracking, CTAs, booking system) instead of
    // just "does a website exist."
    const html = await page.content().catch(() => '');
    const hasViewportMeta = await page.locator('meta[name="viewport"]').count().then((c) => c > 0).catch(() => false);
    const hasH1 = await page.locator('h1').count().then((c) => c > 0).catch(() => false);

    const signals = detectSiteSignals({
      html,
      bodyText,
      hasViewportMeta,
      hasH1,
      hasMetaDescription: Boolean(metaDescription),
    });

    return { title, metaDescription, textSnippet, signals };
  } catch (err) {
    console.warn(`[scraper] Failed to scrape ${url}: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
