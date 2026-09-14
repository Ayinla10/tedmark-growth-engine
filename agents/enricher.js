import {
  getLeadsNeedingContactInfo,
  updateLeadContact,
  getLeadById,
  markLeadEnriched,
  ensureEnrichEventsTable,
  insertEnrichEvent,
  clearEnrichEvents,
  query,
} from '../tools/db.js';
import { buildLeadFilter } from '../tools/leadFilter.js';
import {
  findContactsOnWebsite,
  normalizePhone,
  verifyEmailDomain,
} from '../tools/contactFinder.js';
import { searchWeb, searchPlaces } from '../tools/searchClient.js';
import { lookupBusinessContacts } from '../tools/mapsClient.js';
import { fetchReadableContent, fetchSiteContent } from '../tools/jinaReader.js';

const KNOWN_AGGREGATORS = /cartogiraffe\.com|sportsgrounds\.me|foursquare\.com|yelp\.com|yellowpages\.|tripadvisor\.|businesslist\.|ghana-business-directory\.|companiesghana\.|bizeurope\.|cylex\.|hotfrog\.|n49\.com|infobel\.|whereis\.|findermaster\./i;

function classifySourceUrl(url, officialWebsite) {
  if (!url) return 'general_web_page';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const officialHost = officialWebsite ? new URL(officialWebsite).hostname.replace(/^www\./, '') : null;
    if (officialHost && host === officialHost) return 'official_site';
  } catch { /* ignore parse errors */ }
  if (KNOWN_AGGREGATORS.test(url)) return 'directory_aggregator';
  return 'general_web_page';
}

// Extract owner/manager name from page text — returns {name, snippet, tier} or null.
// sourceUrl and officialWebsite are used to compute provenance tier.
function extractOwnerName(text, sourceUrl = null, officialWebsite = null) {
  if (!text) return null;
  const patterns = [
    /(?:CEO|Founder|Owner|Director|Manager|MD|Managing Director)[:\s,]+([A-Z][a-z]+ [A-Z][a-z]+)/,
    /([A-Z][a-z]+ [A-Z][a-z]+),?\s+(?:CEO|Founder|Owner|Director|Manager)/,
    /(?:by|from)\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
  ];
  const lines = text.split('\n');
  for (const pattern of patterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const tier = classifySourceUrl(sourceUrl, officialWebsite);
        if (tier === 'general_web_page') return null; // too unreliable
        return { name: match[1].trim(), snippet: line.trim().slice(0, 200), tier, sourceUrl };
      }
    }
  }
  return null;
}

// Extract social media links from text
function extractSocialLinks(text) {
  const social = {};
  const fbMatch = text.match(/(?:facebook\.com\/)([\w.]+)/i);
  if (fbMatch) social.facebook = `https://facebook.com/${fbMatch[1]}`;
  const igMatch = text.match(/(?:instagram\.com\/)([\w.]+)/i);
  if (igMatch) social.instagram = `https://instagram.com/${igMatch[1]}`;
  const liMatch = text.match(/(?:linkedin\.com\/(?:in|company)\/)([\w-]+)/i);
  if (liMatch) social.linkedin = `https://linkedin.com/company/${liMatch[1]}`;
  return Object.keys(social).length > 0 ? social : null;
}

const CONTACT_KEYWORDS = /\b(email|contact|reach|write|info|enquir|inquiry|support|hello|bookings?|reservations?|get in touch)\b/i;
const COMMON_PROVIDERS = /^(gmail|yahoo|hotmail|outlook|icloud|me|live|googlemail)\./i;
const NOISE_DOMAINS = /sentry\.|doubleclick\.|googletagmanager\.|analytics\.|mailchimp\.|sendgrid\.|amazonaws\.|cloudfront\.|wpengine\.|wixpress\.|squarespace\./i;

