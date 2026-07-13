// Pure helpers for deduplicating leads across multiple discovery sources.
// Maps-based Scout gives a full formatted address as `location`; web-scout
// only has the city name — exact string matching missed real duplicates
// once there was more than one discovery path into the leads table.

const BUSINESS_SUFFIX_PATTERN = /\s+(ltd|limited|gh|ghana|inc|co|company)\.?$/i;

export function normalizeBusinessName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(BUSINESS_SUFFIX_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// True if the two location strings plausibly refer to the same place —
// exact match, or one contains the other (handles "Accra" vs a full
// formatted address that ends with "..., Accra, Ghana").
export function isSameLocation(a, b) {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;
  return x.includes(y) || y.includes(x);
}
