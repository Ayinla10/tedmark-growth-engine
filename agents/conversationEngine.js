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
} from '../tools/db.js';

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
    const [s, leads] = await Promise.all([
      getTelegramStatusSummary(agencyId),
      getQualifiedLeads(3, 6, agencyId),
    ]);
    const leadLines = leads
      .map(l => {
        const reason = (l.score_reason ?? '').slice(0, 60);
        return `  • ${l.business_name} (${l.score}/10)${reason ? ' — ' + reason : ''}`;
      })
      .join('\n');
    return [
      `LIVE PIPELINE:`,
      `Leads today: ${s.leadsToday} | Total: ${s.leadsTotal} | Qualified: ${s.qualified}`,
      `Outreach drafts: ${s.drafts} | Sent today: ${s.sentToday} | Replies: ${s.replied}`,
      `Proposals: ${s.proposals} | Overdue actions: ${s.dueOrOverdue}`,
      '',
      leads.length ? `Top qualified leads:\n${leadLines}` : 'No leads with score ≥ 6 yet.',
    ].join('\n');
  } catch {
    return 'Live pipeline data unavailable.';
  }
}

// ── Load recent conversation history ──────────────────────────────────────────
async function loadHistory(linkId) {
  if (!linkId) return ''; // WhatsApp has no link table — skip gracefully
  try {
    const msgs = await getRecentTelegramMessages(linkId, 6);
    if (!msgs.length) return '';
    return msgs
      .map(m => {
        const role = m.direction === 'inbound' ? 'Owner' : 'Assistant';
        // Truncate long messages (agent summaries can be 400+ chars) to keep prompt lean
        const body = m.body.length > 300 ? m.body.slice(0, 300) + '…' : m.body;
        return `${role}: ${body}`;
      })
      .join('\n');
  } catch {
    return '';
  }
}

