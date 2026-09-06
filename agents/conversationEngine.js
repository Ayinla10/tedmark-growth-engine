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
      getQualifiedLeads(5, 6, agencyId),
    ]);
    const leadLines = leads
      .map(l => `  • ${l.business_name} (score ${l.score}/10) — ${l.score_reason ?? ''}`)
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
async function think(userMessage, businessContext, liveSnapshot, history) {
  const agentDescriptions = Object.entries(AGENT_REGISTRY)
    .map(([k, v]) => `  • ${k}: ${v.description}`)
    .join('\n');

  const systemPrompt = `You are the Tedmark Growth AI — intelligent business assistant for the owner of Tedmark Digital. Think like a strategic sales consultant, not a rule-following bot.

ABOUT THE BUSINESS:
${businessContext || 'No business profile configured yet.'}

${liveSnapshot}
${history ? `\nRECENT CONVERSATION:\n${history}` : ''}

AVAILABLE AGENTS:
${agentDescriptions}

YOUR JOB:
1. Understand what the owner really wants — use business context and conversation history.
2. If they want to RUN an agent:
   - Fill required args from their message AND from business context (e.g. known cities, sectors).
   - If a required arg is truly ambiguous and cannot be inferred, ask ONE clear question.
   - For actions that send emails or run long jobs, confirm before dispatching.
   - If you can make a confident assumption, state it and confirm in the message.
3. If they are asking a question or chatting, just answer — warmly and directly.

RESPONSE: Always return a single JSON object. No markdown, no code fences.
{
  "type": "converse",
  "message": "plain text reply"
}
OR
{
  "type": "clarify",
  "message": "one question to ask the owner"
}
OR
{
  "type": "confirm",
  "command": "agent-name",
  "args": {},
  "message": "tell the owner what you are about to run and ask them to confirm"
}
OR
{
  "type": "dispatch",
  "command": "agent-name",
  "args": {}
}

Never ask more than one question at a time. Never be robotic. Be direct, warm, specific.`;

  try {
    const raw = await complete({
      system: systemPrompt,
      user: userMessage,
      maxTokens: 600,
      json: true,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[engine] No JSON in response:', raw);
      throw new Error('No JSON in response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[engine] think() error:', err?.message ?? err);
    // Fallback: simpler prompt, no JSON mode, minimal context to reduce token load
    try {
      const fallback = await complete({
        system: `You are the Tedmark Growth AI for Tedmark Digital, a digital marketing agency in Ghana. Answer the owner's question directly and helpfully in plain conversational text. Be specific, warm, and concise — max 3 sentences. No corporate language.
${history ? `\nRecent conversation:\n${history}` : ''}`,
        user: userMessage,
        maxTokens: 250,
      });
      return { type: 'converse', message: fallback };
    } catch (err2) {
      console.error('[engine] fallback also failed:', err2?.message ?? err2);
      return { type: 'converse', message: "Lost my train of thought there — what would you like to do next?" };
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
    return output;
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
export async function processOwnerMessage({ text, linkId, agencyId, pendingConfirmation = null }) {
  const [businessContext, liveSnapshot, history] = await Promise.all([
    loadBusinessContext(agencyId),
    loadLiveSnapshot(agencyId),
    loadHistory(linkId),
  ]);

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

  const thought = await think(text, businessContext, liveSnapshot, history);

  if (thought.type === 'dispatch') {
    // AI is confident — dispatch immediately
    return {
      reply: `On it — running ${thought.command}... this may take a minute.`,
      dispatch: { command: thought.command, args: thought.args ?? {} },
      clearPending: true,
    };
  }

  if (thought.type === 'confirm') {
    // Need owner confirmation before running
    return {
      reply: thought.message,
      setPending: { command: thought.command, args: thought.args ?? {} },
    };
  }

  // converse or clarify — just reply
  return { reply: thought.message };
}

export { summariseAgentResult, loadBusinessContext };
