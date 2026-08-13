"use client";

import { useState } from "react";
import type { BusinessContextRow } from "@/lib/queries";

type Props = { initial: BusinessContextRow | null };

function tagsToString(arr: string[] | undefined | null): string {
  return (arr ?? []).join(", ");
}

function stringToTags(s: string): string[] {
  return s.split(",").map((t) => t.trim()).filter(Boolean);
}

export function BusinessContextForm({ initial }: Props) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: initial?.business_name ?? "",
    industry: initial?.industry ?? "",
    business_model: initial?.business_model ?? "",
    products: tagsToString(initial?.products),
    services: tagsToString(initial?.services),
    pricing: initial?.pricing ?? "",
    location: initial?.location ?? "",
    target_markets: tagsToString(initial?.target_markets),
    icp: initial?.icp ?? "",
    customer_segments: tagsToString(initial?.customer_segments),
    acquisition_channels: tagsToString(initial?.acquisition_channels),
    sales_channels: tagsToString(initial?.sales_channels),
    website: initial?.website ?? "",
    communication_channels: tagsToString(initial?.communication_channels),
    constraints: initial?.constraints ?? "",
    budget: initial?.budget ?? "",
    goals: initial?.goals ?? "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/business-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          products: stringToTags(form.products),
          services: stringToTags(form.services),
          target_markets: stringToTags(form.target_markets),
          customer_segments: stringToTags(form.customer_segments),
          acquisition_channels: stringToTags(form.acquisition_channels),
          sales_channels: stringToTags(form.sales_channels),
          communication_channels: stringToTags(form.communication_channels),
          social_media: {},
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <Section title="About the business">
        <Field label="Business name" hint="The full trading name">
          <input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="Tedmark Digital Agency" className="w-full" />
        </Field>
        <Field label="Industry" hint="One phrase: the sector you operate in">
          <input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="Digital marketing & web development" className="w-full" />
        </Field>
        <Field label="Business model" hint="How money comes in">
          <input value={form.business_model} onChange={(e) => set("business_model", e.target.value)} placeholder="Project-based + monthly retainer" className="w-full" />
        </Field>
        <Field label="Website" hint="Your own website">
          <input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://tedmark.com" className="w-full" />
        </Field>
        <Field label="Location" hint="City/country you operate from">
          <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Accra, Ghana" className="w-full" />
        </Field>
      </Section>

      <Section title="What you sell">
        <Field label="Products" hint="Comma-separated — physical or digital products, if any">
          <input value={form.products} onChange={(e) => set("products", e.target.value)} placeholder="Website builder package, Logo pack" className="w-full" />
        </Field>
        <Field label="Services" hint="Comma-separated — what you actually do for clients">
          <input value={form.services} onChange={(e) => set("services", e.target.value)} placeholder="Website design, Social media management, SEO, Automation, Google Ads" className="w-full" />
        </Field>
        <Field label="Pricing" hint="Describe how you price — ranges, tiers, or per-service">
          <textarea rows={3} value={form.pricing} onChange={(e) => set("pricing", e.target.value)} placeholder="Websites from GHS 3,000–15,000. Social media retainers from GHS 800/month. Custom packages on request." className="w-full" />
        </Field>
      </Section>

      <Section title="Who you sell to">
        <Field label="Ideal customer profile (ICP)" hint="One paragraph — the single best-fit customer type for your AI agents to target">
          <textarea rows={4} value={form.icp} onChange={(e) => set("icp", e.target.value)} placeholder="Ghanaian SMEs in hospitality, retail, or professional services with 5–50 employees and revenue of GHS 500k+/year. No or outdated website. Owner-led. Decision-maker is the founder." className="w-full" />
        </Field>
        <Field label="Target markets" hint="Comma-separated geographic or sector targets">
          <input value={form.target_markets} onChange={(e) => set("target_markets", e.target.value)} placeholder="Accra SMEs, Kumasi hospitality, Ghanaian diaspora businesses" className="w-full" />
        </Field>
        <Field label="Customer segments" hint="Comma-separated — how you group prospects">
          <input value={form.customer_segments} onChange={(e) => set("customer_segments", e.target.value)} placeholder="Hotels, restaurants, law firms, pharmacies, real estate agencies" className="w-full" />
        </Field>
      </Section>

      <Section title="How you reach customers">
        <Field label="Acquisition channels" hint="Comma-separated — how leads find you or you find them">
          <input value={form.acquisition_channels} onChange={(e) => set("acquisition_channels", e.target.value)} placeholder="Cold email, WhatsApp outreach, referrals, LinkedIn" className="w-full" />
        </Field>
        <Field label="Sales channels" hint="Comma-separated — how you close and deliver">
          <input value={form.sales_channels} onChange={(e) => set("sales_channels", e.target.value)} placeholder="Direct sales, proposal + sign-off, online payment" className="w-full" />
        </Field>
        <Field label="Communication channels" hint="Comma-separated — how you prefer to talk to clients">
          <input value={form.communication_channels} onChange={(e) => set("communication_channels", e.target.value)} placeholder="WhatsApp, Email, Phone call" className="w-full" />
        </Field>
      </Section>

      <Section title="Context for agents">
        <Field label="Current growth goal" hint="What are you trying to achieve right now — be specific">
          <textarea rows={3} value={form.goals} onChange={(e) => set("goals", e.target.value)} placeholder="Close 5 new clients per month by Q4. Focus on hotels and restaurants in Greater Accra." className="w-full" />
        </Field>
        <Field label="Budget" hint="What you're willing to spend on tools, ads, or outreach per month">
          <input value={form.budget} onChange={(e) => set("budget", e.target.value)} placeholder="GHS 2,000/month for ads + tools" className="w-full" />
        </Field>
        <Field label="Constraints" hint="Anything the agents should know — things to avoid, limitations">
          <textarea rows={3} value={form.constraints} onChange={(e) => set("constraints", e.target.value)} placeholder="No cold calling. Avoid government contracts. Do not pitch competitors of existing clients." className="w-full" />
        </Field>
      </Section>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save business context"}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">Saved — agents will use this from next run.</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink mb-4 pb-2 border-b border-border-c">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-0.5">{label}</label>
      <p className="text-xs text-ink-muted mb-1.5">{hint}</p>
      {children}
    </div>
  );
}
