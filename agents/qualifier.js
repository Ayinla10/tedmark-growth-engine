import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getRawLeads, updateLeadScore, updateLeadSiteSignals, getLeadById } from '../tools/db.js';
import { scrapeWebsite } from '../tools/scraper.js';
import { appendKnowledgeContext } from '../tools/knowledge.js';
import { getBusinessContext, formatBusinessContextForPrompt } from '../tools/businessContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'qualify.md'), 'utf-8');
}

function buildUserMessage(lead, siteData) {
  const lines = [
    `Business name: ${lead.business_name}`,
    `Sector: ${lead.sector}`,
    `Location: ${lead.location}`,
  ];

  if (lead.website_url && siteData) {
    lines.push(`Website: ${lead.website_url}`);
    lines.push(`Page title: ${siteData.title ?? '(none)'}`);
    lines.push(`Meta description: ${siteData.metaDescription ?? '(none)'}`);
    lines.push(`Homepage text snippet: ${siteData.textSnippet || '(empty)'}`);

    if (siteData.signals) {
      const s = siteData.signals;
      lines.push('Detected site signals:');
      lines.push(`- Mobile-friendly (viewport meta tag): ${s.mobileFriendly ? 'yes' : 'no'}`);
      lines.push(`- Has analytics/tracking installed: ${s.hasTrackingPixel ? 'yes' : 'no'}`);
      lines.push(`- Has a clear call-to-action: ${s.hasClearCta ? 'yes' : 'no'}`);
      lines.push(`- Has a booking/reservation system: ${s.hasBookingSystem ? 'yes' : 'no'}`);
      lines.push(`- Has basic SEO structure (H1 heading, meta description): ${s.hasH1 && s.hasMetaDescription ? 'yes' : 'no'}`);
      lines.push(`- Has a live-chat/chatbot widget or WhatsApp click-to-chat link: ${s.hasChatWidget ? 'yes' : 'no'}`);
      lines.push(`- Has an email-capture form or newsletter signup: ${s.hasEmailCapture ? 'yes' : 'no'}`);
      lines.push(`- Has visible social media links: ${s.hasSocialLinks ? 'yes' : 'no'}`);
      lines.push(`- Has online ordering/payment integration: ${s.hasEcommerce ? 'yes' : 'no'}`);
      lines.push(`- Has a blog/news section (existing content marketing): ${s.hasBlog ? 'yes' : 'no'}`);
      lines.push(`- Uses HTTPS/SSL: ${s.hasSsl === null ? 'unknown' : s.hasSsl ? 'yes' : 'no'}`);
      lines.push(`- CMS/platform detected: ${s.cms ?? 'unknown/custom'}`);
      lines.push(`- Copyright year found on page: ${s.copyrightYear ?? 'none found'}`);
      lines.push(`- Looks outdated overall: ${s.looksOutdated ? 'yes' : 'no'}`);
    }
  } else if (lead.website_url && !siteData) {
    lines.push(`Website: ${lead.website_url}`);
    lines.push('Note: website could not be scraped (may be broken or unreachable).');
  } else {
    lines.push('Website: none found. This business has no online presence.');
  }

  return lines.join('\n');
}

function parseScoreResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.score !== 'number' || typeof parsed.score_reason !== 'string') {
    throw new Error('Response missing score or score_reason');
  }

  // Normalise to arrays — handle both old single-value and new multi-value responses
  if (!Array.isArray(parsed.recommended_services)) {
    parsed.recommended_services = parsed.recommended_service ? [parsed.recommended_service] : [];
  }
  if (!Array.isArray(parsed.problems)) {
    parsed.problems = parsed.score_reason ? [parsed.score_reason] : [];
  }

  return parsed;
}

export async function runQualifier({ limit, leadId }) {
  let leads;

  if (leadId) {
    console.log(`[qualifier] Fetching lead ${leadId}...`);
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[qualifier] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else {
    console.log(`[qualifier] Fetching up to ${limit} raw leads...`);
    leads = await getRawLeads(limit);
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
        await updateLeadSiteSignals(lead.id, siteData.signals);
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

      const { score, score_reason, recommended_service, recommended_services, problems } = parseScoreResponse(text);

      const updated = await updateLeadScore(
        lead.id, score, score_reason,
        recommended_service ?? recommended_services[0] ?? null,
        recommended_services,
        problems
      );

      console.log(
        `[qualifier] Scored "${updated.business_name}" -> ${score}/10 — ${score_reason}\n` +
        `  Problems (${problems.length}): ${problems.map((p, i) => `\n    ${i+1}. ${p}`).join('')}\n` +
        `  Services (${recommended_services.length}): ${recommended_services.join(', ')}`
      );
    } catch (err) {
      console.error(`[qualifier] AI call failed for "${lead.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log('[qualifier] Done.');
}
