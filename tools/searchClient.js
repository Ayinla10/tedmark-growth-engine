import dotenv from 'dotenv';
import { recordSearchApiUsage } from './db.js';

dotenv.config();

// SearXNG — self-hosted, unlimited, no API key (primary when running)
// Spin up with: docker run -d -p 8888:8080 searxng/searxng
// Set SEARXNG_URL=http://localhost:8888 in .env (or leave blank to skip)
async function searchSearXNG({ query, count = 10 }) {
  const base = process.env.SEARXNG_URL;
  if (!base) throw new Error('SEARXNG_URL not set');

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    engines: 'google,bing,duckduckgo',
    language: 'en',
    safesearch: '0',
    pageno: '1',
  });

  const res = await fetch(`${base}/search?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`SearXNG error: ${res.statusText}`);
  const data = await res.json();

  return (data.results ?? []).slice(0, count).map((r) => ({
    title: r.title ?? '',
    link: r.url ?? '',
    snippet: r.content ?? '',
  }));
}

// Serper.dev — Google Search API (primary)
async function searchSerper({ query, count = 10 }) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY missing from .env');

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: Math.min(count, 10), gl: 'gh' }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Serper API error: ${data.message ?? res.statusText}`);

  await recordSearchApiUsage('serper').catch(() => {});

  const organic = data.organic ?? [];
  return organic.map((item) => ({
    title: item.title ?? '',
    link: item.link ?? '',
    snippet: item.snippet ?? '',
  }));
}

// Brave Search API (fallback)
async function searchBrave({ query, count = 10 }) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('BRAVE_SEARCH_API_KEY missing from .env');

  const params = new URLSearchParams({ q: query, count: String(Math.min(count, 20)) });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Brave Search error: ${data.message ?? res.statusText}`);

  await recordSearchApiUsage('brave').catch(() => {});

  return (data.web?.results ?? []).map((item) => ({
    title: item.title ?? '',
    link: item.url ?? '',
    snippet: item.description ?? '',
  }));
}

// Serper Places search — returns structured Google Maps data including phone numbers
export async function searchPlaces({ query, gl = 'gh' }) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/maps', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl }),
    });

    const data = await res.json();
    if (!res.ok) return [];

    await recordSearchApiUsage('serper').catch(() => {});

    return (data.places ?? []).map((p) => ({
      title: p.title ?? '',
      address: p.address ?? '',
      phone: p.phoneNumber ?? null,
      website: p.website ?? null,
      rating: p.rating ?? null,
    }));
  } catch {
    return [];
  }
}

export async function searchWeb({ query, offset = 0, count = 10 }) {
  // 1. SearXNG — self-hosted, unlimited, free (best option when running)
  if (process.env.SEARXNG_URL) {
    try {
      return await searchSearXNG({ query, count });
    } catch (err) {
      console.warn(`[searchClient] SearXNG failed, falling back to Serper: ${err.message}`);
    }
  }

  // 2. Serper.dev — paid but generous credits
  if (process.env.SERPER_API_KEY) {
    try {
      return await searchSerper({ query, count });
    } catch (err) {
      console.warn(`[searchClient] Serper failed, trying Brave: ${err.message}`);
    }
  }

  // 3. Brave Search — last resort
  if (process.env.BRAVE_SEARCH_API_KEY) {
    return await searchBrave({ query, count });
  }

  throw new Error('No search configured. Set SEARXNG_URL, SERPER_API_KEY, or BRAVE_SEARCH_API_KEY in .env');
}
