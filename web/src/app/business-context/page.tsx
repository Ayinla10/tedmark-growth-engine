import { AppShell } from "@/components/app-shell";
import { Card, PageHeader } from "@/components/ui";
import { BusinessContextForm } from "@/components/business-context-form";
import { getBusinessContextForDashboard } from "@/lib/queries";
const AGENT_REGISTRY: { name: string; file: string; capability: string }[] = [
  { name: "Scout", file: "agents/scout.js", capability: "Discovers businesses via Google Maps/Geoapify Places" },
  { name: "Web-Scout", file: "agents/webScout.js", capability: "Discovers businesses via Brave Search web/LinkedIn/Facebook snippets" },
  { name: "Directory-Scout", file: "agents/directoryScout.js", capability: "Discovers businesses via BusinessGhana public directory (free, no key)" },
  { name: "Enricher", file: "agents/enricher.js", capability: "Finds email/phone from a lead's own website (free, no key)" },
  { name: "DM Enrich", file: "agents/dmEnrich.js", capability: "Finds a named decision-maker (name/title/contact) from site content" },
  { name: "Qualifier", file: "agents/qualifier.js", capability: "Scores a lead's digital-presence opportunity 1-10" },
  { name: "ICP Scorer", file: "agents/icpScorer.js", capability: "Scores sales-readiness: Budget/Authority/Need/Urgency/Fit" },
  { name: "Outreach", file: "agents/outreach.js", capability: "Drafts personalized first-contact email/WhatsApp messages" },
  { name: "Sequencer", file: "agents/sequencer.js", capability: "Drafts follow-ups for leads that went silent" },
  { name: "Proposal", file: "agents/proposal.js", capability: "Drafts a client proposal with real website content and pricing" },
  { name: "Reply Watcher", file: "agents/replyWatcher.js", capability: "Classifies inbound email replies and drafts a response" },
  { name: "Analytics", file: "agents/analytics.js", capability: "Snapshots funnel metrics" },
  { name: "Telegram Bot", file: "agents/telegramBot.js", capability: "Notifications, approvals, and status commands via Telegram" },
];

export const dynamic = "force-dynamic";

export default async function BusinessContextPage() {
  const ctx = await getBusinessContextForDashboard();

  return (
    <AppShell>
      <section className="p-6 max-w-3xl">
        <PageHeader
          title="Business Context"
          subtitle="Tell your agents who you are — they use this in every email draft, lead score, and proposal."
        />

        {!ctx && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm text-amber-700 dark:text-amber-400">
            <strong>Not configured yet.</strong> Agents are running without knowing your business — fill this in and every AI output will be more accurate and on-brand.
          </div>
        )}

        {ctx?.updated_at && (
          <p className="text-xs text-ink-muted mb-6">
            Last updated: {new Date(ctx.updated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        )}

        <Card className="p-6 mb-6">
          <BusinessContextForm initial={ctx} />
        </Card>

        <Card className="overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border-c">
            <p className="text-sm font-semibold text-ink">Available agents</p>
            <p className="text-xs text-ink-muted">These are the agents the system currently has — computed live, not editable here.</p>
          </div>
          <div className="divide-y divide-border-c">
            {(AGENT_REGISTRY as { name: string; file: string; capability: string }[]).map((agent) => (
              <div key={agent.file} className="px-5 py-3">
                <p className="text-sm font-medium text-ink">{agent.name}</p>
                <p className="text-xs text-ink-muted">{agent.capability}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
