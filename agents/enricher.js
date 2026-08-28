import {
  getLeadsNeedingContactInfo,
  updateLeadContact,
  getLeadById,
  markLeadEnriched,
  ensureEnrichEventsTable,
  insertEnrichEvent,
  clearEnrichEvents,
} from '../tools/db.js';
import {
  findContactsOnWebsite,
  normalizePhone,
  verifyEmailDomain,
} from '../tools/contactFinder.js';
import { searchWeb, searchPlaces } from '../tools/searchClient.js';
import { fetchReadableContent, fetchSiteContent } from '../tools/jinaReader.js';

// Extract owner/manager name from page text using simple heuristics + patterns
function extractOwnerName(text) {
  if (!text) return null;
  const patterns = [
    /(?:CEO|Founder|Owner|Director|Manager|MD|Managing Director)[:\s,]+([A-Z][a-z]+ [A-Z][a-z]+)/,
    /([A-Z][a-z]+ [A-Z][a-z]+),?\s+(?:CEO|Founder|Owner|Director|Manager)/,
    /(?:by|from)\s+([A-Z][a-z]+ [A-Z][a-z]+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
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

export async function runEnricher({ limit, leadId, emit }) {
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
  } else {
    leads = await getLeadsNeedingContactInfo(limit);
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

          // Also scan raw text for emails/phones missed by Playwright
          const textEmails = siteText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
          textEmails.forEach((e) => { if (!foundEmails.includes(e)) foundEmails.push(e.toLowerCase()); });

          const textPhones = siteText.match(/(?:\+?[\d][\d\s\-().]{6,15}[\d])/g) ?? [];
          textPhones.forEach((p) => foundPhones.push(p.trim()));

          // Owner name + social
          ownerName = extractOwnerName(siteText);
          socialLinks = extractSocialLinks(siteText);

          if (ownerName) await log('found', `Owner/manager detected: ${ownerName}`);
          if (socialLinks) await log('found', `Social links: ${Object.keys(socialLinks).join(', ')}`);
        }
      } catch (err) {
        await log('error', `Could not crawl website: ${err.message}`);
      }

    } else {
      // ── Step 2: No website — search Google for their business listing ──────
      try {
        // Include location and country in query to avoid wrong-country matches
        const searchQuery = `"${lead.business_name}" ${lead.location ?? ''} contact`;
        await log('info', `Searching Google for "${lead.business_name}"...`);
        const results = await searchWeb({ query: searchQuery, count: 8 });
        await log('info', `Found ${results.length} search results — browsing each...`);

        // First word check is too loose — require at least 2 words or 60% of name
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

          // Skip social media and noise entirely — never save as website_url
          const isSocialOrNoise = /facebook\.com|instagram\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|yelp\.com|tripadvisor\.|linkedin\.com/i.test(url);
          if (isSocialOrNoise) {
            // Still extract social links from the snippet for our social_links field
            if (/facebook\.com|instagram\.com|linkedin\.com/i.test(url)) {
              if (!socialLinks) socialLinks = extractSocialLinks(url);
            }
            continue;
          }

          // Skip results that clearly don't match this business
          if (!titleMatchesBusiness(result.title) && !titleMatchesBusiness(result.snippet)) {
            await log('info', `Skipping unrelated result: ${result.title}`);
            continue;
          }

          try {
            await log('info', `Browsing: ${url}`);
            const text = await fetchReadableContent(url);
            if (!text) continue;

            // Emails
            const emailMatches = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
            emailMatches.forEach((e) => foundEmails.push(e.toLowerCase()));

            // Phones
            const phoneMatches = text.match(/(?:\+?[\d][\d\s\-().]{6,15}[\d])/g) ?? [];
            phoneMatches.forEach((p) => foundPhones.push(p.trim()));

            // Owner name + social from this page
            if (!ownerName) ownerName = extractOwnerName(text);
            if (!socialLinks) socialLinks = extractSocialLinks(text);

            // Only save as website if the page content actually mentions the business name
            if (!websiteToSave && text.toLowerCase().includes(nameWords[0])) {
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

    // Only save a real website — never a social media link
    const isSocialUrl = /facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|tiktok\.com/i.test(websiteToSave ?? '');
    if (websiteToSave && !isSocialUrl && !lead.website_url) updates.website_url = websiteToSave;

    // ── Step 2b: Google Maps Places lookup for phone (when still missing) ─
    if (foundPhones.length === 0 && !lead.phone) {
      try {
        const placesQuery = `${lead.business_name} ${lead.location ?? ''}`;
        await log('info', `Checking Google Maps listing for phone number...`);
        const places = await searchPlaces({ query: placesQuery, gl: lead.country === 'NG' ? 'ng' : lead.country === 'ZA' ? 'za' : 'gh' });
        const match = places.find((p) =>
          p.title?.toLowerCase().includes(lead.business_name.toLowerCase().split(' ')[0].toLowerCase())
        ) ?? places[0];
        if (match?.phone) {
          foundPhones.push(match.phone);
          await log('found', `Phone from Google Maps: ${match.phone}`);
        }
        if (match?.website && !lead.website_url && !websiteToSave) {
          websiteToSave = match.website;
        }
      } catch (err) {
        await log('error', `Places lookup failed: ${err.message}`);
      }
    }

    // ── Step 3: Validate and save email ───────────────────────────────────
    if (!lead.email && foundEmails.length > 0) {
      await log('info', `Verifying ${foundEmails.length} email(s)...`);
      for (const email of [...new Set(foundEmails)]) {
        // Skip obvious system noise only — keep Gmail (very common in West Africa)
        if (/@example\.com|noreply|no-reply|@sentry\.|unsubscribe|donotreply/.test(email)) continue;

        // Try MX check but don't hard-reject if it fails — small businesses
        // often have no MX records even though the email is real
        const domainOk = await verifyEmailDomain(email).catch(() => false);
        if (domainOk) {
          updates.email = email;
          emailsFound++;
          notes.push(`email: ${email}`);
          await log('found', `Email verified: ${email}`);
          break;
        } else {
          // MX check failed — save anyway if it looks like a real business email
          const looksReal = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email);
          if (looksReal && !updates.email) {
            updates.email = email;
            emailsFound++;
            notes.push(`email: ${email}`);
            await log('found', `Email saved (no MX record but looks valid): ${email}`);
            break;
          }
        }
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

    // ── Step 5: Save owner name if found ─────────────────────────────────
    if (ownerName && !lead.decision_maker_name) {
      updates.decision_maker_name = ownerName;
      notes.push(`owner: ${ownerName}`);
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
