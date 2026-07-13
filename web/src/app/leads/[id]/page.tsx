import { ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LeadRowActions } from "@/components/lead-row-actions";
import { ProposalModal } from "@/components/proposal-modal";
import { ReplyForm } from "@/components/reply-form";
import { Card, PageHeader, ScoreBadge, StatusBadge } from "@/components/ui";
import { googleMapsSearchUrl, googleSearchUrl } from "@/lib/googleLinks";
import { formatDate } from "@/lib/time";
import { getLeadThread } from "@/lib/mutations";
import { getLeadDetail, getScoringProtocol } from "@/lib/queries";

export const dynamic = "force-dynamic";

// `invert` flips which state counts as "good" (e.g. "Looks outdated" is a
// warning when true, unlike the other signals which are good when true).
const CLASSIFICATION_LABELS: Record<string, { label: string; className: string }> = {
  interested: { label: "Interested", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  needs_info: { label: "Needs info", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  not_interested: { label: "Not interested", className: "bg-surface-2 text-ink-muted" },
  out_of_office: { label: "Out of office", className: "bg-surface-2 text-ink-muted" },
  unsubscribe: { label: "Unsubscribe", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
  other: { label: "Other", className: "bg-surface-2 text-ink-muted" },
};

function SignalBadge({ label, active, invert = false }: { label: string; active: boolean; invert?: boolean }) {
  const positive = invert ? !active : active;
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        positive ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-surface-2 text-ink-muted"
      }`}
    >
      {label}: {active ? "yes" : "no"}
    </span>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, proposals }, thread, scoringProtocol] = await Promise.all([
    getLeadDetail(id),
    getLeadThread(id),
    getScoringProtocol(),
  ]);

  if (!lead) notFound();

  const latestSentOutreachId =
    [...thread].reverse().find((t) => t.kind === "sent")?.id ?? null;

  return (
    <AppShell>
      <section className="p-6 max-w-4xl">
        <PageHeader
          title={lead.business_name}
          subtitle={[lead.sector, lead.location].filter(Boolean).join(" · ")}
          actions={
            <LeadRowActions
              leadId={lead.id}
              showQualify
              showEnrich
              showGenerateOutreach
              showArchive
            />
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="p-5 lg:col-span-1">
            <p className="text-sm font-semibold text-ink mb-3">Business info</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Status</span>
                <StatusBadge status={lead.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Score</span>
                <ScoreBadge score={lead.score} />
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Website</span>
                <span className="text-ink">
                  {lead.website_url ? (
                    <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1">
                      Visit <ExternalLink size={12} />
                    </a>
                  ) : (
                    "None"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Phone</span>
                <span className="text-ink">{lead.phone ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Email</span>
                <span className="text-ink">{lead.email ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Social profile</span>
                <span className="text-ink">
                  {lead.social_url ? (
                    <a href={lead.social_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline flex items-center gap-1">
                      Visit <ExternalLink size={12} />
                    </a>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Found via</span>
                <span className="text-ink capitalize">{lead.source === "maps" ? "Maps" : lead.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Found</span>
                <span className="text-ink">{formatDate(lead.created_at)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border-c">
              <a
                href={googleMapsSearchUrl(lead.business_name, lead.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-brand hover:underline"
              >
                <MapPin size={14} /> View on Google Maps
              </a>
              <a
                href={googleSearchUrl(lead.business_name, lead.location)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-brand hover:underline"
              >
                <ExternalLink size={14} /> Search on Google
              </a>
            </div>

            {lead.score_reason ? (
              <div className="mt-4 pt-4 border-t border-border-c">
                <p className="text-xs text-ink-muted mb-1">AI reasoning</p>
                <p className="text-sm text-ink-secondary">{lead.score_reason}</p>
              </div>
            ) : null}

            {lead.recommended_service ? (
              <div className="mt-4 pt-4 border-t border-border-c">
                <p className="text-xs text-ink-muted mb-1">Recommended service</p>
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-brand/10 text-brand capitalize">
                  {lead.recommended_service}
                </span>
              </div>
            ) : null}

            {lead.site_signals ? (
              <div className="mt-4 pt-4 border-t border-border-c">
                <p className="text-xs text-ink-muted mb-2">Detected site signals</p>
                <div className="flex flex-wrap gap-1.5">
                  <SignalBadge label="Mobile-friendly" active={lead.site_signals.mobileFriendly} />
                  <SignalBadge label="Tracking installed" active={lead.site_signals.hasTrackingPixel} />
                  <SignalBadge label="Clear CTA" active={lead.site_signals.hasClearCta} />
                  <SignalBadge label="Booking system" active={lead.site_signals.hasBookingSystem} />
                  <SignalBadge label="Basic SEO" active={lead.site_signals.hasH1 && lead.site_signals.hasMetaDescription} />
                  <SignalBadge label="Chat/WhatsApp widget" active={lead.site_signals.hasChatWidget} />
                  <SignalBadge label="Email capture" active={lead.site_signals.hasEmailCapture} />
                  <SignalBadge label="Social links" active={lead.site_signals.hasSocialLinks} />
                  <SignalBadge label="Online ordering" active={lead.site_signals.hasEcommerce} />
                  <SignalBadge label="Looks outdated" active={lead.site_signals.looksOutdated} invert />
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="p-5 lg:col-span-2">
            <p className="text-sm font-semibold text-ink mb-3">Scoring protocol</p>
            <pre className="text-xs text-ink-secondary whitespace-pre-wrap font-sans leading-relaxed">
              {scoringProtocol || "Scoring guide not found."}
            </pre>
          </Card>
        </div>

        {lead.discovery_evidence ? (
          <Card className="p-5 mb-6">
            <p className="text-sm font-semibold text-ink mb-3">Discovery evidence</p>
            <p className="text-xs text-ink-muted mb-3">
              Exactly what search result this lead came from — useful for sanity-checking the discovery pipeline.
            </p>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-ink-muted text-xs block">Matched search query</span>
                <span className="text-ink font-mono text-xs">{lead.discovery_evidence.query}</span>
              </div>
              <div>
                <span className="text-ink-muted text-xs block">Result title</span>
                <span className="text-ink">{lead.discovery_evidence.title || "—"}</span>
              </div>
              <div>
                <span className="text-ink-muted text-xs block">Result link</span>
                <a href={lead.discovery_evidence.link} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline break-all">
                  {lead.discovery_evidence.link}
                </a>
              </div>
              <div>
                <span className="text-ink-muted text-xs block">Snippet</span>
                <span className="text-ink-secondary italic">&quot;{lead.discovery_evidence.snippet || "—"}&quot;</span>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-5 mb-6">
          <p className="text-sm font-semibold text-ink mb-4">Conversation</p>
          {thread.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No messages yet. Generate outreach, then send it to start the conversation.
            </p>
          ) : (
            <div className="space-y-3">
              {thread.map((item) => (
                <div key={item.id} className={`flex ${item.kind === "reply" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                      item.kind === "sent"
                        ? "bg-brand text-white rounded-br-sm"
                        : item.kind === "draft"
                          ? "bg-surface-2 text-ink rounded-br-sm border-2 border-dashed border-border-c"
                          : "bg-surface-2 text-ink rounded-bl-sm"
                    }`}
                  >
                    {item.kind === "draft" ? (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                        Draft — not sent yet
                      </p>
                    ) : null}
                    {item.kind === "reply" && item.classification && CLASSIFICATION_LABELS[item.classification] ? (
                      <span
                        className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-1.5 ${CLASSIFICATION_LABELS[item.classification].className}`}
                      >
                        {CLASSIFICATION_LABELS[item.classification].label}
                      </span>
                    ) : null}
                    {item.subject ? <p className="font-semibold mb-1">{item.subject}</p> : null}
                    <p className="whitespace-pre-wrap">{item.body}</p>
                    <p className={`text-[11px] mt-1 ${item.kind === "sent" ? "text-white/70" : "text-ink-muted"}`}>
                      {item.kind === "draft" ? `Drafted ${formatDate(item.at)}` : formatDate(item.at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ReplyForm leadId={lead.id} latestOutreachId={latestSentOutreachId} />
          <p className="text-xs text-ink-muted mt-2">
            Replies are logged manually — there&apos;s no automatic email/WhatsApp inbox sync yet.
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-ink mb-3">Proposals</p>
          {proposals.length === 0 ? (
            <p className="text-sm text-ink-muted">No proposals generated for this lead yet.</p>
          ) : (
            <div className="space-y-2">
              {proposals.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-ink capitalize">{p.services?.join(", ") ?? "—"}</p>
                    <p className="text-xs text-ink-muted">{p.budget_range} budget &bull; {formatDate(p.created_at)}</p>
                  </div>
                  <ProposalModal row={{ ...p, business_name: lead.business_name }} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Link href="/lead-discovery" className="inline-block mt-6 text-sm text-ink-secondary hover:text-brand">
          ← Back to lead discovery
        </Link>
      </section>
    </AppShell>
  );
}
