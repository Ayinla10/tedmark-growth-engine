/**
 * Intelligent Conversation Engine
 * Powers Telegram (and WhatsApp) with:
 *  - Business context awareness (services, sectors, goals)
 *  - Multi-turn conversation memory (last N messages)
 *  - Smart gap detection — asks before acting, fills from context when confident
 *  - Agent dispatch with confirmation
 *  - Natural, warm replies — not rule-following
 */

import { complete } from '../tools/llm.js';
import {
  getBusinessContextRow,
  getTelegramStatusSummary,
  getQualifiedLeads,
  getRecentTelegramMessages,
  searchLeadByName,
  searchLeadsBySector,
  getOverdueLeads,
  getPipelineCounts,
  get7DayBaselines,
} from '../tools/db.js';
import { ownerPreferences, declinedSuggestions } from '../tools/botState.js';

// ── Agent registry ─────────────────────────────────────────────────────────────
export const AGENT_REGISTRY = {
  scout: {
    description: 'Find new leads from Google Maps by business sector and city',
    requiredArgs: ['sector', 'city'],
    optionalArgs: ['limit'],
    defaults: { limit: '20' },
    questions: {
      sector: 'What type of businesses are you targeting? (e.g. clinics, restaurants, law firms)',
      city: 'Which city should I search in?',
      limit: 'How many leads do you want? (default: 20)',
    },
  },
  'web-scout': {
    description: 'Find leads by searching the web',
    requiredArgs: ['sector', 'city'],
    optionalArgs: ['limit'],
    defaults: { limit: '20' },
    questions: {
      sector: 'What type of businesses are you looking for?',
      city: 'Which city?',
    },
  },
  enrich: {
    description: 'Enrich existing leads with contact info (email, phone, website)',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  'enrich-dm': {
    description: 'Find decision maker names, titles and LinkedIn for leads',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  qualify: {
    description: 'Score and qualify leads using AI analysis',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  'icp-score': {
    description: 'Run ICP (Ideal Customer Profile) scoring on leads',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  outreach: {
    description: 'Generate personalised outreach email drafts for qualified leads',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  send: {
    description: 'Send all approved outreach emails',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  'check-replies': {
    description: 'Check inbox for lead replies, classify intent, draft a follow-up response, and send it to you for approval before sending',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  analytics: {
    description: 'Generate a performance analytics report',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
  'pipeline-query': {
    description: 'Look up pipeline data — counts, overdue leads, sector breakdowns, lead status — read-only, instant, no confirmation needed',
    instant: true,
    requiredArgs: [],
    optionalArgs: ['filter', 'sector'],
    defaults: {},
    questions: {},
  },
  daily: {
    description: 'Run the full daily pipeline end-to-end (scout → enrich → qualify → outreach)',
    requiredArgs: [],
    optionalArgs: [],
    defaults: {},
    questions: {},
  },
};

// ── Load business context ──────────────────────────────────────────────────────
async function loadBusinessContext(agencyId) {
  try {
    const ctx = await getBusinessContextRow(agencyId);
    if (!ctx) return '';
    // business_context table columns: business_name, industry, business_model,
    // products[], services[], pricing, location, target_markets[], icp,
    // customer_segments[], acquisition_channels[], sales_channels[], website,
    // social_media jsonb, communication_channels[], constraints, budget, goals
    const arr = (v) => Array.isArray(v) && v.length ? v.join(', ') : null;
    const parts = [
      ctx.business_name    ? `Agency: ${ctx.business_name}` : '',
      ctx.industry         ? `Industry: ${ctx.industry}` : '',
      ctx.business_model   ? `Model: ${ctx.business_model}` : '',
      arr(ctx.services)    ? `Services: ${arr(ctx.services)}` : '',
      arr(ctx.products)    ? `Products: ${arr(ctx.products)}` : '',
      ctx.pricing          ? `Pricing: ${ctx.pricing}` : '',
      ctx.location         ? `Location: ${ctx.location}` : '',
      arr(ctx.target_markets)    ? `Target markets: ${arr(ctx.target_markets)}` : '',
      ctx.icp              ? `Ideal customer: ${ctx.icp}` : '',
      arr(ctx.customer_segments) ? `Customer segments: ${arr(ctx.customer_segments)}` : '',
      ctx.goals            ? `Goals: ${ctx.goals}` : '',
      ctx.constraints      ? `Constraints: ${ctx.constraints}` : '',
    ].filter(Boolean).join('\n');
    return parts;
  } catch {
    return '';
  }
}

// ── Load live pipeline snapshot ────────────────────────────────────────────────
async function loadLiveSnapshot(agencyId) {
  try {
    const [s, leads, baselines] = await Promise.all([
      getTelegramStatusSummary(agencyId),
      getQualifiedLeads(3, 6, agencyId),
      get7DayBaselines(agencyId).catch(() => null),
    ]);
    const leadLines = leads
      .map(l => {
        const reason = (l.score_reason ?? '').slice(0, 60);
        return `  • ${l.business_name} (${l.score}/10)${reason ? ' — ' + reason : ''}`;
      })
      .join('\n');

    // Feature 2: anomaly signals injected into snapshot
    const anomalies = [];
    if (baselines) {
      const avg = parseFloat(baselines.leads_per_day) || 0;
      const today = parseInt(baselines.leads_today) || 0;
      if (avg > 0 && today < avg * 0.3) anomalies.push(`⚠️ Only ${today} leads today vs ${avg}/day avg (7d) — scout may have an issue`);
      if (avg > 0 && today > avg * 2.5) anomalies.push(`🚀 ${today} leads today — well above ${avg}/day avg (7d)`);
    }

    return [
      `LIVE PIPELINE:`,
      `Leads today: ${s.leadsToday} | Total: ${s.leadsTotal} | Qualified: ${s.qualified}`,
      `Outreach drafts: ${s.drafts} | Sent today: ${s.sentToday} | Replies: ${s.replied}`,
      `Proposals: ${s.proposals} | Overdue actions: ${s.dueOrOverdue}`,
      baselines ? `7-day avgs: ${baselines.leads_per_day}/day leads | ${baselines.outreach_per_day}/day outreach` : '',
      anomalies.length ? anomalies.join('\n') : '',
      '',
      leads.length ? `Top qualified leads:\n${leadLines}` : 'No leads with score ≥ 6 yet.',
    ].filter(l => l !== '').join('\n');
  } catch {
    return 'Live pipeline data unavailable.';
  }
}

// ── Look up a specific lead by name mention ────────────────────────────────────
// Common sector keywords the owner might mention
const SECTOR_KEYWORDS = ['school', 'clinic', 'hospital', 'restaurant', 'hotel', 'pharmacy',
  'church', 'salon', 'gym', 'law firm', 'logistics', 'bank', 'church', 'supermarket',
  'agency', 'construction', 'real estate', 'transport', 'insurance'];

async function loadMentionedLead(message, agencyId) {
  const lower = message.toLowerCase();

  // ── Sector query (e.g. "schools in the pipeline", "list clinics") ──────────
  const sectorHit = SECTOR_KEYWORDS.find(s => lower.includes(s));
  const isSectorQuery = sectorHit && /\b(list|show|find|how many|any|pipeline|system|already|scouted|in the)\b/i.test(message);
  if (isSectorQuery) {
    try {
      const rows = await searchLeadsBySector(sectorHit, agencyId, 5);
      if (!rows.length) return `SECTOR LOOKUP: 0 ${sectorHit}s found in the database.`;
      const lines = rows.map(l =>
        `- ${l.business_name} | ${l.status}${l.score != null ? ` | Score: ${l.score}/10` : ''}${l.pipeline_stage ? ` | Stage: ${l.pipeline_stage}` : ''}${l.next_action_due && new Date(l.next_action_due) < new Date() ? ' | ⚠️ Overdue' : ''}`
      ).join('\n');
      return `SECTOR LOOKUP (${sectorHit}s in DB — ${rows.length} shown):\n${lines}`;
    } catch { return ''; }
  }

  // ── Specific lead name lookup ──────────────────────────────────────────────
  const nameMatch = message.match(/["']([^"']{3,50})["']/) ||
                    message.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/);
  const hasEnquiryKeyword = /\b(status|how is|what about|update on|tell me about|show me|check)\b/i.test(message);
  const isBareNameOnly = nameMatch && message.trim().split(/\s+/).length <= 5;
  if (!nameMatch || (!hasEnquiryKeyword && !isBareNameOnly)) return '';
  const name = nameMatch[1];
  try {
    const rows = await searchLeadByName(name, agencyId);
    if (!rows.length) return `No lead found matching "${name}".`;
    return 'LEAD LOOKUP:\n' + rows.map(l => [
      `Lead: ${l.business_name}`,
      `Status: ${l.status}${l.score != null ? ` | Score: ${l.score}/10` : ''}`,
      l.score_reason ? `Score reason: ${l.score_reason}` : '',
      l.pipeline_stage ? `Pipeline: ${l.pipeline_stage}` : '',
      l.next_action ? `Next action: ${l.next_action}${l.next_action_due ? ` (due ${l.next_action_due.slice(0,10)})` : ''}` : '',
      l.deal_value ? `Deal value: ${l.deal_currency ?? ''} ${l.deal_value}` : '',
      l.email ? `Email: ${l.email}` : '',
      l.phone ? `Phone: ${l.phone}` : '',
    ].filter(Boolean).join(' | ')).join('\n');
  } catch { return ''; }
}

// ── Load recent conversation history ──────────────────────────────────────────
// ── Pillar 1: inline pipeline-query handler ────────────────────────────────────
export async function runInlinePipelineQuery(args, agencyId) {
  const filter = (args?.filter ?? args?.sector ?? '').toLowerCase();
  try {
    if (filter && !['overdue', 'counts', 'summary'].includes(filter)) {
      // Sector lookup
      const rows = await searchLeadsBySector(filter, agencyId, 8);
      if (!rows.length) return `0 ${filter}s found in the database.`;
      return `${filter}s in pipeline (${rows.length}):\n` + rows.map(l =>
        `• ${l.business_name} | ${l.status}${l.score != null ? ` | ${l.score}/10` : ''}${l.pipeline_stage ? ` | ${l.pipeline_stage}` : ''}${l.next_action_due && new Date(l.next_action_due) < new Date() ? ' | ⚠️ Overdue' : ''}`
      ).join('\n');
    }
    if (filter === 'overdue') {
      const rows = await getOverdueLeads(agencyId, 8);
      if (!rows.length) return 'No overdue leads — all actions are on schedule.';
      return `Overdue leads (${rows.length}):\n` + rows.map(l =>
        `• ${l.business_name} — ${l.next_action ?? 'action'} was due ${l.next_action_due?.slice(0,10)}`
      ).join('\n');
    }
    // Default: full counts summary
    const c = await getPipelineCounts(agencyId);
    return `Pipeline: ${c.total} total | ${c.raw} raw | ${c.enriched} enriched | ${c.qualified} qualified | ${c.outreach_sent} outreach sent | ${c.replied} replied | ${c.overdue} overdue`;
  } catch (err) {
    return `Pipeline query failed: ${err.message}`;
  }
}

// ── Pillar 2: rolling conversation summary ─────────────────────────────────────
export async function compressConversationSummary(existingSummary, userMessage, botReply) {
  try {
    const exchange = `Owner: ${userMessage.slice(0, 300)}\nAssistant: ${botReply.slice(0, 300)}`;
    const input = existingSummary
      ? `Previous summary:\n${existingSummary}\n\nNew exchange:\n${exchange}`
      : exchange;
    const compressed = await complete({
      system: 'Compress this conversation into 2-3 sentences capturing: topics discussed, decisions made, agents run, leads mentioned by name, current focus/task. Be specific, not generic.',
      user: input,
      maxTokens: 150,
    });
    return compressed.trim();
  } catch {
    return existingSummary ?? '';
  }
}

// ── Feature 5: load owner preferences distilled over time ─────────────────────
async function loadOwnerPreferences(agencyId) {
  try {
    const prefs = await ownerPreferences.get(agencyId);
    return prefs ? `OWNER PREFERENCES (learned over time):\n${prefs}` : '';
  } catch { return ''; }
}

// ── Feature 5: update owner preferences after each exchange ───────────────────
export async function updateOwnerPreferences(agencyId, existingPrefs, userMessage, botReply, wasCorrection) {
  if (!wasCorrection) return existingPrefs; // only update on clear corrections or notable patterns
  try {
    const input = existingPrefs
      ? `Current preferences:\n${existingPrefs}\n\nNew exchange to learn from:\nOwner: ${userMessage.slice(0, 200)}\nAssistant: ${botReply.slice(0, 200)}`
      : `New exchange to learn from:\nOwner: ${userMessage.slice(0, 200)}\nAssistant: ${botReply.slice(0, 200)}`;
    const updated = await complete({
      system: `You maintain a distilled set of behavioral rules for an AI assistant based on how the owner corrects or redirects it.
Update the preferences list with what you learned. Keep each rule as a short, actionable statement. Max 10 rules total. Remove outdated ones.
Examples: "Owner prefers checking existing pipeline before scouting new leads", "Never suggest scout without first showing pipeline status", "Owner uses numbers (1-11) to trigger agents — always map them".
Return ONLY the updated list, one rule per line, no headers.`,
      user: input,
      maxTokens: 300,
    });
    return (updated ?? '').trim() || existingPrefs;
  } catch { return existingPrefs; }
}

async function loadHistory(linkId, conversationSummaryText = '') {
  const parts = [];
  if (conversationSummaryText) parts.push(`CONVERSATION SO FAR: ${conversationSummaryText}`);
  if (!linkId) return parts.join('\n'); // WhatsApp has no link table
  try {
    const msgs = await getRecentTelegramMessages(linkId, 8);
    if (!msgs.length) return parts.join('\n');
    const recent = msgs
      .map(m => {
        const role = m.direction === 'inbound' ? 'Owner' : 'Assistant';
        const body = m.body.length > 400 ? m.body.slice(0, 400) + '…' : m.body;
        return `${role}: ${body}`;
      })
      .join('\n');
    if (recent) parts.push(`RECENT:\n${recent}`);
  } catch { /* ignore */ }
  return parts.join('\n');
}

// ── Core intelligence: classify + extract + gap-detect ────────────────────────
async function think(userMessage, businessContext, liveSnapshot, history, lastScoutContext = '', mentionedLead = '', ownerPrefsText = '', declinedText = '', pendingConfirmation = null, agencyId = null) {
  const agentDescriptions = Object.entries(AGENT_REGISTRY)
    .map(([k, v]) => `  ${k}: ${v.description}`)
    .join('\n');

  // Only include the live snapshot when the message looks like a pipeline question.
  // Advisory/draft questions don't need it and the extra ~600 chars pushes DeepSeek past reliable JSON threshold.
  const needsSnapshot = /\b(pipeline|leads?|status|outreach|drafts?|qualify|enrich|scout|send|report|score|overdue|today|how many|how are)\b/i.test(userMessage);
  const snapshotSection = needsSnapshot ? liveSnapshot : '';

  const pendingSection = pendingConfirmation
    ? pendingConfirmation.command === 'plan'
      ? `\nPENDING CONFIRMATION: The owner was just shown a multi-step plan and asked whether to proceed. Their current message is a response to that plan.`
      : `\nPENDING CONFIRMATION: The owner was just asked to confirm running "${pendingConfirmation.command}"${pendingConfirmation.args && Object.keys(pendingConfirmation.args).length ? ` with ${JSON.stringify(pendingConfirmation.args)}` : ''}. Their current message is a response to this.`
    : '';

  const systemPrompt = `You are the Tedmark Growth AI — a sharp, trusted assistant who's been on the Tedmark Digital team for months. You know the pipeline, you know the owner, and you check before you guess.

BUSINESS: ${businessContext || 'Tedmark Digital — digital marketing agency in Ghana.'}
${snapshotSection}${lastScoutContext ? `\n${lastScoutContext}` : ''}${mentionedLead ? `\n${mentionedLead}` : ''}${history ? `\n${history}` : ''}${ownerPrefsText ? `\n${ownerPrefsText}` : ''}${declinedText ? `\n${declinedText}` : ''}${pendingSection}

AGENTS:
${agentDescriptions}

AGENT NUMBERS: 1=scout 2=web-scout 3=enrich 4=enrich-dm 5=qualify 6=icp-score 7=outreach 8=send 9=check-replies 10=analytics 11=daily 12=pipeline-query

LANGUAGE: The owner may write in any language (French, Arabic, Twi, pidgin), with typos or abbreviations. Always understand the intent — never ask for clarification just because of a spelling error.

PENDING CONFIRMATION RULES (only applies when PENDING CONFIRMATION is set above):
- Clear yes in any language ("yes", "oui", "نعم", "go", "ok", "yep", "do it", "run it", "sure") → type "confirmed"
- Clear no with nothing meaningful after ("no", "non", "لا", "cancel", "nope", "stop") → type "cancelled"
- No followed by a real question or statement ("no, how many schools", "no wait, show me the pipeline") → type "cancelled" is WRONG. Instead ignore the pending action and answer the question — use converse, clarify, or dispatch as appropriate.
- Genuinely ambiguous response ("hmm", "not now", "maybe", "wait", "let me think") → type "clarify" — ask which they meant. Never force it into confirmed or cancelled.

DECISION LOGIC (follow strictly):
- Owner asks about existing data (counts, status, a specific lead, a sector) → dispatch pipeline-query instantly — never guess.
- Owner says a number (e.g. "9") → map to agent above and confirm/dispatch.
- "start over" / "reset" / "fresh start" → greet warmly, ask what they'd like to do. Never run a pipeline.
- "those/them/the ones we found" + LAST SCOUT present → use those lead_ids.
- If LEAD LOOKUP or SECTOR LOOKUP is in context → answer from it directly; suggest a concrete next step.
- If 0 leads found for a sector → say so, offer to scout it.
- To find leads: scout or web-scout. Contacts: enrich. Score: qualify/icp-score. Email: outreach then send. Replies: check-replies.
- If the request implies 2+ agents in sequence (e.g. "find and contact schools") → type plan with full ordered steps and ask for confirmation.
- If the owner's message is ambiguous about which prior action to repeat ("try again", "that thing", "do it again") and more than one prior turn could match — use clarify. Never guess which one and jump to confirm or dispatch.
- If a command appears in DECLINED THIS SESSION → do not re-suggest it unprompted. Answer the literal question and wait.
- If the message contains a rejection AND a new question — address the new question, don't let "no" swallow it.
- Never promise action in a converse message — use confirm or dispatch.
- If unclear, ask exactly one specific question — never guess and act.

PERSONALITY:
- Talk like someone who's been on this team for months — not a menu system or customer service bot.
- Acknowledge what the owner just said before answering — don't restart cold each turn.
- Vary your phrasing — don't reuse the same sentence structure every turn.
- Never use filler: "No problem!", "What else can I help with?", "Great question!" — get straight to the point.
- If you ran something or found something, lead with the result, not the process.

RESPOND with exactly one JSON object (no markdown):
{"type":"confirmed"}
{"type":"cancelled"}
{"type":"converse","message":"<150 chars, plain text>"}
{"type":"converse","message":"...","needs_draft":true,"draft_topic":"precise description"}
{"type":"clarify","message":"one specific question"}
{"type":"confirm","command":"name","args":{},"message":"what will run — confirm?"}
{"type":"dispatch","command":"name","args":{}}
{"type":"plan","steps":[{"command":"name","args":{},"label":"human description"}...],"message":"Here's my plan: ... — should I go ahead?"}

confirmed/cancelled only valid when PENDING CONFIRMATION is set. pipeline-query dispatches instantly — no confirmation. "message" ≤150 chars. Never put draft content in "message". Never ask two questions. plan.steps must be 2–6 items.`;

  try {
    console.log(`[engine] think() prompt_chars=${systemPrompt.length} user="${userMessage.slice(0, 60)}"`);
    const raw = await complete({
      system: systemPrompt,
      user: userMessage,
      maxTokens: 1500,
      json: true,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[engine] No JSON in response:', raw?.slice(0, 200));
      throw new Error('No JSON in response');
    }
    const parsed = JSON.parse(jsonMatch[0]);

    // If the AI flagged that a draft is needed, generate it in a separate plain-text call
    // This keeps JSON mode reliable (short strings only) while still producing long content
    if (parsed.needs_draft && parsed.draft_topic) {
      console.log(`[engine] needs_draft: "${parsed.draft_topic}"`);
      const draft = await complete({
        system: `You are the Tedmark Growth AI — a sharp, direct business consultant for Tedmark Digital, a digital marketing agency in Ghana. Write exactly what is requested: plain text, warm and professional, no corporate fluff. Use first person as the agency. Keep it concise and actionable.

Business context: ${businessContext || 'Tedmark Digital, digital marketing agency in Ghana.'}`,
        user: `Write: ${parsed.draft_topic}`,
        maxTokens: 400,
      });
      return { ...parsed, draft: (draft ?? '').trim() };
    }

    // Add logging for clarify and declined events
    if (parsed.type === 'clarify') {
      console.log(`[engine:clarify] triggered for: "${userMessage.slice(0, 80)}"`);
    }

    return parsed;
  } catch (err) {
    console.error('[engine] think() error:', err?.message ?? err);
    // Constraint #1: retry once with reasoning disabled before falling back
    try {
      console.warn('[engine:fallback] retrying think() with reasoning disabled');
      const raw2 = await complete({
        system: systemPrompt,
        user: userMessage,
        maxTokens: 1500,
        json: true,
      });
      const jsonMatch2 = raw2?.match(/\{[\s\S]*\}/);
      if (jsonMatch2) {
        const parsed2 = JSON.parse(jsonMatch2[0]);
        if (parsed2.type === 'clarify') {
          console.log(`[engine:clarify] triggered (fallback) for: "${userMessage.slice(0, 80)}"`);
        }
        return parsed2;
      }
      throw new Error('No JSON in fallback response');
    } catch (err2) {
      // Constraint #1: if both fail, return deterministic DB status summary — never silence
      console.error('[engine:fallback] both think() attempts failed, using DB summary:', err2?.message ?? err2);
      try {
        const c = await getPipelineCounts(agencyId);
        return {
          type: 'converse',
          message: `Pipeline: ${c.total} leads | ${c.outreach_sent} outreached | ${c.overdue} overdue. AI is recovering — try again shortly or use /help for commands.`,
        };
      } catch {
        return {
          type: 'converse',
          message: 'AI temporarily unavailable. Commands still work: /status /leads /help',
        };
      }
    }
  }
}

// ── Dispatch an agent via the internal API ─────────────────────────────────────
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || 'http://localhost:4000';
const API_SECRET  = process.env.RENDER_API_SECRET;

export async function dispatchAgent(command, args = {}) {
  const agent = AGENT_REGISTRY[command];
  if (!agent) throw new Error(`Unknown agent: ${command}`);

  // Fill in defaults for any missing optional args
  const finalArgs = { ...agent.defaults, ...args };

  const res = await fetch(`${SERVER_URL}/run/${command}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ args: finalArgs }),
  });
  return res.json();
}

// ── Summarise agent output naturally ──────────────────────────────────────────
async function summariseAgentResult(command, output, businessContext) {
  const isScoring = ['qualify', 'icp-score'].includes(command);
  try {
    return await complete({
      system: `You are the Tedmark Growth AI — sharp, direct, like a trusted colleague who's been watching the business all day. Summarise what the ${command} agent just did.

Rules:
- If results were found: name specific businesses, numbers, key details. Be concrete.
- If nothing was found: say so plainly in one sentence, then immediately suggest the ONE most useful next step. Do not list multiple options or ask multiple questions.
- Never use corporate language like "came back with", "surface different prospects", "broaden search criteria". Talk like a real person.
- Keep it under 4 sentences. Plain text, no markdown, no bullet points unless listing actual business names.
- Always end with a clear single next-step suggestion if there's an obvious one.${isScoring ? '\n- For each lead scored, include the actual reason why it scored that way — not just the number. E.g. "Nyaho Medical: 9/10 — active clinic with a website but no Google ads, high-intent easy win."' : ''}

Business context: ${businessContext || 'Tedmark Digital, digital marketing agency in Ghana.'}`,
      user: `Agent output:\n${output}`,
      maxTokens: 350,
    });
  } catch {
    return output || `${command} finished.`;
  }
}

// ── Feature 3: self-check — verify reply actually answers the question ─────────
async function selfCheck(question, proposedAnswer) {
  try {
    const verdict = await complete({
      system: 'You are a quality-check step. Answer with exactly one word: YES if the proposed answer directly and correctly answers the question asked, or NO if it misses the point, answers the wrong thing, or is a generic non-answer.',
      user: `Question: "${question}"\nProposed answer: "${proposedAnswer.slice(0, 300)}"`,
      maxTokens: 5,
    });
    return !(verdict ?? '').trim().toUpperCase().startsWith('NO');
  } catch { return true; } // on error, don't block
}

// ── Main entry point ───────────────────────────────────────────────────────────
/**
 * Process a message from the owner. Returns { reply, dispatch? }
 * where dispatch = { command, args } if an agent should be run.
 *
 * The caller is responsible for:
 *  - Sending the reply immediately
 *  - If dispatch present: calling dispatchAgent, then sending the summarised result
 */
export async function processOwnerMessage({ text, linkId, agencyId, pendingConfirmation = null, lastScoutContext = '', waHistory = null, conversationSummaryText = '' }) {
  const [businessContext, liveSnapshot, dbHistory, mentionedLead, ownerPrefsText, declinedRaw] = await Promise.all([
    loadBusinessContext(agencyId),
    loadLiveSnapshot(agencyId),
    loadHistory(linkId, conversationSummaryText),
    loadMentionedLead(text, agencyId),
    loadOwnerPreferences(agencyId),
    declinedSuggestions.get(linkId ?? agencyId).catch(() => null),
  ]);
  const declinedText = declinedRaw?.length
    ? `DECLINED THIS SESSION (do not re-suggest unprompted): ${declinedRaw.join(', ')}`
    : '';
  if (declinedRaw?.length) {
    console.log(`[engine:declined-list] ${declinedRaw.length} blocked commands in prompt for chat ${linkId ?? agencyId}: [${declinedRaw.join(', ')}]`);
  }
  // WhatsApp passes pre-built history; Telegram uses DB-loaded history
  const history = waHistory ?? dbHistory;

  const thought = await think(text, businessContext, liveSnapshot, history, lastScoutContext, mentionedLead, ownerPrefsText, declinedText, pendingConfirmation, agencyId);

  // Handle AI's decision about a pending confirmation
  if (thought.type === 'confirmed' && pendingConfirmation) {
    return {
      reply: `Running ${pendingConfirmation.command} now — give me a moment...`,
      dispatch: pendingConfirmation,
      clearPending: true,
    };
  }
  if (thought.type === 'cancelled') {
    return { reply: `Cancelled.`, clearPending: true };
  }

  if (thought.type === 'dispatch' || thought.type === 'confirm') {
    // Validate required args before confirming or dispatching
    const agent = AGENT_REGISTRY[thought.command];
    const args = thought.args ?? {};
    if (agent) {
      const missing = (agent.requiredArgs ?? []).find(k => !args[k]);
      if (missing) {
        const question = agent.questions?.[missing] ?? `What is the ${missing}?`;
        return {
          reply: question,
          argKeyboard: { command: thought.command, args, asking: missing },
        };
      }
    }
  }

  if (thought.type === 'plan') {
    const steps = thought.steps ?? [];
    if (steps.length >= 2) {
      return {
        reply: thought.message,
        setPlan: { steps, currentIndex: 0 },
      };
    }
    // Single-step plan → treat as a confirm for the first step
    return {
      reply: thought.message,
      setPending: steps[0] ? { command: steps[0].command, args: steps[0].args ?? {} } : undefined,
    };
  }

  if (thought.type === 'dispatch') {
    const agent = AGENT_REGISTRY[thought.command];
    // Pillar 1: instant agents run inline — no webhook, no "give me a minute" reply
    if (agent?.instant) {
      const queryResult = await runInlinePipelineQuery(thought.args ?? {}, agencyId);
      // Feed the result back to the AI for a natural conversational reply
      const naturalReply = await complete({
        system: `You are the Tedmark Growth AI. The owner asked a question and you just retrieved the answer from the database. Reply naturally and helpfully in plain text (no JSON). Acknowledge what they asked, give the data, and suggest a clear next step if obvious. Max 3 sentences.

Business context: ${businessContext || 'Tedmark Digital, digital marketing agency in Ghana.'}${history ? `\n${history}` : ''}`,
        user: `Owner asked: "${text}"\n\nData retrieved:\n${queryResult}`,
        maxTokens: 250,
      }).catch(() => queryResult);
      return { reply: naturalReply.trim(), clearPending: true };
    }
    return {
      reply: `On it — running ${thought.command}... this may take a minute.`,
      dispatch: { command: thought.command, args: thought.args ?? {} },
      clearPending: true,
    };
  }

  if (thought.type === 'confirm') {
    return {
      reply: thought.message,
      setPending: { command: thought.command, args: thought.args ?? {} },
    };
  }

  // Feature 3: self-check for data-heavy converse replies — verify the answer actually matches the question
  if (thought.type === 'converse' && mentionedLead && thought.message) {
    const checkPassed = await selfCheck(text, thought.message).catch(() => true);
    if (!checkPassed) {
      // Retry think() once with an explicit hint
      const retried = await think(
        text,
        businessContext,
        liveSnapshot,
        history,
        lastScoutContext,
        mentionedLead,
        ownerPrefsText,
        declinedText,
        null,
        agencyId
      ).catch(() => thought);
      if (retried.type === 'converse' && retried.message) {
        return { reply: retried.message, ...(retried.draft ? { draft: retried.draft } : {}) };
      }
    }
  }

  // converse or clarify — reply, optionally followed by a draft
  return {
    reply: thought.message,
    ...(thought.draft ? { draft: thought.draft } : {}),
  };
}

export { summariseAgentResult, loadBusinessContext };