// Score an email candidate. Returns a number; higher = more likely to be the real contact email.
// businessDomain: the hostname of the business's known website (e.g. "pippasfitness.com"), or null.
function scoreEmail(email, pageText, businessDomain) {
  const [local, domain] = email.split('@');
  if (!domain) return -1;
  if (NOISE_DOMAINS.test(domain)) return -1; // tracking/infra noise — hard reject

  let score = 0;

  // Domain match: email is from the business's own domain — strongest signal
  if (businessDomain && domain.endsWith(businessDomain)) score += 50;

  // Common personal providers (gmail etc.) — valid for small businesses but weaker
  if (COMMON_PROVIDERS.test(domain)) score += 5;

  // Email appears near a contact keyword in the page text
  const idx = pageText.toLowerCase().indexOf(email.toLowerCase());
  if (idx !== -1) {
    const window = pageText.slice(Math.max(0, idx - 150), idx + 150);
    if (CONTACT_KEYWORDS.test(window)) score += 20;
  }

  // Penalise obviously generic/noise local parts
  if (/noreply|no-reply|unsubscribe|bounce|postmaster|mailer-daemon|webmaster|donotreply/i.test(local)) score -= 100;

  // Prefer short, clean local parts (info, hello, contact, bookings)
  if (/^(info|hello|contact|bookings?|reservations?|enquir|support|admin)$/i.test(local)) score += 15;

  return score;
}

function businessDomainFrom(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, '');
  } catch { return null; }
}

