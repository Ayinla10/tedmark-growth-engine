import { searchBusinesses } from '../tools/mapsClient.js';
import { checkWebsiteExists } from '../tools/scraper.js';
import { insertLead, findLeadByNameAndLocation } from '../tools/db.js';

export async function runScout({ sector, city, limit, offset = 0 }) {
  console.log(`[scout] Searching for "${sector}" businesses in "${city}" (limit ${limit}, offset ${offset})...`);

  let businesses;
  try {
    businesses = await searchBusinesses({ sector, city, limit, offset });
  } catch (err) {
    console.error(`[scout] Places search failed: ${err.message}`);
    return { found: 0, saved: 0, skipped: 0, error: err.message };
  }

  console.log(`[scout] Found ${businesses.length} businesses. Processing...`);

  let saved = 0;
  let skipped = 0;

  for (const business of businesses) {
    if (!business.name || business.name === 'Unnamed business') {
      console.log('[scout] Skipped a business with no name.');
      skipped += 1;
      continue;
    }

    const location = business.address ?? city;

    try {
      const existing = await findLeadByNameAndLocation(business.name, location);
      if (existing) {
        console.log(`[scout] Skipped duplicate: ${business.name} (already saved as ${existing.id})`);
        skipped += 1;
        continue;
      }

      const hasWebsite = business.website ? await checkWebsiteExists(business.website) : false;

      const lead = await insertLead({
        business_name: business.name,
        sector,
        location,
        website_url: hasWebsite ? business.website : null,
        phone: business.phone,
        email: null,
      });

      saved += 1;
      console.log(
        `[scout] Saved lead: ${lead.business_name} (${lead.id}) — website: ${hasWebsite ? 'yes' : 'no'}`
      );
    } catch (err) {
      console.error(`[scout] Failed to save lead "${business.name}": ${err.message}`);
    }
  }

  console.log(`[scout] Done. Saved ${saved}, skipped ${skipped}.`);

  return { found: businesses.length, saved, skipped };
}
