import { AppShell } from "@/components/app-shell";
import { AnimatedBar } from "@/components/animated-bar";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { getApiUsageSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";

const PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek (AI)",
  geoapify: "Geoapify (Maps)",
  brave: "Brave Search",
  resend: "Resend (Email)",
};

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const { byProvider, daily } = await getApiUsageSummary({ from, to });

  const hasAnyRate = byProvider.some((p) => p.estimatedCostUsd !== null);
  const totalKnownCost = byProvider.reduce((sum, p) => sum + (p.estimatedCostUsd ?? 0), 0);
  const dailyMax = Math.max(...daily.map((d) => d.estimatedCostUsd), 0.0001);

  return (
    <AppShell>
      <section className="p-6">
        <PageHeader
          title="API Spend"
          subtitle="Real usage counts from every provider, with estimated cost once you enter your real rates in Settings."
        />

        <div className="flex justify-end mb-4">
          <DateRangeFilter label="Between" />
        </div>

        {!hasAnyRate ? (
          <Card className="p-5 mb-6 border border-amber-500/30 bg-amber-500/5">
            <p className="text-sm text-ink">
              No cost rates configured yet — usage counts below are real and accurate, but dollar costs are
              unknown until you enter your real per-unit rate for at least one provider in{" "}
              <a href="/settings" className="text-brand hover:underline">
                Settings
              </a>
              .
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <p className="text-xs text-ink-muted mb-1">Total estimated spend</p>
              <p className="text-2xl font-semibold text-ink">{formatUsd(totalKnownCost)}</p>
            </Card>
          </div>
        )}

        <Card className="overflow-hidden mb-6">
          {byProvider.length === 0 ? (
            <EmptyState title="No API usage recorded yet" hint="Run any agent (qualify, outreach, scout) to start seeing usage here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-c">
                  <tr>
                    <Th>Provider</Th>
                    <Th>Requests</Th>
                    <Th>Tokens in</Th>
                    <Th>Tokens out</Th>
                    <Th>Estimated cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {byProvider.map((p) => (
                    <tr key={p.provider} className="border-b border-border-c/50 last:border-0">
                      <Td className="font-medium">{PROVIDER_LABELS[p.provider] ?? p.provider}</Td>
                      <Td>{p.requests > 0 ? formatNumber(p.requests) : "—"}</Td>
                      <Td>{p.tokensIn > 0 ? formatNumber(p.tokensIn) : "—"}</Td>
                      <Td>{p.tokensOut > 0 ? formatNumber(p.tokensOut) : "—"}</Td>
                      <Td>
                        {p.estimatedCostUsd !== null ? (
                          formatUsd(p.estimatedCostUsd)
                        ) : (
                          <span className="text-ink-muted text-xs">not configured</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {daily.length > 0 && hasAnyRate ? (
          <Card className="p-5">
            <p className="text-sm font-semibold text-ink mb-4">Daily estimated spend</p>
            <div className="space-y-2">
              {daily.map((d, i) => (
                <div key={d.day}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-secondary">{d.day}</span>
                    <span className="font-semibold text-ink">{formatUsd(d.estimatedCostUsd)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <AnimatedBar
                      widthPercent={Math.max((d.estimatedCostUsd / dailyMax) * 100, d.estimatedCostUsd > 0 ? 2 : 0)}
                      className="bg-brand"
                      delay={0.05 + i * 0.03}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </section>
    </AppShell>
  );
}