// ── Core intelligence: classify + extract + gap-detect ────────────────────────
async function think(userMessage, businessContext, liveSnapshot, history, lastScoutContext = '') {
  const agentDescriptions = Object.entries(AGENT_REGISTRY)
    .map(([k, v]) => `  ${k}: ${v.description}`)
    .join('\n');

  // Only include the live snapshot when the message looks like a pipeline question.
  // Advisory/draft questions don't need it and the extra ~600 chars pushes DeepSeek past reliable JSON threshold.
  const needsSnapshot = /\b(pipeline|leads?|status|outreach|drafts?|qualify|enrich|scout|send|report|score|overdue|today|how many|how are)\b/i.test(userMessage);
  const snapshotSection = needsSnapshot ? liveSnapshot : '';

  const systemPrompt = `You are the Tedmark Growth AI for the owner of Tedmark Digital. You run real agents — never invent lead names or contacts.

BUSINESS: ${businessContext || 'Tedmark Digital — digital marketing agency in Ghana.'}
${snapshotSection}${lastScoutContext ? `\n${lastScoutContext}` : ''}${history ? `\nRECENT:\n${history}` : ''}

AGENTS:
${agentDescriptions}

AGENT NUMBERS (owner may refer to agents by number):
1=scout 2=web-scout 3=enrich 4=enrich-dm 5=qualify 6=icp-score 7=outreach 8=send 9=check-replies 10=analytics 11=daily

RULES:
- "ok/yes/go ahead" after a confirm → dispatch immediately.
- If the owner says a number (e.g. "9", "option 9", "number 9") → map it to the agent above and confirm/dispatch it.
- To find leads: scout or web-scout. To get contacts: enrich. To score: qualify/icp-score. To email: outreach then send.
- To handle lead replies: check-replies — it checks inbox, classifies each reply, drafts a response, and sends it to the owner for approval before anything is sent. This IS conversation management — describe it that way.
- "those/them/the ones we found" + LAST SCOUT present → use those lead_ids.
- Sector hint in message → sector arg. City hint → city arg. Time hint → since arg.
- Never promise action in a converse message — use confirm or dispatch instead.

RESPOND with exactly one JSON object (no markdown):
{"type":"converse","message":"<150 chars, plain text>"}
{"type":"converse","message":"...","needs_draft":true,"draft_topic":"precise description"}
{"type":"clarify","message":"one question"}
{"type":"confirm","command":"name","args":{},"message":"what will run — confirm?"}
{"type":"dispatch","command":"name","args":{}}

"message" ≤150 chars. Never put draft content in "message". Never ask two questions.`;

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

    return parsed;
  } catch (err) {
    console.error('[engine] think() error:', err?.message ?? err);
    // Fallback: simpler prompt, no JSON mode — but keep history so context is not lost
    try {
      const historySection = history ? `\nRECENT CONVERSATION:\n${history}` : '';
      const fallback = await complete({
        system: `You are the Tedmark Growth AI for Tedmark Digital, a digital marketing agency in Ghana. Answer the owner's question directly and helpfully in plain conversational text. Be specific, warm, and concise — max 3 sentences. No corporate language.

AGENT NUMBERS: 1=scout 2=web-scout 3=enrich 4=enrich-dm 5=qualify 6=icp-score 7=outreach 8=send 9=check-replies 10=analytics 11=daily${historySection}`,
        user: userMessage,
        maxTokens: 500,
      });
      const msg = (fallback ?? '').trim();
      if (msg) return { type: 'converse', message: msg };
      throw new Error('empty fallback response');
    } catch (err2) {
      console.error('[engine] fallback also failed:', err2?.message ?? err2);
      return {
        type: 'converse',
        message: "AI is temporarily unavailable — try again in a moment. Commands still work: /status /leads /help",
      };
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
  try {
    return await complete({
      system: `You are the Tedmark Growth AI — sharp, direct, like a trusted colleague who's been watching the business all day. Summarise what the ${command} agent just did.

Rules:
- If results were found: name specific businesses, numbers, key details. Be concrete.
- If nothing was found: say so plainly in one sentence, then immediately suggest the ONE most useful next step (e.g. "Want me to try web scout instead?" or "Should I enrich the ones already in your database?"). Do not list multiple options or ask multiple questions.
- Never use corporate language like "came back with", "surface different prospects", "broaden search criteria". Talk like a real person.
- Keep it under 4 sentences. Plain text, no markdown, no bullet points unless listing actual business names.
- Always end with a clear single next-step suggestion if there's an obvious one.

Business context: ${businessContext || 'Tedmark Digital, digital marketing agency in Ghana.'}`,
      user: `Agent output:\n${output}`,
      maxTokens: 300,
    });
  } catch {
    return output || `${command} finished.`;
  }
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
export async function processOwnerMessage({ text, linkId, agencyId, pendingConfirmation = null, lastScoutContext = '', waHistory = null }) {
  const [businessContext, liveSnapshot, dbHistory] = await Promise.all([
    loadBusinessContext(agencyId),
    loadLiveSnapshot(agencyId),
    loadHistory(linkId),
  ]);
  // WhatsApp passes pre-built history; Telegram uses DB-loaded history
  const history = waHistory ?? dbHistory;

  // If there's a pending confirmation from last message, check yes/no
  if (pendingConfirmation) {
    const lower = text.toLowerCase().trim();
    const isYes = /^(yes|yeah|yep|go|ok|okay|do it|run it|sure|proceed|confirm|absolutely|yep|affirmative)/.test(lower);
    const isNo  = /^(no|nope|cancel|stop|don't|dont|never mind|skip)/.test(lower);

    if (isYes) {
      return {
        reply: `Running ${pendingConfirmation.command} now — give me a moment...`,
        dispatch: pendingConfirmation,
        clearPending: true,
      };
    }
    if (isNo) {
      return {
        reply: `No problem, cancelled. What else can I help with?`,
        clearPending: true,
      };
    }
    // Not a clear yes/no — treat as new message, clear pending
  }

  const thought = await think(text, businessContext, liveSnapshot, history, lastScoutContext);

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

  if (thought.type === 'dispatch') {
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

  // converse or clarify — reply, optionally followed by a draft
  return {
    reply: thought.message,
    ...(thought.draft ? { draft: thought.draft } : {}),
  };
}

export { summariseAgentResult, loadBusinessContext };
