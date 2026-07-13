// Shared between server (queries.ts) and client (knowledge-item-form.tsx)
// components — kept dependency-free so importing it never drags the
// server-only `pg` pool into a client bundle.
export const KNOWLEDGE_CATEGORIES = [
  "Company Knowledge",
  "Services & Pricing",
  "Sales Playbook",
  "Case Study",
  "SEO Research",
  "Content Library",
  "FAQ",
  "SOP / Workflow",
] as const;

export const KNOWLEDGE_AGENTS = ["scout", "qualifier", "outreach", "sequencer", "proposal", "analytics"] as const;

export const AGENT_LABELS: Record<string, string> = {
  scout: "Scout Agent",
  qualifier: "Qualifier Agent",
  outreach: "Outreach Agent",
  sequencer: "Sequencer Agent",
  proposal: "Proposal Agent",
  analytics: "Analytics Agent",
};

export const AGENT_DESCRIPTIONS: Record<string, string> = {
  scout: "Discovery & prospecting",
  qualifier: "Lead scoring",
  outreach: "Email & WhatsApp messaging",
  sequencer: "Follow-up sequencing",
  proposal: "Proposal generation",
  analytics: "Performance reporting",
};

// What each category is actually for, and which agent it feeds — shown
// inline in the Add/Edit form so "SEO Research" etc. aren't just unexplained
// jargon copied from a mockup.
export const CATEGORY_INFO: Record<
  (typeof KNOWLEDGE_CATEGORIES)[number],
  { description: string; example: string }
> = {
  "Company Knowledge": {
    description: "Who Tedmark is, target clients, tone, mission. Keeps every AI-written message sounding like Tedmark, not generic AI.",
    example:
      "Tedmark Digital Agency specializes in:\n- Business websites\n- E-commerce websites\n- School websites\n- SEO optimization\n- Website maintenance\n- Business automation solutions\n\nTarget clients: Medium-sized businesses and institutions in Ghana and across Africa.\nPrimary CTA: Book a free business audit.\nTone: Professional, practical, and results-oriented.",
  },
  "Services & Pricing": {
    description: "What you actually sell and what it costs. Stops Outreach/Proposal from inventing services or prices you don't offer.",
    example:
      "Business website: GHS 3,000 - 6,000 (5-8 pages, mobile-responsive, 2 weeks)\nE-commerce website: GHS 8,000 - 15,000 (payment integration, inventory, 4 weeks)\nSEO optimization: GHS 1,500/month retainer\nWebsite maintenance: GHS 500/month",
  },
  "Sales Playbook": {
    description: "How your team actually sells — qualifying questions, objection handling, what 'a good fit' looks like. Feeds Qualifier's scoring and Outreach's tone.",
    example:
      "A good-fit lead: has an outdated or missing website, active business (not dormant), decision-maker is reachable directly.\nCommon objection: \"We already have a website.\" Response: ask if it's mobile-friendly and getting them customers — offer a free audit either way.\nNever discount below 15% without agency-lead approval.",
  },
  "Case Study": {
    description: "Real client results. Gives Outreach/Proposal actual proof to cite instead of vague claims.",
    example:
      "Client: GhanaMart Pickup Depot (retail, Accra)\nProblem: No online presence, relying on walk-ins only.\nSolution: Built a mobile-first site + Google Business listing.\nResult: 40% increase in monthly inquiries within 3 months.",
  },
  "SEO Research": {
    description: "Real Ghana-market keyword/search-volume findings. Lets Qualifier and Outreach make a specific SEO pitch instead of a generic one.",
    example:
      "\"web design Accra\" — ~590 searches/month, moderate competition.\n\"school website Ghana\" — ~110 searches/month, low competition — strong opportunity for school-sector leads.\nMost Ghanaian SMB sites we've reviewed are missing basic meta descriptions and mobile viewport tags.",
  },
  "Content Library": {
    description: "Reusable exact-wording blocks — signatures, standard CTAs, boilerplate. Quoted verbatim instead of regenerated each time, for consistency.",
    example:
      "Email sign-off: \"— Ayinla, Tedmark Digital Agency\\nBook a free 15-min audit: [link]\"\nStandard CTA line: \"Want a free audit of your current site? Just reply YES.\"",
  },
  FAQ: {
    description: "Common client questions with your approved answers. Used when Sequencer handles a reply so answers stay consistent.",
    example:
      "Q: How long does a website take?\nA: Typically 2-4 weeks depending on scope, starting once content is provided.\n\nQ: Do you offer payment plans?\nA: Yes — 50% upfront, 50% on delivery, for most projects.",
  },
  "SOP / Workflow": {
    description: "Internal operating rules — guardrails, not sales copy. Things every message should respect.",
    example:
      "Always offer the free business audit as the primary CTA, not a hard sell.\nNever quote a firm price over WhatsApp — always say \"starting from\" and offer a call.\nIf a lead asks about refunds or complaints, do not respond automatically — flag for a human.",
  },
};
