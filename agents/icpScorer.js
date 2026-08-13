import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getBusinessContext, formatBusinessContextForPrompt } from '../tools/businessContext.js';
import { getLeadsNeedingIcpScore, updateLeadIcpScore, getLeadById } from '../tools/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'icpScore.md'), 'utf-8');
}

function buildUserMessage(lead) {
  const lines = [
    `Business name: ${lead.business_name}`,
    `Sector: ${lead.sector ?? '(unknown)'}`,
    `Location: ${lead.location ?? '(unknown)'}`,
    `Website: ${lead.website_url ? 'yes' : 'no'}`,
    `Qualifier score (1-10, website opportunity): ${lead.score ?? '(none)'}`,
    `Qualifier reasoning: ${lead.score_reason ?? '(none)'}`,
    `Recommended service: ${lead.recommended_service ?? '(none)'}`,
  ];

  if (lead.dm_name) {
    lines.push(`Decision-maker: ${lead.dm_name}${lead.dm_title ? ` (${lead.dm_title})` : ' (no title found)'}`);
  } else {
    lines.push('Decision-maker: none found');
  }

  return lines.join('\n');
}

function parseIcpResponse(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);

  for (const key of ['budget', 'authority', 'need', 'urgency', 'fit']) {
    const val = parsed[key];
    if (typeof val !== 'number' || val < 1 || val > 5) {
      throw new Error(`Invalid or missing "${key}" in response (must be 1-5)`);
    }
  }

  return parsed;
}

export async function runIcpScorer({ limit, leadId }) {
  let leads;

  if (leadId) {
    console.log(`[icp-score] Fetching lead ${leadId}...`);
    const lead = await getLeadById(leadId);
    if (!lead) {
      console.error(`[icp-score] No lead found with id ${leadId}.`);
      return;
    }
    leads = [lead];
  } else {
    console.log(`[icp-score] Fetching up to ${limit} leads needing ICP scoring...`);
    leads = await getLeadsNeedingIcpScore(limit);
  }

  if (leads.length === 0) {
    console.log('[icp-score] No leads need ICP scoring. Nothing to do.');
    return;
  }

  console.log(`[icp-score] Scoring ${leads.length} leads...`);
  const basePrompt = await loadPrompt();
  const bizCtx = await getBusinessContext();
  const bizBlock = formatBusinessContextForPrompt(bizCtx);
  const systemPrompt = bizBlock ? `${basePrompt}\n\n${bizBlock}` : basePrompt;
  let scored = 0;

  for (const lead of leads) {
    try {
      const text = await complete({
        system: systemPrompt,
        user: buildUserMessage(lead),
        // deepseek-v4-flash emits hidden chain-of-thought (reasoning_content)
        // that counts against max_tokens before the actual JSON answer —
        // a budget too tight for the reasoning cuts the response off with
        // finish_reason "length" and empty content. 2000 leaves headroom.
        maxTokens: 2000,
        json: true,
      });

      const result = parseIcpResponse(text);
      const updated = await updateLeadIcpScore(lead.id, result);
      scored += 1;
      console.log(`[icp-score] "${lead.business_name}" — ${updated.icp_total}/25 (B${result.budget} A${result.authority} N${result.need} U${result.urgency} F${result.fit})`);
    } catch (err) {
      console.error(`[icp-score] AI call failed for "${lead.business_name}": ${err.message}. Skipping.`);
    }
  }

  console.log(`[icp-score] Done. ${scored} of ${leads.length} leads scored.`);
}
