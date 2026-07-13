import dotenv from 'dotenv';
import { recordSearchApiUsage } from './db.js';

dotenv.config();

const SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';

function getApiKey() {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY is missing from .env — cannot run web search discovery.');
  }
  return apiKey;
}

// Wraps Brave's Web Search API rather than scraping a search results page
// directly — the latter gets blocked/CAPTCHA'd at any real volume and is
// against every search engine's terms of service. Every real call is
// logged (recordSearchApiUsage) so the dashboard can show real monthly
// usage against Brave's free-tier quota.
export async function searchWeb({ query, offset = 0, count = 10 }) {
  const apiKey = getApiKey();

  const params = new URLSearchParams({
    q: query,
    offset: String(offset),
    count: String(Math.min(count, 20)),
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Brave Search API error: ${data.message ?? res.statusText}`);
  }

  await recordSearchApiUsage('brave').catch((err) => {
    console.warn(`[searchClient] Could not record API usage: ${err.message}`);
  });

  const results = data.web?.results ?? [];

  return results.map((item) => ({
    title: item.title ?? '',
    link: item.url ?? '',
    snippet: item.description ?? '',
  }));
}
