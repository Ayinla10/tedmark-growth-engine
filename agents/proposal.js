import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { complete } from '../tools/llm.js';
import { getLeadById, insertProposal } from '../tools/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPrompt() {
  return readFile(path.join(__dirname, '..', 'prompts', 'proposal.md'), 'utf-8');
}

function buildUserMessage(lead, services, budgetRange) {
  const lines = [
    `Business name: ${lead.business_name}`,
    `Sector: ${lead.sector}`,
    `Location: ${lead.location}`,
    `Has website: ${lead.website_url ? 'yes' : 'no'}`,
    `Score reason: ${lead.score_reason ?? '(not qualified yet)'}`,
    `Requested services: ${services.join(', ')}`,
    `Budget range: ${budgetRange}`,
  ];

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

  const systemPrompt = await loadPrompt();
  const userMessage = buildUserMessage(lead, services, budgetRange);

  let content;
  try {
    content = await complete({
      system: systemPrompt,
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
  });

  console.log(`[proposal] Saved proposal ${proposal.id} for "${lead.business_name}".`);
  console.log('');
  console.log(content);
}
