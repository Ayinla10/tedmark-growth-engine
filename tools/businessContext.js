// Business Context Engine — what the agency actually is, so agents stop
// re-deriving or guessing it per lead. Two kinds of data, deliberately
// kept separate:
//   - stored facts (business_context table): edited by a human, changes
//     rarely (industry, ICP, pricing, goals, ...)
//   - computed facts (available_agents, historical_results): would go
//     stale immediately if stored, so they're queried live every time
//     instead of trusted from a cached column.
import { getBusinessContextRow, getHistoricalResults } from './db.js';
import { AGENT_REGISTRY } from './agentRegistry.js';
import { getCurrentAgencyId } from './agency.js';

const CRM_DESCRIPTION = 'This system (Tedmark Growth AI) — leads, outreach, proposals, and pipeline all live here, not in a separate external CRM.';

export async function getBusinessContext(agencyId) {
  const id = agencyId ?? (await getCurrentAgencyId());

  const [stored, historicalResults] = await Promise.all([
    getBusinessContextRow(id),
    getHistoricalResults(id),
  ]);

  return {
    businessName: stored?.business_name ?? null,
    industry: stored?.industry ?? null,
    businessModel: stored?.business_model ?? null,
    products: stored?.products ?? [],
    services: stored?.services ?? [],
    pricing: stored?.pricing ?? null,
    location: stored?.location ?? null,
    targetMarkets: stored?.target_markets ?? [],
    icp: stored?.icp ?? null,
    customerSegments: stored?.customer_segments ?? [],
    acquisitionChannels: stored?.acquisition_channels ?? [],
    salesChannels: stored?.sales_channels ?? [],
    website: stored?.website ?? null,
    socialMedia: stored?.social_media ?? {},
    crm: CRM_DESCRIPTION,
    communicationChannels: stored?.communication_channels ?? [],
    availableAgents: AGENT_REGISTRY,
    constraints: stored?.constraints ?? null,
    budget: stored?.budget ?? null,
    goals: stored?.goals ?? null,
    historicalResults,
    configured: Boolean(stored),
    updatedAt: stored?.updated_at ?? null,
  };
}

// Renders a compact text block for injection into an agent's system
// prompt — only includes fields that are actually filled in, so an
// unconfigured business context doesn't inject a wall of "unknown"s.
export function formatBusinessContextForPrompt(context) {
  if (!context.configured) return null;

  const lines = ['# Business context'];

  if (context.businessName) lines.push(`Business: ${context.businessName}`);
  if (context.industry) lines.push(`Industry: ${context.industry}`);
  if (context.businessModel) lines.push(`Business model: ${context.businessModel}`);
  if (context.products.length) lines.push(`Products: ${context.products.join(', ')}`);
  if (context.services.length) lines.push(`Services: ${context.services.join(', ')}`);
  if (context.pricing) lines.push(`Pricing: ${context.pricing}`);
  if (context.location) lines.push(`Location: ${context.location}`);
  if (context.targetMarkets.length) lines.push(`Target markets: ${context.targetMarkets.join(', ')}`);
  if (context.icp) lines.push(`Ideal customer profile: ${context.icp}`);
  if (context.customerSegments.length) lines.push(`Customer segments: ${context.customerSegments.join(', ')}`);
  if (context.constraints) lines.push(`Constraints: ${context.constraints}`);
  if (context.goals) lines.push(`Current growth goal: ${context.goals}`);

  if (lines.length === 1) return null; // nothing was actually filled in

  return lines.join('\n');
}
