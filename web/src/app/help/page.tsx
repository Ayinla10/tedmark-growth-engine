import { AppShell } from "@/components/app-shell";
import { HelpSearch } from "@/components/help-search";
import { PageHeader } from "@/components/ui";
import { helpContent } from "@/lib/helpContent";

export default function HelpPage() {
  return (
    <AppShell>
      <section className="p-6 max-w-3xl">
        <PageHeader
          title="Help center"
          subtitle="What every button does and why, in plain English."
        />
        <HelpSearch entries={helpContent} />
      </section>
    </AppShell>
  );
}
