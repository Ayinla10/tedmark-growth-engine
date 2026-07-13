// Shared email extraction/filtering — used by both tools/contactFinder.js
// (crawling a business's own site) and tools/searchQueries.js (parsing
// search result snippets), so "what counts as a real email" is defined
// once instead of drifting between the two.

export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const JUNK_EMAIL_PATTERNS = [
  /@example\./i,
  /@sentry\./i,
  /@.*\.png$/i,
  /@.*\.jpg$/i,
  /^noreply@/i,
  /^no-reply@/i,
  /@wixpress\./i,
  /@godaddy\./i,
];

export function isJunkEmail(email) {
  return JUNK_EMAIL_PATTERNS.some((p) => p.test(email));
}

export function extractEmails(text) {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) ?? [];
  const unique = [...new Set(matches.map((m) => m.toLowerCase()))];
  return unique.filter((email) => !isJunkEmail(email));
}
