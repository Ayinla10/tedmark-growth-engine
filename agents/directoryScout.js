import { fetchDirectoryListings } from '../tools/directoryClient.js';
import { insertLead, findLeadByNameAndLocation } from '../tools/db.js';

// Discovery via BusinessGhana.com's free public directory — no API key,
// no quota, and specifically tends to surface small/local businesses with
// no website at all (the phone-book-style entries Maps/web-search miss),
// which are exactly the highest-value leads for Tedmark's pitch.
export async function runDirectoryScout({ sector, categorySlug, page = 1 }) {
  console.log(`[directory-scout] Fetching "${categorySlug}" listings (page ${page})...`);

  let listings;
  try {
    listings = await fetchDirectoryListings(categorySlug, page);
  } catch (err) {
    console.error(`[directory-scout] Fetch failed: ${err.message}`);
    return { found: 0, saved: 0, skipped: 0 };
  }

  console.log(`[directory-scout] Found ${listings.length} listings. Processing...`);

  let saved = 0;
  let skipped = 0;

  for (const listing of listings) {
    try {
      const existing = await findLeadByNameAndLocation(listing.businessName, listing.location ?? sector);
      if (existing) {
        console.log(`[directory-scout] Skipped duplicate: ${listing.businessName} (already saved as ${existing.id})`);
        skipped += 1;
        continue;
      }

      const lead = await insertLead({
        business_name: listing.businessName,
        sector,
        location: listing.location,
        website_url: null,
        phone: listing.phone,
        email: null,
        source: 'directory',
        social_url: listing.socialUrl,
        discovery_evidence: {
          query: categorySlug,
          title: listing.businessName,
          link: listing.detailUrl,
          snippet: listing.description,
        },
      });

      saved += 1;
      console.log(`[directory-scout] Saved lead: ${lead.business_name} (${lead.id}) — location: ${listing.location ?? 'unknown'}`);
    } catch (err) {
      console.error(`[directory-scout] Failed to save lead "${listing.businessName}": ${err.message}`);
    }
  }

  console.log(`[directory-scout] Done. Found ${listings.length}, saved ${saved}, skipped ${skipped}.`);

  return { found: listings.length, saved, skipped };
}
