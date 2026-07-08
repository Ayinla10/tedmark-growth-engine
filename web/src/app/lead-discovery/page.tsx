import { MapPin } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DateRangeFilter } from "@/components/date-range-filter";
import { LeadRowActions } from "@/components/lead-row-actions";
import { RunScoutModal } from "@/components/run-scout-modal";
import { Card, EmptyState, PageHeader, ScoreBadge, StatusBadge, Td, Th, formatDate } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/googleLinks";
import { getLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const leads = await getLeads(undefined, { from, to });

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader
          title="Lead discovery"
          subtitle={`${leads.length} businesses discovered by the Scout agent.`}
          actions={<RunScoutModal />}
        />

        <div className="flex justify-end mb-4">
          <DateRangeFilter label="Found between" />
        </div>

        <Card className="overflow-hidden">
          {leads.length === 0 ? (
            <EmptyState
              title="No leads yet"
              hint='Click "Run scout" above, or: node index.js scout --sector "restaurant" --city "Accra" --limit 20'
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-c">
                  <tr>
                    <Th>Business</Th>
                    <Th>Sector</Th>
                    <Th>Location</Th>
                    <Th>Website</Th>
                    <Th>Phone</Th>
                    <Th>Score</Th>
                    <Th>Status</Th>
                    <Th>Found</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-border-c/50 last:border-0 hover:bg-surface-2/50">
                      <Td className="font-medium">
                        <div className="flex items-center gap-2">
                          <Link href={`/leads/${lead.id}`} className="text-brand hover:underline">
                            {lead.business_name}
                          </Link>
                          <a
                            href={googleMapsSearchUrl(lead.business_name, lead.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View on Google Maps"
                            className="text-ink-muted hover:text-brand"
                          >
                            <MapPin size={13} />
                          </a>
                        </div>
                      </Td>
                      <Td className="capitalize">{lead.sector ?? "—"}</Td>
                      <Td className="text-ink-secondary max-w-xs truncate">{lead.location ?? "—"}</Td>
                      <Td>{lead.website_url ? "Yes" : "No"}</Td>
                      <Td className="text-ink-secondary">
                        {lead.phone ? (
                          /^\+233[2 5]\d{8}$/.test(lead.phone.replace(/\s/g, "")) ? (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 dark:text-green-400 hover:underline"
                            >
                              {lead.phone} ↗
                            </a>
                          ) : (
                            lead.phone
                          )
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td><ScoreBadge score={lead.score} /></Td>
                      <Td><StatusBadge status={lead.status} /></Td>
                      <Td className="text-ink-muted">{formatDate(lead.created_at)}</Td>
                      <Td>
                        <LeadRowActions
                          leadId={lead.id}
                          showQualify={lead.status === "raw"}
                          showEnrich
                          showArchive={lead.status !== "archived"}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </AppShell>
  );
}
