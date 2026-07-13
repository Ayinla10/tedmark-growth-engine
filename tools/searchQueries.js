// Pure, testable helpers for the Search-API discovery agent — building the
// dork-style queries and parsing results, kept free of network/DB calls.

import { extractEmails } from './emailUtils.js';

const SOCIAL_HOST_PATTERN = /linkedin\.com|facebook\.com/i;

// Common local-parts Ghanaian SME sites actually publish, combined into a
// single OR-grouped query instead of one query per prefix — covers all of
// them for the same one unit of API quota, rather than multiplying query
// count (and cost) by the number of prefixes.
const EMAIL_PREFIX_TERMS = ['info@', 'contact@', 'sales@', 'admin@', 'hello@', 'support@', 'enquiries@', 'bookings@'];

// One query per (sector, city) for each source type. General web dorks look
// for pages that mention contact info directly; LinkedIn/Facebook queries
// only ever search the index of those platforms — we never visit or scrape
// LinkedIn/Facebook itself, since both prohibit that in their terms.
export function buildQueries(sector, city) {
  const emailGroup = EMAIL_PREFIX_TERMS.join(' OR ');
  return [
    { type: 'web', query: `"${sector}" "contact us" ${city}` },
    { type: 'web', query: `"${sector}" ${city} (${emailGroup})` },
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

// One of our own query types is built specifically to surface pages where
// an email address appears in the snippet text — extract it, using the
// same junk-filtering rules as the website crawler.
export function extractEmailFromResult(result) {
  const found = extractEmails(`${result.title ?? ''} ${result.snippet ?? ''}`);
  return found[0] ?? null;
}

// Search result titles are usually "Business Name | Home" or
// "Business Name - Contact Us" — keep just the leading segment.
export function cleanBusinessName(title) {
  if (!title) return '';
  return title.split(/[|\-–—]/)[0].replace(/\s+/g, ' ').trim();
}

// Decide what to do with one search result: a genuine candidate to hand to
// the crawler (business name + whatever combination of website/email/social
// profile we could find), or nothing (skipped).
export function resolveCandidate(result) {
  const businessName = cleanBusinessName(result.title);
  if (!businessName) return null;

  const social = isSocialResult(result.link);
  const website = social ? extractWebsiteFromSnippet(result.snippet) : result.link;
  const email = extractEmailFromResult(result);
  const socialUrl = social ? result.link : null;

  if (!website && !email) return null;

  return { businessName, website, email, socialUrl };
}
