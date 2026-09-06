import { AppShell } from "@/components/app-shell";
import { ProposalWizard } from "@/components/proposal-wizard";
import { getDealPipeline, getLeads } from "@/lib/queries";
import { DealsClient } from "@/components/deals-client";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, allLeads] = await Promise.all([getDealPipeline(), getLeads()]);

  const eligibleLeads = allLeads
    .filter(l => l.status !== "archived")
    .map(l => ({ id: l.id, business_name: l.business_name }));

  return (
    <AppShell>
      <DealsClient deals={deals} proposalWizard={<ProposalWizard leads={eligibleLeads} />} />
    </AppShell>
  );
}
