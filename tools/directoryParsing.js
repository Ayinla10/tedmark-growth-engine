// Pure helpers for BusinessGhana.com directory scraping — no Playwright/DOM
// calls here, so these are unit-testable without a live page.

// Real, verified BusinessGhana.com directory category slugs per Tedmark
// sector. Not every sector maps cleanly — "logistics" only has a
// subcategory-tile landing page on this directory (no direct listings to
// scrape), same class of gap as Geoapify's missing "event planning"
// category (see tools/mapsClient.js). Rather than guess a bad slug, it's
// simply left unmapped and skipped.
const SECTOR_CATEGORY_SLUGS = {
  restaurant: ['caterers'],
  restaurants: ['caterers'],
  clinic: ['clinic', 'hospital'],
  clinics: ['clinic', 'hospital'],
  school: ['high-school', 'secondary-schools'],
  schools: ['high-school', 'secondary-schools'],
  retail: ['supermarket', 'boutique'],
  shop: ['supermarket', 'boutique'],
  'real estate': ['real-estate-brokers-agents'],
  realestate: ['real-estate-brokers-agents'],
  'event planning': ['events-organisers-'],
  eventplanning: ['events-organisers-'],
};

export function resolveSectorSlugs(sector) {
  const normalized = sector.trim().toLowerCase();
  return SECTOR_CATEGORY_SLUGS[normalized] ?? [];
}

// Directory listings often show 2+ phone numbers separated by "|" or ";" —
// keep just the first, cleaned one, since that's what outreach actually uses.
export function cleanPhone(rawPhone) {
  if (!rawPhone) return null;
  const first = rawPhone.split(/[|;]/)[0].trim();
  return first || null;
}

// Some listing descriptions embed a Facebook/social link inline (e.g.
// "0244487089|  Facebook link: https://www.facebook.com/GoldiesSnS/"),
// mixed in with the phone number text rather than a separate field.
export function extractSocialUrl(rawText) {
  if (!rawText) return null;
  const match = rawText.match(/https?:\/\/(www\.)?(facebook|instagram|linkedin|twitter|x)\.com\/[^\s|]+/i);
  return match ? match[0] : null;
}

export function normalizeListing(raw) {
  const name = (raw.name ?? '').trim();
  if (!name) return null;

  return {
    businessName: name,
    description: (raw.description ?? '').trim(),
    phone: cleanPhone(raw.phoneRaw),
    socialUrl: extractSocialUrl(raw.phoneRaw) ?? extractSocialUrl(raw.description),
    location: (raw.location ?? '').trim() || null,
    detailUrl: raw.detailPath ? `https://www.businessghana.com${raw.detailPath}` : null,
  };
}
