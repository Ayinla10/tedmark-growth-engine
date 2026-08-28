import { AppShell } from "@/components/app-shell";

const PIPELINE = [
  { num: 1, label: "Scout",     color: "#38bdf8" },
  { num: 2, label: "Qualifier", color: "#a78bfa" },
  { num: 3, label: "Enricher",  color: "#34d399" },
  { num: 4, label: "Outreach",  color: "#fbbf24" },
  { num: 5, label: "Sequencer", color: "#818cf8" },
  { num: 6, label: "Proposal",  color: "#f59e0b" },
];

const STEPS = [
  {
    num: 1, color: "#38bdf8", auto: true,
    title: "Scout Agent",
    body: "Every morning at 7am, the Scout goes out and searches for businesses in your target city and industry. It uses a mapping database to find real businesses — their name, address, phone number, and category. Think of it as your robot researcher that never gets tired of searching.",
    note: "Example: You tell it to find restaurants in Accra — it comes back with 80+ businesses, complete with basic details.",
  },
  {
    num: 2, color: "#a78bfa", auto: true,
    title: "Qualifier Agent",
    body: "Not every business is a good fit. The Qualifier looks at each business found by the Scout and gives it a score from 1 to 10. A high score means the business closely matches the type of customer you want. A low score means it's probably not worth your time. Only the best leads move forward.",
    note: "A score of 7 or above is considered a strong lead. You can see all scores in the Qualified Leads page.",
  },
  {
    num: 3, color: "#34d399", auto: false,
    title: "Enricher",
    body: "For leads that look promising, the Enricher digs deeper. It searches the internet to find contact details that weren't in the original listing — like an email address, WhatsApp number, or the name of the decision maker. More contact info means more ways to reach them.",
    note: "You can trigger this manually by clicking the Enrich button on any lead, or it runs automatically as part of the daily pipeline.",
  },
  {
    num: 4, color: "#fbbf24", auto: true,
    title: "Outreach Agent",
    body: "Once a lead is qualified, the Outreach Agent writes a personalized message for them — either a WhatsApp message or an email. The message is tailored to the specific business, not a generic copy-paste blast. All drafts land in your Outreach Drafts page, where you review and approve them before anything is sent.",
    note: "Nothing is ever sent without your approval. You are always in control of what goes out.",
  },
  {
    num: 5, color: "#818cf8", auto: true,
    title: "Sequencer Agent",
    body: "If a lead doesn't respond after a few days, the Sequencer schedules a follow-up. It knows when your last message was sent and reminds you — or drafts a new follow-up message — at the right time. No lead falls through the cracks just because you got busy.",
    note: "Follow-ups are listed in the Follow-ups page, sorted by priority so the most overdue ones show first.",
  },
  {
    num: 6, color: "#f59e0b", auto: false,
    title: "Proposal Agent",
    body: "When a lead is ready to hear your full offer, the Proposal Agent writes a complete business proposal for them — customized to their business type, size, and what you know about them. It reads professional and saves you hours of writing.",
    note: "Generated proposals live in the Proposals page, ready for you to review, edit, and send.",
  },
];

const EXTRAS = [
  {
    title: "Telegram Control",
    color: "#2D6AF7",
    body: "Control the entire system from your phone via Telegram. Check on your leads, approve outreach messages, and get daily reports — without opening the dashboard.",
  },
  {
    title: "Analytics Agent",
    color: "#34d399",
    body: "Tracks what's working. How many leads did you discover this week? What's your contact rate? The Analytics Agent summarizes your pipeline health so you can see the big picture at a glance.",
  },
  {
    title: "Daily Automation",
    color: "#fbbf24",
    body: "Every day at 7am, the full pipeline runs on its own — Scout finds new businesses, Qualifier scores them, Outreach drafts messages. You wake up to fresh leads already processed.",
  },
  {
    title: "AI Orchestrator",
    color: "#a78bfa",
    body: "The central dashboard where you can see all six agents and their current status — which ones are running, which have completed, and what they found. Your mission control.",
  },
];

