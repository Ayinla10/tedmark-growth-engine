import dotenv from 'dotenv';

dotenv.config();

const SEARCH_URL = 'https://www.googleapis.com/customsearch/v1';

function getConfig() {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) {
    throw new Error('GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX missing from .env — cannot run web search discovery.');
  }
  return { apiKey, cx };
}

// Wraps Google's Programmable Search Engine (Custom Search JSON API) rather
// than scraping Google's search results page directly — the latter gets
// blocked/CAPTCHA'd at any real volume and is against Google's terms.
export async function searchWeb({ query, start = 1, num = 10 }) {
  const { apiKey, cx } = getConfig();

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    start: String(start),
    num: String(Math.min(num, 10)),
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Google Custom Search API error: ${data.error?.message ?? res.statusText}`);
  }

  return (data.items ?? []).map((item) => ({
    title: item.title ?? '',
    link: item.link ?? '',
    snippet: item.snippet ?? '',
  }));
}
