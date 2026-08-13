// Single source of truth for "what agents does this system actually have"
// — the Business Context Engine's `available_agents` field is computed
// from this list rather than stored as editable data, so it can never
// drift out of sync with what's actually in agents/. Whoever adds a new
// agent to agents/ is responsible for adding it here too.
export const AGENT_REGISTRY = [
  { name: 'Scout', file: 'agents/scout.js', capability: 'Discovers businesses via Google Maps/Geoapify Places' },
  { name: 'Web-Scout', file: 'agents/webScout.js', capability: 'Discovers businesses via Brave Search web/LinkedIn/Facebook snippets' },
  { name: 'Directory-Scout', file: 'agents/directoryScout.js', capability: 'Discovers businesses via BusinessGhana public directory (free, no key)' },
  { name: 'Enricher', file: 'agents/enricher.js', capability: "Finds email/phone from a lead's own website (free, no key)" },
  { name: 'DM Enrich', file: 'agents/dmEnrich.js', capability: 'Finds a named decision-maker (name/title/contact) from site content' },
  { name: 'Qualifier', file: 'agents/qualifier.js', capability: "Scores a lead's digital-presence opportunity 1-10" },
  { name: 'ICP Scorer', file: 'agents/icpScorer.js', capability: 'Scores sales-readiness: Budget/Authority/Need/Urgency/Fit' },
  { name: 'Outreach', file: 'agents/outreach.js', capability: 'Drafts personalized first-contact email/WhatsApp messages' },
  { name: 'Sequencer', file: 'agents/sequencer.js', capability: 'Drafts follow-ups for leads that went silent' },
  { name: 'Proposal', file: 'agents/proposal.js', capability: 'Drafts a client proposal with real website content and pricing' },
  { name: 'Reply Watcher', file: 'agents/replyWatcher.js', capability: 'Classifies inbound email replies and drafts a response' },
  { name: 'Analytics', file: 'agents/analytics.js', capability: 'Snapshots funnel metrics' },
  { name: 'Telegram Bot', file: 'agents/telegramBot.js', capability: 'Notifications, approvals, and status commands via Telegram' },
];
