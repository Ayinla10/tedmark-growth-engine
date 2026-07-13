import { searchWeb } from '../tools/searchClient.js';
import { resolveCandidate } from '../tools/searchQueries.js';
import { insertLead, findLeadByNameAndLocation } from '../tools/db.js';

export async function runWebScout({ sector, city, query, queryType, start = 1 }) {
  console.log(`[web-scout] Searching (${queryType}): "${query}" (start ${start})...`);

  let results;
  try {
    results = await searchWeb({ query, start });
  } catch (err) {
    console.error(`[web-scout] Search failed: ${err.message}`);
    return { found: 0, saved: 0, skipped: 0 };
  }

  console.log(`[web-scout] Found ${results.length} results. Processing...`);

  let saved = 0;
  let skipped = 0;

  for (const result of results) {
    const candidate = resolveCandidate(result);

    if (!candidate) {
      skipped += 1;
      continue;
    }

    try {
      const existing = await findLeadByNameAndLocation(candidate.businessName, city);
      if (existing) {
        console.log(`[web-scout] Skipped duplicate: ${candidate.businessName} (already saved as ${existing.id})`);
        skipped += 1;
        continue;
      }

      const lead = await insertLead({
        business_name: candidate.businessName,
        sector,
        location: city,
        website_url: candidate.website,
        phone: null,
        email: null,
        source: queryType === 'web' ? 'web' : queryType,
      });

      saved += 1;
      console.log(`[web-scout] Saved lead: ${lead.business_name} (${lead.id}) — ${candidate.website}`);
    } catch (err) {
      console.error(`[web-scout] Failed to save lead "${candidate.businessName}": ${err.message}`);
    }
  }

  console.log(`[web-scout] Done. Found ${results.length}, saved ${saved}, skipped ${skipped}.`);

  return { found: results.length, saved, skipped };
}
