import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getBusinessContext, formatBusinessContextForPrompt } from '../tools/businessContext.js';
import { fetchReadableContent } from '../tools/jinaReader.js';
import { getLeadsNeedingDmEnrichment, updateLeadDecisionMaker, getLeadById } from '../tools/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'dmEnrich.md'), 'utf-8');
}

function buildUserMessage(lead, content) {
  return [
    `Business name: ${lead.business_name}`,
    `Location: ${lead.location ?? '(unknown)'}`,
    `Website content (via Jina Reader):\n${content}`,
  ].join('\n');
}

function parseDmResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!('dm_name' in parsed) || !('language' in parsed)) {
    throw new Error('Response missing dm_name or language');
  }

  return parsed;
}

export async function runDmEnrich({ limit, leadId }) {
  let leads;

  if (leadId) {
    console.log(`[dm-enrich] Fetching lead ${leadId}...`);
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[dm-enrich] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else {
    console.log(`[dm-enrich] Fetching up to ${limit} leads needing DM enrichment...`);
    leads = await getLeadsNeedingDmEnrichment(limit);
  }

  if (leads.length === 0) {
    console.log('[dm-enrich] No leads need DM enrichment. Nothing to do.');
    return;
  }

  console.log(`[dm-enrich] Enriching ${leads.length} leads...`);
  const basePrompt = await loadPrompt();
  const bizCtx = await getBusinessContext();
  const bizBlock = formatBusinessContextForPrompt(bizCtx);
  const systemPrompt = bizBlock ? `${basePrompt}\n\n${bizBlock}` : basePrompt;
  let found = 0;

  for (const lead of leads) {
    if (!lead.website_url) {
      console.log(`[dm-enrich] "${lead.business_name}" has no website — skipping.`);
      continue;
    }

    console.log(`[dm-enrich] Reading ${lead.website_url}...`);
    const content = await fetchReadableContent(lead.website_url);

    if (!content) {
      console.warn(`[dm-enrich] Could not read ${lead.website_url}, skipping.`);
      continue;
    }

    try {
      const text = await complete({
        system: systemPrompt,
        user: buildUserMessage(lead, content),
        // deepseek-v4-flash emits hidden chain-of-thought (reasoning_content)
        // that counts against max_tokens before the actual JSON answer —
        // a budget too tight for the reasoning cuts the response off with
        // finish_reason "length" and empty content. 2000 leaves headroom.
        maxTokens: 2000,
        json: true,
      });

      const result = parseDmResponse(text);
      await updateLeadDecisionMaker(lead.id, {
        dmName: result.dm_name || null,
        dmTitle: result.dm_title || null,
        dmEmail: result.dm_email || null,
        dmPhone: result.dm_phone || null,
        dmLinkedinUrl: result.dm_linkedin_url || null,
        language: result.language || null,
      });

      if (result.dm_name) {
        found += 1;
        console.log(`[dm-enrich] "${lead.business_name}" — found ${result.dm_name}${result.dm_title ? ` (${result.dm_title})` : ''}`);
      } else {
        console.log(`[dm-enrich] "${lead.business_name}" — no named decision-maker in site content.`);
      }
    } catch (err) {
      console.error(`[dm-enrich] AI call failed for "${lead.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log(`[dm-enrich] Done. ${found} decision-makers found out of ${leads.length} leads processed.`);
}