export async function runEnricher({ limit, leadId, emit, agencyId, sector, city, since, lead_ids }) {
  try { await ensureEnrichEventsTable(); } catch { /* table may already exist */ }

  // emit() sends a live event — wrapped in try/catch so a DB hiccup never crashes the enricher
  const log = async (type, msg) => {
    try {
      if (emit) await emit(type, msg);
    } catch { /* ignore emit errors */ }
    console.log(`[enricher] [${type}] ${msg}`);
  };

  let leads;
  if (leadId) {
    try { await clearEnrichEvents(leadId); } catch { /* ignore */ }
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[enricher] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else if (sector || city || since || lead_ids) {
    const { conditions, params, nextIndex } = buildLeadFilter({ sector, city, since, lead_ids }, agencyId);
    const r = await query(
      `SELECT * FROM leads WHERE agency_id = $1 AND status != 'archived' AND enriched_at IS NULL ${conditions} ORDER BY created_at ASC LIMIT $${nextIndex}`,
      [...params, limit || 20]
    );
    leads = r.rows;
  } else {
    leads = await getLeadsNeedingContactInfo(limit, agencyId);
  }

  if (leads.length === 0) {
    console.log('[enricher] No leads need enrichment. Nothing to do.');
    return;
  }

  console.log(`[enricher] Enriching ${leads.length} leads...`);

  let emailsFound = 0;
  let phonesNormalized = 0;

  for (const lead of leads) {
    try {
    const updates = {};
    const notes = [];
    let foundEmails = [];
    let foundPhones = [];
    let websiteToSave = null;
    let ownerName = null;
    let socialLinks = null;
    // Maps email → source tier: 'official_site' | 'directory_aggregator' | 'general_web_page'
    // Used to decide trust level instead of scoring heuristics
    const emailSourceTier = {};

    await log('info', `Starting enrichment for "${lead.business_name}"...`);

    // ── Step 1: If we have a website, crawl it deeply ──────────────────────
    if (lead.website_url) {
      await log('info', `Visiting website: ${lead.website_url}`);
      try {
        const siteText = await fetchSiteContent(lead.website_url);
        if (siteText) {
          await log('info', `Read ${siteText.length} characters from site — extracting contacts...`);

          // Extract via Playwright for structured data (mailto/tel links)
          const contacts = await findContactsOnWebsite(lead.website_url);
          foundEmails = contacts.emails;
          foundPhones = contacts.phones;
          contacts.emails.forEach((e) => { emailSourceTier[e.toLowerCase()] = 'official_site'; });

          // Also scan raw text for emails/phones missed by Playwright
          const textEmails = siteText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
          textEmails.forEach((e) => {
            const low = e.toLowerCase();
            if (!foundEmails.includes(low)) foundEmails.push(low);
            if (!emailSourceTier[low]) emailSourceTier[low] = 'official_site';
          });

          const textPhones = siteText.match(/(?:\+?[\d][\d\s\-().]{6,15}[\d])/g) ?? [];
          textPhones.forEach((p) => foundPhones.push(p.trim()));

          // Owner name + social
          ownerName = extractOwnerName(siteText, lead.website_url, lead.website_url);
          socialLinks = extractSocialLinks(siteText);

          if (ownerName) await log('found', `Owner/manager detected: ${ownerName.name} (${ownerName.tier})`);
          if (socialLinks) await log('found', `Social links: ${Object.keys(socialLinks).join(', ')}`);
        }
      } catch (err) {
        await log('error', `Could not crawl website: ${err.message}`);
      }

    } else {
      // ── Step 2: No website — try Google Maps Places first, then web search ─

      // 2a. Geoapify — same source as the scout, free, no extra key needed
      try {
        await log('info', `Checking Geoapify for "${lead.business_name}"...`);
        const geo = await lookupBusinessContacts({ name: lead.business_name, location: lead.location ?? '', country: lead.country ?? 'GH' });
        if (geo?.phone) {
          foundPhones.push(geo.phone);
          await log('found', `Phone from Geoapify: ${geo.phone}`);
        }
        if (geo?.website && !lead.website_url) {
          websiteToSave = geo.website;
          await log('found', `Website from Geoapify: ${geo.website}`);
        }
      } catch (err) {
        await log('error', `Geoapify lookup failed: ${err.message}`);
      }

      // 2b. Serper Places (Google Maps) — richer data, needs SERPER_API_KEY
      if (foundPhones.length === 0 || (!lead.website_url && !websiteToSave)) {
      try {
        const placesQuery = `${lead.business_name} ${lead.location ?? ''}`;
        await log('info', `Checking Google Maps listing for "${lead.business_name}"...`);
        const gl = lead.country === 'NG' ? 'ng' : lead.country === 'ZA' ? 'za' : 'gh';
        const places = await searchPlaces({ query: placesQuery, gl });
        // Strip punctuation before comparing so "Pippa's" matches "pippas"
        const slug = (s) => s?.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim() ?? '';
        const nameSlug = slug(lead.business_name);
        const firstWord = nameSlug.split(/\s+/)[0];
        const match = places.find((p) => slug(p.title).includes(firstWord)) ?? places[0];
        if (match?.phone) {
          foundPhones.push(match.phone);
          await log('found', `Phone from Google Maps: ${match.phone}`);
        }
        if (match?.website && !lead.website_url) {
          websiteToSave = match.website;
          await log('found', `Website from Google Maps: ${match.website}`);
        }
      } catch (err) {
        await log('error', `Places lookup failed: ${err.message}`);
      }
      } // end Serper Places block

      // 2b.5 — Crawl the discovered website before falling back to web search
      const knownWebsite = websiteToSave || lead.website_url;
      if (knownWebsite && foundEmails.length === 0) {
        const isSocial = /facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|tiktok\.com/i.test(knownWebsite);
        if (!isSocial) {
          try {
            await log('info', `Crawling discovered website for email: ${knownWebsite}`);
            const contacts = await findContactsOnWebsite(knownWebsite);
            contacts.emails.forEach((e) => {
              const low = e.toLowerCase();
              if (!foundEmails.includes(low)) foundEmails.push(low);
              if (!emailSourceTier[low]) emailSourceTier[low] = 'official_site';
            });
            if (foundPhones.length === 0) contacts.phones.forEach((p) => foundPhones.push(p));

            const siteText = await fetchSiteContent(knownWebsite).catch(() => null);
            if (siteText) {
              const textEmails = siteText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
              textEmails.forEach((e) => {
                const low = e.toLowerCase();
                if (!foundEmails.includes(low)) foundEmails.push(low);
                if (!emailSourceTier[low]) emailSourceTier[low] = 'official_site';
              });
              if (!ownerName) ownerName = extractOwnerName(siteText, knownWebsite, knownWebsite);
              if (!socialLinks) socialLinks = extractSocialLinks(siteText);
            }

            if (foundEmails.length > 0) {
              await log('info', `[direct_website] Email found on ${knownWebsite}`);
            }
          } catch (err) {
            await log('error', `Website crawl failed: ${err.message}`);
          }
        }
      }

      // 2c. Web search — only if still missing email after Geoapify + Places + website crawl
      const stillNeedsSearch = !lead.email && foundEmails.length === 0;
      if (stillNeedsSearch) {
        try {
          const gl = lead.country === 'NG' ? 'ng' : lead.country === 'ZA' ? 'za' : lead.country === 'DE' ? 'de' : 'gh';
          const searchQuery = `"${lead.business_name}" ${lead.location ?? ''} contact`;
          await log('info', `Searching Google for "${lead.business_name}"...`);
          const results = await searchWeb({ query: searchQuery, count: 8, gl });
          await log('info', `Found ${results.length} search results — browsing each...`);

          const nameLower = lead.business_name.toLowerCase();
          const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
          function titleMatchesBusiness(title) {
            if (!title) return false;
            const t = title.toLowerCase();
            const matchedWords = nameWords.filter(w => t.includes(w));
            return matchedWords.length >= Math.max(1, Math.ceil(nameWords.length * 0.6));
          }

          for (const result of results) {
            const url = result.link;
            if (!url) continue;

            const isSocialOrNoise = /facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|yelp\.com|tripadvisor\.|linkedin\.com/i.test(url);
            if (isSocialOrNoise) {
              if (/facebook\.com|instagram\.com|linkedin\.com/i.test(url)) {
                if (!socialLinks) socialLinks = extractSocialLinks(url);
              }
              continue;
            }

            if (!titleMatchesBusiness(result.title) && !titleMatchesBusiness(result.snippet)) {
              await log('info', `Skipping unrelated result: ${result.title}`);
              continue;
            }

            try {
              await log('info', `Browsing: ${url}`);
              const text = await fetchReadableContent(url);
              if (!text) continue;

              const urlTier = classifySourceUrl(url, websiteToSave || lead.website_url);
              const emailMatches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
              emailMatches.forEach((e) => {
                const low = e.toLowerCase();
                if (!foundEmails.includes(low)) foundEmails.push(low);
                // Only upgrade tier, never downgrade (official_site > directory_aggregator > general_web_page)
                const TIER_RANK = { official_site: 3, directory_aggregator: 2, general_web_page: 1 };
                if ((TIER_RANK[urlTier] ?? 0) > (TIER_RANK[emailSourceTier[low]] ?? 0)) {
                  emailSourceTier[low] = urlTier;
                }
              });

              if (foundPhones.length === 0) {
                const phoneMatches = text.match(/(?:\+?[\d][\d\s\-().]{6,15}[\d])/g) ?? [];
                phoneMatches.forEach((p) => foundPhones.push(p.trim()));
              }

              if (!ownerName) ownerName = extractOwnerName(text, url, websiteToSave || lead.website_url);
              if (!socialLinks) socialLinks = extractSocialLinks(text);

              if (!websiteToSave && !lead.website_url && text.toLowerCase().includes(nameWords[0])) {
                websiteToSave = url;
              }

              if (foundEmails.length > 0 || foundPhones.length > 0) {
                await log('info', `Contact info found on ${url}`);
                break;
              }
            } catch { /* skip this result */ }
          }
        } catch (err) {
          await log('error', `Web search failed: ${err.message}`);
        }
      }
    }

    // Only save a real website — never a social media link
    const isSocialUrl = /facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|tiktok\.com/i.test(websiteToSave ?? '');
    if (websiteToSave && !isSocialUrl && !lead.website_url) updates.website_url = websiteToSave;

    // ── Step 3: Score, rank, verify and save email ───────────────────────
    if (!lead.email && foundEmails.length > 0) {
      const knownWebsite = updates.website_url || lead.website_url || websiteToSave;
      const bizDomain = businessDomainFrom(knownWebsite);
      const TIER_RANK = { official_site: 3, directory_aggregator: 2, general_web_page: 1 };
      const uniqueEmails = [...new Set(foundEmails)];
      await log('info', `Selecting from ${uniqueEmails.length} email candidate(s) by source tier...`);

      // Hard-reject noise/infra domains first, then sort by tier (highest first)
      const candidates = uniqueEmails
        .filter(email => scoreEmail(email, '', bizDomain) >= 0) // reuse noise-domain rejection
        .map(email => ({ email, tier: emailSourceTier[email] ?? 'general_web_page' }))
        .sort((a, b) => (TIER_RANK[b.tier] ?? 0) - (TIER_RANK[a.tier] ?? 0));

      for (const { email, tier } of candidates) {
        await log('info', `  Candidate: ${email} (tier: ${tier})`);

        const [, domain] = email.split('@');
        const domainMatchesBiz = bizDomain && domain.endsWith(bizDomain);

        if (tier === 'official_site' || domainMatchesBiz) {
          // Emails from the business's own site are trusted immediately
          updates.email = email;
          emailsFound++;
          notes.push(`email: ${email}`);
          await log('found', `Email saved: ${email} (official site — trusted)`);
          break;
        }

        if (tier === 'directory_aggregator') {
          // Aggregator emails need MX verification
          const domainOk = await verifyEmailDomain(email).catch(() => false);
          if (!domainOk) {
            await log('info', `  Skipping ${email} — MX check failed (aggregator source)`);
            continue;
          }
          updates.email = email;
          emailsFound++;
          notes.push(`email: ${email}`);
          await log('found', `Email saved: ${email} (directory aggregator, MX verified)`);
          break;
        }

        // general_web_page — needs MX AND proximity to a contact keyword
        const CONTACT_KEYWORDS_RE = /\b(email|contact|reach|write|info|enquir|inquiry|support|hello|bookings?|reservations?|get in touch)\b/i;
        const [local] = email.split('@');
        const isContactLocal = /^(info|hello|contact|bookings?|reservations?|enquir|support|admin)$/i.test(local);
        const domainOk = await verifyEmailDomain(email).catch(() => false);
        if (!domainOk) {
          await log('info', `  Skipping ${email} — MX check failed (general web page)`);
          continue;
        }
        if (!isContactLocal && !CONTACT_KEYWORDS_RE.test(email)) {
          await log('info', `  Skipping ${email} — general web page source, local part not a contact role`);
          continue;
        }
        updates.email = email;
        emailsFound++;
        notes.push(`email: ${email}`);
        await log('found', `Email saved: ${email} (general web, MX verified, contact role)`);
        break;
      }

      if (!updates.email) {
        await log('info', `No email passed source-tier quality checks — not saving any candidate`);
      }
    }

    // ── Step 4: Normalize phone ───────────────────────────────────────────
    const phoneCandidates = [lead.phone, ...foundPhones].filter(Boolean);
    let normalized = null;
    for (const candidate of phoneCandidates) {
      normalized = normalizePhone(candidate, lead.country);
      if (normalized) break;
    }

    if (normalized && normalized.e164 !== lead.phone) {
      updates.phone = normalized.e164;
      phonesNormalized++;
    }

    if (normalized) {
      const waNote = normalized.isMobile
        ? `WhatsApp-ready: ${normalized.waLink}`
        : `Landline (${normalized.e164}) — unlikely on WhatsApp`;
      notes.push(waNote);
      await log(normalized.isMobile ? 'found' : 'info', waNote);
    }

    // ── Step 5: Save owner name if found (with provenance) ───────────────
    if (ownerName && !lead.decision_maker_name) {
      updates.decision_maker_name = ownerName.name;
      updates.dm_name_source = { url: ownerName.sourceUrl, snippet: ownerName.snippet, tier: ownerName.tier };
      notes.push(`owner: ${ownerName.name} [${ownerName.tier}]`);
    }

    // ── Step 6: Persist ──────────────────────────────────────────────────
    if (Object.keys(updates).length > 0) {
      await updateLeadContact(lead.id, updates);
      const found = [
        updates.phone ? `phone ${updates.phone}` : null,
        updates.email ? `email ${updates.email}` : null,
        updates.website_url ? `website ${updates.website_url}` : null,
        updates.decision_maker_name ? `owner ${updates.decision_maker_name}` : null,
      ].filter(Boolean).join(', ');
      console.log(`Found: ${found}`);
      await log('done', `Done — found: ${found}`);
    } else if (notes.length > 0) {
      console.log(`Already up to date — no new contact info needed`);
      await log('done', `Already up to date — no new contact info needed`);
    } else {
      console.log(`Nothing found — no contact info available online for this business`);
      await log('done', `Nothing found — no contact info available online for this business`);
    }

    await markLeadEnriched(lead.id);
    } catch (err) {
      console.error(`[enricher] Failed on lead ${lead.id} (${lead.business_name}): ${err.message}`);
      await log('error', `Unexpected error: ${err.message}`);
    }
  }

  console.log(`[enricher] Done. ${emailsFound} emails found, ${phonesNormalized} phones normalized.`);
}
