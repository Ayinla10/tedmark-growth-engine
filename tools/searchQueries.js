// Pure, testable helpers for the Search-API discovery agent — building the
// dork-style queries and parsing results, kept free of network/DB calls.

const SOCIAL_HOST_PATTERN = /linkedin\.com|facebook\.com/i;

// One query per (sector, city) for each source type. General web dorks look
// for pages that mention contact info directly; LinkedIn/Facebook queries
// only ever search Google's index of those platforms — we never visit or
// scrape LinkedIn/Facebook itself, since both prohibit that in their terms.
export function buildQueries(sector, city) {
  return [
    { type: 'web', query: `"${sector}" "contact us" ${city}` },
    { type: 'web', query: `"${sector}" info@ ${city}` },
    { type: 'linkedin', query: `site:linkedin.com/company ${city} ${sector}` },
    { type: 'facebook', query: `site:facebook.com ${sector} ${city}` },
  ];
}

export function isSocialResult(link) {
  return SOCIAL_HOST_PATTERN.test(link);
}

// LinkedIn/Facebook results rarely link to the business's own site directly
// — but the snippet often mentions one. Pull the first non-social URL out
// of the snippet text, if any.
export function extractWebsiteFromSnippet(snippet) {
  if (!snippet) return null;
  const match = snippet.match(/https?:\/\/[^\s)]+/i);
  if (!match) return null;
  const url = match[0].replace(/[.,;:]+$/, '');
  if (SOCIAL_HOST_PATTERN.test(url)) return null;
  return url;
}

// Search result titles are usually "Business Name | Home" or
// "Business Name - Contact Us" — keep just the leading segment.
export function cleanBusinessName(title) {
  if (!title) return '';
  return title.split(/[|\-–—]/)[0].replace(/\s+/g, ' ').trim();
}

// Decide what to do with one search result: either a genuine candidate
// website to hand to the crawler, or nothing (skipped).
export function resolveCandidate(result) {
  const businessName = cleanBusinessName(result.title);
  if (!businessName) return null;

  const website = isSocialResult(result.link) ? extractWebsiteFromSnippet(result.snippet) : result.link;
  if (!website) return null;

  return { businessName, website };
}
