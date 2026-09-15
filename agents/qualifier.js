import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getRawLeads, updateLeadScore, updateLeadSiteSignals, getLeadById, query } from '../tools/db.js';
import { buildLeadFilter } from '../tools/leadFilter.js';
import { scrapeWebsite } from '../tools/scraper.js';
import { appendKnowledgeContext } from '../tools/knowledge.js';
import { getBusinessContext, formatBusinessContextForPrompt } from '../tools/businessContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'qualify.md'), 'utf-8');
}

function formatSignal(value) {
  if (value === true)  return 'true';
  if (value === false) return 'false';
  return null; // null = unknown — omit from fact block entirely
}

function buildUserMessage(lead, siteData) {
  const lines = [
    `Business name: ${lead.business_name}`,
    `Sector: ${lead.sector}`,
    `Location: ${lead.location}`,
    '',
    '## Verified signals (fact block)',
  ];

  // Only emit fields whose value is definitively true or false.
  // null/undefined = not checked = must not appear.
  const signals = {
    has_website:               formatSignal(lead.has_website),
    has_google_business_profile: formatSignal(lead.has_google_business_profile),
    has_ssl:                   formatSignal(lead.has_ssl),
    has_analytics:             formatSignal(lead.has_analytics),
    has_social_media:          formatSignal(lead.has_social_media),
    has_online_booking:        formatSignal(lead.has_online_booking),
  };

  // If a scrape just ran, override the DB values with fresh scraper output
  if (siteData?.signals) {
    const s = siteData.signals;
    if (s.hasSsl         !== undefined) signals.has_ssl           = formatSignal(s.hasSsl);
    if (s.hasTrackingPixel !== undefined) signals.has_analytics   = formatSignal(s.hasTrackingPixel);
    if (s.hasBookingSystem !== undefined) signals.has_online_booking = formatSignal(s.hasBookingSystem);
    if (s.hasSocialLinks  !== undefined) signals.has_social_media = formatSignal(s.hasSocialLinks);
  }

  let anySignal = false;
  for (const [field, val] of Object.entries(signals)) {
    if (val !== null) {
      lines.push(`${field}: ${val}`);
      anySignal = true;
    }
  }
  if (!anySignal) {
    lines.push('(no signals verified yet)');
  }

  // Website page content — only when a scrape succeeded
  if (lead.website_url && siteData) {
    lines.push('');
    lines.push('## Website page content');
    lines.push(`URL: ${lead.website_url}`);
    lines.push(`Page title: ${siteData.title ?? '(none)'}`);
    lines.push(`Meta description: ${siteData.metaDescription ?? '(none)'}`);
    lines.push(`Homepage text snippet: ${siteData.textSnippet || '(empty)'}`);
    if (siteData.signals) {
      const s = siteData.signals;
      lines.push(`Mobile-friendly: ${s.mobileFriendly ? 'yes' : 'no'}`);
      lines.push(`Clear call-to-action: ${s.hasClearCta ? 'yes' : 'no'}`);
      lines.push(`Basic SEO (H1 + meta desc): ${s.hasH1 && s.hasMetaDescription ? 'yes' : 'no'}`);
      lines.push(`Chat/WhatsApp widget: ${s.hasChatWidget ? 'yes' : 'no'}`);
      lines.push(`Email capture form: ${s.hasEmailCapture ? 'yes' : 'no'}`);
      lines.push(`E-commerce/online ordering: ${s.hasEcommerce ? 'yes' : 'no'}`);
      lines.push(`Blog/news section: ${s.hasBlog ? 'yes' : 'no'}`);
      lines.push(`CMS/platform: ${s.cms ?? 'unknown'}`);
      lines.push(`Copyright year: ${s.copyrightYear ?? 'none'}`);
      lines.push(`Looks outdated: ${s.looksOutdated ? 'yes' : 'no'}`);
    }
  } else if (lead.website_url && !siteData) {
    lines.push('');
    lines.push(`Website on file: ${lead.website_url}`);
    lines.push('Note: website could not be scraped (broken or unreachable). You have ZERO page content to analyse.');
    lines.push('IMPORTANT: Do NOT generate any problems with field="content". Do NOT guess about SSL, analytics, booking, social media, or any other signal that is not in the fact block above.');
  }

  return lines.join('\n');
}

function parseScoreResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.score !== 'number' || typeof parsed.score_reason !== 'string') {
    throw new Error('Response missing score or score_reason');
  }

  if (!Array.isArray(parsed.recommended_services)) {
    parsed.recommended_services = parsed.recommended_service ? [parsed.recommended_service] : [];
  }
  if (!Array.isArray(parsed.problems)) {
    parsed.problems = parsed.score_reason ? [{ field: 'content', claim: parsed.score_reason }] : [];
  }

  return parsed;
}

