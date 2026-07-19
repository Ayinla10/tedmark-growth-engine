import { chromium } from 'playwright';
import { normalizeListing } from './directoryParsing.js';

const BASE_URL = 'https://www.businessghana.com/site/directory';

// robots.txt on businessghana.com specifies "Crawl-delay: 10" — respected
// here as a pause after every page fetch, not just a courtesy comment.
const CRAWL_DELAY_MS = 10_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetches one page of listings for a category slug (e.g. "caterers").
// Returns [] once a page has no listing rows — callers use that to know
// the category is exhausted, same pattern as Scout/Web-Scout pagination.
export async function fetchDirectoryListings(categorySlug, page = 1) {
  const browser = await chromium.launch();

  try {
    const browserPage = await browser.newPage();
    const url = page > 1 ? `${BASE_URL}/${categorySlug}?page=${page}` : `${BASE_URL}/${categorySlug}`;
    await browserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const rawListings = await browserPage.locator('.all-listings-row').evaluateAll((rows) =>
      rows.map((row) => {
        const nameEl = row.querySelector('.listing-title a');
        const descriptionEl = row.querySelector('.description-row > div:first-child');
        const phoneEl = row.querySelector('.more-row strong');
        const locationEl = row.querySelector('.more-row .misc');

        return {
          name: nameEl?.textContent ?? '',
          detailPath: nameEl?.getAttribute('href') ?? null,
          description: descriptionEl?.textContent ?? '',
          phoneRaw: phoneEl?.textContent ?? '',
          location: locationEl?.textContent ?? '',
        };
      })
    );

    await sleep(CRAWL_DELAY_MS);

    return rawListings.map(normalizeListing).filter(Boolean);
  } finally {
    await browser.close();
  }
}