export default function TutorialPage() {
  return (
    <AppShell>
      <section className="p-6 pb-20 max-w-3xl">
        {/* Header */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: "var(--brand)" }}>
          System Guide
        </p>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--ink)", letterSpacing: "-0.02em" }}>
          How Your AI Sales Engine Works
        </h1>
        <p className="text-base mb-10" style={{ color: "var(--ink-secondary)", lineHeight: "1.65", maxWidth: 560 }}>
          Tedmark AI is a system of six specialized AI agents that work together to find potential customers,
          reach out to them, and follow up — all with little to no manual effort from you.
        </p>

        {/* Pipeline strip */}
        <div className="flex items-center gap-0 rounded-2xl p-5 mb-10 overflow-x-auto"
          style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}>
          {PIPELINE.map((p, i) => (
            <div key={p.label} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 64 }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2"
                  style={{ borderColor: p.color, color: p.color, background: `${p.color}18` }}>
                  {p.num}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-center"
                  style={{ color: "var(--ink-muted)" }}>{p.label}</span>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className="h-px flex-1 mx-2" style={{ background: "var(--border-c)", minWidth: 16, marginBottom: 18 }} />
              )}
            </div>
          ))}
        </div>

        {/* Steps */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] pb-3 mb-6"
          style={{ color: "var(--ink-muted)", borderBottom: "1px solid var(--border-c)" }}>
          The Pipeline — Step by Step
        </p>

        <div className="flex flex-col gap-0.5 mb-14">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex gap-0">
              {/* Number + line */}
              <div className="flex flex-col items-center" style={{ width: 56, flexShrink: 0 }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold mt-5 flex-shrink-0"
                  style={{ background: `${s.color}20`, color: s.color }}>
                  {s.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 w-px mt-1.5" style={{ background: "var(--border-c)", minHeight: 24 }} />
                )}
              </div>

              {/* Card */}
              <div className="flex-1 rounded-xl p-5 my-2"
                style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="text-base font-bold" style={{ color: "var(--ink)" }}>{s.title}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                    style={s.auto
                      ? { background: "rgba(52,211,153,0.12)", color: "#34d399" }
                      : { background: "var(--surface-2)", color: "var(--ink-muted)" }}>
                    {s.auto ? "Runs automatically" : "On demand"}
                  </span>
                </div>
                <p className="text-sm mb-3" style={{ color: "var(--ink-secondary)", lineHeight: "1.65" }}>{s.body}</p>
                <div className="text-xs px-3 py-2 rounded-lg"
                  style={{ background: "var(--surface-2)", color: "var(--ink-muted)", borderLeft: `3px solid var(--brand)` }}>
                  {s.note}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Extras */}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] pb-3 mb-6"
          style={{ color: "var(--ink-muted)", borderBottom: "1px solid var(--border-c)" }}>
          Other Things the System Does
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {EXTRAS.map((e) => (
            <div key={e.title} className="rounded-xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-c)" }}>
              <div className="w-2 h-2 rounded-full mb-3" style={{ background: e.color }} />
              <p className="text-sm font-bold mb-1.5" style={{ color: "var(--ink)" }}>{e.title}</p>
              <p className="text-sm" style={{ color: "var(--ink-secondary)", lineHeight: "1.6" }}>{e.body}</p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="rounded-xl p-5" style={{ background: "rgba(45,106,247,0.08)", border: "1px solid var(--border-c)" }}>
          <p className="text-sm" style={{ color: "var(--ink-secondary)", lineHeight: "1.7" }}>
            <strong style={{ color: "var(--brand)" }}>The short version: </strong>
            You tell the system what kind of businesses you want to reach and in which city. From there, the agents
            handle the search, scoring, and first contact — drafting every message for your approval before it goes
            anywhere. You stay in control of the final send, while the system handles everything else automatically.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
