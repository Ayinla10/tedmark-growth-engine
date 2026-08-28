const READER_BASE = 'https://r.jina.ai/';
const TIMEOUT_MS = 20_000;
const MAX_CHARS = 8000;

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

// Fetch multiple pages from a site (home + contact + about) and merge content
export async function fetchSiteContent(baseUrl) {
  const pages = [baseUrl];

  // Discover contact/about sub-pages from the homepage text first
  const homeText = await fetchReadableContent(baseUrl);
  if (!homeText) return null;

  // Look for contact/about paths mentioned in the content
  const subpaths = ['/contact', '/about', '/contact-us', '/about-us'];
  for (const path of subpaths) {
    try {
      const url = new URL(path, baseUrl).toString();
      if (!pages.includes(url)) pages.push(url);
    } catch { /* skip malformed */ }
  }

  const texts = [homeText];
  for (const url of pages.slice(1)) {
    const text = await fetchReadableContent(url);
    if (text) texts.push(text);
  }

  return texts.join('\n\n---\n\n').slice(0, MAX_CHARS * 2);
}
