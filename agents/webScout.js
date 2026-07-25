import { searchWeb } from '../tools/searchClient.js';
import { resolveCandidate } from '../tools/searchQueries.js';
import { checkWebsiteExists } from '../tools/scraper.js';
import { insertLead, findLeadByNameAndLocation } from '../tools/db.js';

export async function runWebScout({ sector, city, query, queryType, offset = 0 }) {
  console.log(`[web-scout] Searching (${queryType}): "${query}" (offset ${offset})...`);

  let results;
  try {
    results = await searchWeb({ query, offset });
  } catch (err) {
    console.error(`[web-scout] Search failed: ${err.message}`);
    return { found: 0, saved: 0, skipped: 0, error: err.message };
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

    let websiteUrl = candidate.website;

    // A candidate website that doesn't actually resolve isn't worth a lead
    // record on its own — unless we also pulled a real email out of the
    // snippet, in which case that's still worth keeping.
    if (websiteUrl) {
      const reachable = await checkWebsiteExists(websiteUrl);
      if (!reachable) {
        console.log(`[web-scout] "${candidate.businessName}" website did not resolve: ${websiteUrl}`);
        websiteUrl = null;
      }
    }

    if (!websiteUrl && !candidate.email) {
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
        website_url: websiteUrl,
        phone: null,
        email: candidate.email,
        source: queryType === 'web' ? 'web' : queryType,
        social_url: candidate.socialUrl,
        discovery_evidence: {
          query,
          title: result.title,
          link: result.link,
          snippet: result.snippet,
        },
      });

      saved += 1;
      console.log(`[web-scout] Saved lead: ${lead.business_name} (${lead.id}) — website: ${websiteUrl ?? 'none'}, email: ${candidate.email ?? 'none'}`);
    } catch (err) {
      console.error(`[web-scout] Failed to save lead "${candidate.businessName}": ${err.message}`);
    }
  }

  console.log(`[web-scout] Done. Found ${results.length}, saved ${saved}, skipped ${skipped}.`);

  return { found: results.length, saved, skipped };
}
