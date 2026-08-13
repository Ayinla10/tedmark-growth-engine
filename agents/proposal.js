import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getLeadById, insertProposal } from '../tools/db.js';
import { appendKnowledgeContext } from '../tools/knowledge.js';
import { getBusinessContext, formatBusinessContextForPrompt } from '../tools/businessContext.js';
import { fetchReadableContent } from '../tools/jinaReader.js';
import { getCountry } from '../tools/countries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'proposal.md'), 'utf-8');
}

async function buildUserMessage(lead, services, budgetRange) {
  const currency = getCountry(lead.country).currency;

  const lines = [
    `Business name: ${lead.business_name}`,
    `Sector: ${lead.sector}`,
    `Location: ${lead.location}`,
    `Has website: ${lead.website_url ? 'yes' : 'no'}`,
    `Score reason: ${lead.score_reason ?? '(not qualified yet)'}`,
    `Requested services: ${services.join(', ')}`,
    `Budget range: ${budgetRange}`,
    `Currency to price in: ${currency.name} (${currency.code}, symbol ${currency.symbol})`,
  ];

  // Real page content, so the proposal can reference the business's
  // actual current site/offerings instead of only the qualifier's signals.
  if (lead.website_url) {
    const content = await fetchReadableContent(lead.website_url);
    if (content) {
      lines.push(`Website content (via Jina Reader, for concrete details to reference):\n${content}`);
    }
  }

  return lines.join('\n');
}

export async function runProposal({ leadId, services, budgetRange }) {
  console.log(`[proposal] Fetching lead ${leadId}...`);

  const lead = await getLeadById(leadId);

  if (!lead) {
    console.error(`[proposal] No lead found with id ${leadId}.`);
    return;
  }

  console.log(`[proposal] Generating proposal for "${lead.business_name}"...`);

  const knowledge = await appendKnowledgeContext(await loadPrompt(), 'proposal');
  const bizCtx = await getBusinessContext();
  const bizBlock = formatBusinessContextForPrompt(bizCtx);
  const proposalSystemPrompt = bizBlock ? `${knowledge.prompt}\n\n${bizBlock}` : knowledge.prompt;
  const userMessage = await buildUserMessage(lead, services, budgetRange);

  let content;
  try {
    content = await complete({
      system: proposalSystemPrompt,
      user: userMessage,
      maxTokens: 2000,
    });
  } catch (err) {
    console.error(`[proposal] AI call failed for "${lead.business_name}": ${err.message}.`);
    return;
  }

  const proposal = await insertProposal({
    lead_id: lead.id,
    services,
    budget_range: budgetRange,
    content,
    knowledge_ids: knowledge.knowledgeIds,
  });

  console.log(`[proposal] Saved proposal ${proposal.id} for "${lead.business_name}".`);
  console.log('');
  console.log(content);
}