// Deterministic validator: strip any problem whose field value is not exactly
// false in the DB. Problems with field='content' (page quality) are always kept.
const VERIFIABLE_FIELDS = new Set([
  'has_website', 'has_google_business_profile', 'has_social_media',
  'has_online_booking', 'has_ssl', 'has_analytics',
]);

function validateProblems(problems, lead, scrapeSucceeded = false) {
  const stripped = [];
  const kept = [];

  for (const p of problems) {
    if (typeof p === 'string') {
      // legacy string format — only keep if scrape actually ran
      if (scrapeSucceeded) kept.push({ field: 'content', claim: p });
      else stripped.push({ field: 'content', reason: 'legacy string problem but scrape did not succeed' });
      continue;
    }
    const { field, claim } = p;
    if (field === 'content') {
      // Page-content problems are ONLY allowed when the scrape actually returned data.
      // has_website = true just means a URL was found at scout time — the page may be broken.
      if (scrapeSucceeded) kept.push(p);
      else stripped.push({ field, reason: 'scrape did not succeed — cannot verify page content' });
      continue;
    }
    if (!VERIFIABLE_FIELDS.has(field)) {
      stripped.push({ field, reason: 'unknown field' });
      continue;
    }
    if (lead[field] === false) {
      kept.push(p);
    } else {
      stripped.push({ field, reason: `DB value is ${JSON.stringify(lead[field])} (not false)` });
    }
  }

  if (stripped.length > 0) {
    console.warn(`[qualifier] Stripped ${stripped.length} unverified problem(s):`,
      stripped.map(s => `${s.field} (${s.reason})`).join(', '));
  }

  return kept;
}

export async function runQualifier({ limit, leadId, agencyId, sector, city, since, lead_ids }) {
  let leads;

  if (leadId) {
    console.log(`[qualifier] Fetching lead ${leadId}...`);
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[qualifier] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else if (sector || city || since || lead_ids) {
    const { conditions, params, nextIndex } = buildLeadFilter({ sector, city, since, lead_ids }, agencyId);
    const r = await query(
      `SELECT * FROM leads WHERE agency_id = $1 AND status = 'raw' ${conditions} ORDER BY created_at ASC LIMIT $${nextIndex}`,
      [...params, limit || 20]
    );
    leads = r.rows;
  } else {
    console.log(`[qualifier] Fetching up to ${limit} raw leads...`);
    leads = await getRawLeads(limit, agencyId);
  }

  if (leads.length === 0) {
    console.log('[qualifier] No raw leads found. Nothing to do.');
    return;
  }

  console.log(`[qualifier] Qualifying ${leads.length} leads...`);
  const { prompt: basePrompt } = await appendKnowledgeContext(await loadPrompt(), 'qualifier');
  const bizCtx = await getBusinessContext();
  const bizBlock = formatBusinessContextForPrompt(bizCtx);
  const systemPrompt = bizBlock ? `${basePrompt}\n\n${bizBlock}` : basePrompt;

  for (const lead of leads) {
    let siteData = null;

    if (lead.website_url) {
      console.log(`[qualifier] Scraping ${lead.website_url}...`);
      siteData = await scrapeWebsite(lead.website_url);
      if (!siteData) {
        console.warn(`[qualifier] Scrape failed for ${lead.website_url}, proceeding without site data.`);
      } else if (siteData.signals) {
        const updated = await updateLeadSiteSignals(lead.id, siteData.signals);
        // Refresh the lead object so the validator has the latest signal values
        if (updated) Object.assign(lead, updated);
      }
    } else {
      console.log(`[qualifier] No website on file for ${lead.business_name}.`);
    }

    const userMessage = buildUserMessage(lead, siteData);

    try {
      const text = await complete({
        system: systemPrompt,
        user: userMessage,
        // deepseek-v4-flash emits hidden chain-of-thought (reasoning_content)
        // that counts against max_tokens before the actual JSON answer —
        // a budget too tight for the reasoning cuts the response off with
        // finish_reason "length" and empty content. 2000 leaves headroom.
        maxTokens: 2000,
        json: true,
      });

      const { score, score_reason, recommended_service, recommended_services, problems: rawProblems } = parseScoreResponse(text);

      // Strip any problem whose DB field is not confirmed false.
      // scrapeSucceeded = siteData is non-null (page was actually fetched and parsed).
      const problems = validateProblems(rawProblems, lead, siteData !== null);

      const updated = await updateLeadScore(
        lead.id, score, score_reason,
        recommended_service ?? recommended_services[0] ?? null,
        recommended_services,
        problems
      );

      console.log(
        `[qualifier] Scored "${updated.business_name}" -> ${score}/10 — ${score_reason}\n` +
        `  Problems (${problems.length}): ${problems.map((p, i) => `\n    ${i+1}. [${p.field}] ${p.claim ?? p}`).join('')}\n` +
        `  Services (${recommended_services.length}): ${recommended_services.join(', ')}`
      );
    } catch (err) {
      console.error(`[qualifier] AI call failed for "${lead.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log('[qualifier] Done.');
}
