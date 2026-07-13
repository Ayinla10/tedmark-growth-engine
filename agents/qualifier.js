import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getRawLeads, updateLeadScore, getLeadById } from '../tools/db.js';
import { scrapeWebsite } from '../tools/scraper.js';
import { appendKnowledgeContext } from '../tools/knowledge.js';

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
  const { prompt: systemPrompt } = await appendKnowledgeContext(await loadPrompt(), 'qualifier');

  for (const lead of leads) {
    let siteData = null;

    if (lead.website_url) {
      console.log(`[qualifier] Scraping ${lead.website_url}...`);
      siteData = await scrapeWebsite(lead.website_url);
      if (!siteData) {
        console.warn(`[qualifier] Scrape failed for ${lead.website_url}, proceeding without site data.`);
      }
    } else {
      console.log(`[qualifier] No website on file for ${lead.business_name}.`);
    }

    const userMessage = buildUserMessage(lead, siteData);

    try {
      const text = await complete({
        system: systemPrompt,
        user: userMessage,
        maxTokens: 300,
        json: true,
      });

      const { score, score_reason } = parseScoreResponse(text);

      const updated = await updateLeadScore(lead.id, score, score_reason);

      console.log(
        `[qualifier] Scored "${updated.business_name}" -> ${score}/10 — ${score_reason}`
      );
    } catch (err) {
      console.error(`[qualifier] AI call failed for "${lead.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log('[qualifier] Done.');
}
