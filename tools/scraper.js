import { chromium } from 'playwright';

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

    return { title, metaDescription, textSnippet };
  } catch (err) {
    console.warn(`[scraper] Failed to scrape ${url}: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}
