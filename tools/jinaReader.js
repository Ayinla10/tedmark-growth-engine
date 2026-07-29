// Jina Reader (r.jina.ai) — free, no API key required, converts any URL
// into clean, readable text (strips nav/ads/scripts). Used to give
// Outreach/Proposal richer real content from a lead's website than the
// short homepage snippet the Qualifier's scraper captures, so drafts can
// reference specific services/offerings instead of just "you have no
// tracking installed" style signals.
const READER_BASE = 'https://r.jina.ai/';
const TIMEOUT_MS = 15_000;
const MAX_CHARS = 2000;

export function buildReaderUrl(targetUrl) {
  return `${READER_BASE}${targetUrl}`;
}

export async function fetchReadableContent(url) {
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(buildReaderUrl(url), { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[jina-reader] Non-OK response for ${url}: ${res.status}`);
      return null;
    }

    const text = await res.text();
    return text.trim().slice(0, MAX_CHARS) || null;
  } catch (err) {
    console.warn(`[jina-reader] Failed to read ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
