# UX Transformation Audit — Tedmark Growth Engine
**Date:** 2026-08-24  
**Batch:** 1 of N  
**Status:** Read-only audit. No code was modified.

---

## A. Executive Summary

### What Exists
The Tedmark Growth Engine is an AI-powered outbound sales automation system for Tedmark Digital Agency, a digital services company targeting SMEs in West Africa (primarily Ghana). It combines a Node.js backend agent pipeline with a Next.js 16 web dashboard.

The system automatically discovers businesses (via Google Maps/Geoapify, Brave web search, and BusinessGhana.com directory), enriches them with contact information, scores them against an Ideal Customer Profile, drafts personalized outreach emails and WhatsApp messages, runs follow-up sequences, generates proposals, watches for email replies, and delivers daily analytics. A Telegram bot provides mobile control and real-time approval notifications.

### What Is Wrong with the Current UX
The current interface is an **internal operator dashboard**, not a business growth product. It exposes every implementation concern directly in the navigation: "AI Agents," "System Prompts," "API Spend," "Business Context." A user must understand how the AI pipeline works to navigate the product. The default landing route is `/agents` — the AI orchestrator page — requiring users to think in terms of agents rather than outcomes.

The sidebar has 13 navigation items across 4 groups. Internal technical concepts ("Lead Discovery," "Qualified Leads," "Outreach Drafts," "Follow-ups," "Proposals") are listed as separate silos rather than one unified pipeline view. The pipeline stages in the DB (`New`, `Contacted`, `Qualified`, `Proposal Sent`, `Negotiating`, `Won`, `Lost`) are not reflected in the navigation at all.

### What We Are Transforming It Into
A **growth intelligence product** with an outcome-oriented information architecture:
- **Home** — AI-generated next best actions, today's activity, pipeline health
- **Opportunities** — all discovered and qualified leads in a unified, filterable view
- **Conversations** — outreach drafts, sent messages, replies, follow-ups in one thread-centric view
- **Deals** — proposal pipeline and deal tracking
- **Growth** — analytics, trends, AI insights
- **AI Copilot** — on-demand agent runs, activity log, system status
- **AI Autopilot** — scheduled automation, settings that run the pipeline
- **Settings** — business profile, API keys, signatures, team

### What Must Remain Unchanged
- All DB tables, columns, and their semantics
- All agent logic (scout, enricher, qualifier, icp-scorer, outreach, sequencer, proposal, reply-watcher, analytics)
- All API routes (backend node.js CLI + web API routes)
- Authentication system (JWT cookie, `users` table, agency multi-tenancy)
- Telegram bot functionality
- The daily pipeline scheduler

---

## B. Current Architecture

### Frontend
- **Framework:** Next.js 16.2.10, React 19, TypeScript
- **Styling:** Tailwind CSS v4 with CSS variables for theming (light/dark via `data-theme`)
- **Animation:** Framer Motion 12, Lottie React
- **Icons:** Lucide React
- **Routing:** App Router, all pages are server components with selective `"use client"` components
- **Auth pattern:** JWT signed cookie (`tedmark_session`, 30-day expiry), `jose` library, server-side read via `cookies()`
- **Shell:** `AppShell` (sidebar + header + idle logout) wraps all authenticated pages. `CommandShell` is a second, alternative shell that exists in `components/command-shell.tsx` but is **not used by any current page** — it appears to be an older or experimental layout.

### Backend (Node.js)
- **Entry point:** `index.js` — CLI switch statement dispatching to agents
- **AI model:** DeepSeek v4-flash via OpenAI-compatible API (endpoint: `https://api.deepseek.com`)
- **Email sending:** Resend SDK
- **Email reading (replies):** ImapFlow + mailparser (polling `contact@tedmarkdigital.com`)
- **Web scraping:** Playwright (Chromium)
- **Maps/places:** Geoapify Places API (via `tools/mapsClient.js`)
- **Web search:** Brave Search API (via `tools/searchClient.js`)
- **Business directory:** BusinessGhana.com scraping (via `tools/directoryClient.js`)
- **AI reading (Jina):** `r.jina.ai` readable content extraction (via `tools/jinaReader.js`)
- **PDF generation:** `tools/proposalPdf.js` (Playwright-based)
- **Scheduling:** `node-cron` (sequencer runs at 08:00, Telegram bot daily report at 18:00)

### Agents (15 agent files)
See Section D for full inventory.

### Database Tables (inferred from queries and mutations)
| Table | Purpose |
|-------|---------|
| `leads` | Core entity — discovered businesses. Contains pipeline_stage, status (raw/qualified/contacted/archived), ICP scores, site signals, decision-maker fields, deal fields |
| `outreach` | All messages: email drafts, WhatsApp drafts, sent messages. Has status (draft/approved/sent), replied flag, knowledge_ids array |
| `follow_ups` | Sequencer-generated follow-up schedule records |
| `proposals` | AI-generated proposals with Markdown content, services, budget_range |
| `replies` | Inbound email replies with classification (interested/not_interested/needs_info/other) |
| `knowledge_items` | Company knowledge base entries injected into agent prompts |
| `analytics_snapshots` | Periodic analytics agent outputs (summary text + JSON insights) |
| `settings` | Per-agency key-value configuration store |
| `business_context` | Agency profile: name, services, ICP, pricing, goals, etc. |
| `users` | Authentication: email, password_hash, name, role, agency_id |
| `signatures` | Email/WhatsApp sender signatures |
| `telegram_links` | Maps users to Telegram chat IDs |
| `telegram_link_codes` | One-time codes for Telegram linking |
| `telegram_messages` | Log of all Telegram inbound/outbound messages |
| `api_usage` | Token and request counts per provider for cost tracking |
| `search_api_usage` | Separate search-specific usage log |
| `scout_progress` | Tracks sector+city discovery progress and offsets |
| `search_progress` | Tracks web-search discovery progress |
| `directory_progress` | Tracks directory discovery progress |
| `enrich_events` | Live streaming enrichment log per lead |

### Lead Fields of Note
The `leads` table carries both pipeline automation state (`status`: raw/qualified/contacted/archived) and CRM state (`pipeline_stage`: New/Contacted/Qualified/Proposal Sent/Negotiating/Won/Lost) plus `next_action`, `next_action_due`, `deal_value`, `deal_currency`.

### Prompts (8 prompt files in `prompts/`)
See Section J for full audit.

### Scheduled Jobs
- `node-cron` inside `agents/sequencer.js`: daily at 08:00
- `node-cron` inside `agents/telegramBot.js`: daily Telegram report at 18:00
- `scripts/dailyPipeline.js`: manually invoked or externally scheduled (no cron in web process)

### Integrations
| Integration | Purpose | Tool File |
|-------------|---------|-----------|
| DeepSeek AI | All LLM completions | `tools/llm.js` |
| Geoapify Places | Business discovery from maps | `tools/mapsClient.js` |
| Brave Search | Web search discovery | `tools/searchClient.js` |
| Resend | Email sending | `tools/emailSender.js` |
| IMAP (Gmail/Google Workspace) | Reading inbound replies | `tools/inboxClient.js` |
| Telegram Bot API | Mobile notifications + approval UI | `tools/telegram.js`, `tools/telegramNotify.js` |
| Jina Reader | Web content extraction for enrichment | `tools/jinaReader.js` |
| Playwright | Website scraping, site signals, PDF rendering | `tools/scraper.js`, `tools/proposalPdf.js` |
| BusinessGhana.com | Directory-based discovery | `tools/directoryClient.js` |
| WhatsApp | Manual sending only (no API integration; user copies message text) | `tools/channel.js` |

### Authentication
- JWT HS256 cookie, 30-day session
- `users` table with `role` and `agency_id`
- Roles present in code: `admin`, `super_admin`
- Multi-tenant: every query is scoped by `agency_id` via `tools/agency.js` / `lib/agency.ts`
- Idle logout after configurable minutes (default: 15, controlled by `settings.idle_logout_minutes`)

---

## C. Complete Route Inventory

### Page Routes

| Route | Purpose | Key Components | Backend Dependencies | Current UX Role | Future Role | Classification |
|-------|---------|----------------|---------------------|----------------|-------------|----------------|
| `/` | Redirects to `/agents` | — | none | Entry redirect | Redirect to `/home` | Infrastructure |
| `/login` | Email + password login | `LoginForm` | `findUserByEmail`, bcrypt, JWT | Authentication | Keep | Admin |
| `/agents` | AI Orchestrator — pipeline visualization, agent status, run buttons | `AppShell`, `OrchestrationCanvasLive`, `AgentRunButton`, `RunScoutModal`, `TerminalLog`, `AiCoreViz` | `getKpiSummary`, `getAgentActivity`, `getGrowthStats`, `getLatestAnalyticsSnapshot`, `getSettings` | Default landing page; shows pipeline health and allows running agents | Move to **AI Copilot** section; not default landing | Admin |
| `/dashboard` | KPI metrics, trend chart, funnel donut, top leads table, due actions | `AppShell`, `FunnelDonut`, `TrendChart`, `SectorBars` | `getKpiSummary`, `getRecentQualifiedLeads`, `getDueActions`, `getSectorBreakdown`, `getLeadsTrend` | Secondary overview (not default landing despite the name) | Merge content into **Home** as default landing | Customer |
| `/lead-discovery` | Full table of all discovered leads with status filters | `AppShell`, `LeadDiscoveryTable`, `RunScoutModal`, `DateRangeFilter` | `getLeads` | Shows raw + qualified + contacted + archived leads in one table | Refactor into **Opportunities** view | Customer |
| `/leads/[id]` | Lead detail page with all data, thread, proposal wizard, pipeline CRM | `AppShell`, `ScoringProtocol`, `PipelineCell`, `ProposalWizard`, `ReplyForm`, `LeadRowActions`, `EnrichLiveFeed` | `getLeadDetail`, `getScoringProtocol`, enrichment streaming SSE, outreach generation | Deep-dive view per lead | Keep as **Opportunity detail** | Customer |
| `/qualified-leads` | Filtered view: only scored leads, sortable by ICP score | `AppShell`, `DateRangeFilter`, `LeadDiscoveryTable` | `getQualifiedLeadsFiltered` | Qualified-only lead view | Merge into Opportunities with filter | Customer |
| `/outreach` | Table of all outreach drafts and sent messages; approve/send actions | `AppShell`, `OutreachModal`, `OutreachGeneratePanel`, `DateRangeFilter` | `getOutreach`, `getSignatures`, `getKnowledgeRefs` | Approval queue for AI-drafted messages | Refactor into **Conversations** | Customer |
| `/follow-ups` | Table of sequencer-generated follow-up records | `AppShell`, `DateRangeFilter` | `getFollowUps` | Shows follow-up schedule | Merge into Conversations (thread view per lead) | Customer |
| `/proposals` | Table of all generated proposals; download/send | `AppShell`, `ProposalModal`, `DateRangeFilter` | `getProposals` | Proposal management | Move to **Deals** section | Customer |
| `/analytics` | Latest analytics snapshot with sector, channel, funnel data | `AppShell`, `DateRangeFilter` | `getLatestAnalyticsSnapshot`, `getApiUsageSummary` | Analytics view | Keep as **Growth** section | Customer |
| `/knowledge-base` | List and manage knowledge items injected into prompts | `AppShell`, `KnowledgeItemForm` | `getKnowledgeItemsWithUsage`, `getKnowledgeCategoryStats` | Knowledge management | Move to **AI Autopilot** > Knowledge | Admin |
| `/knowledge-base/new` | Create new knowledge item | `AppShell`, `KnowledgeItemFormPage` | `insertKnowledgeItemDb` | Knowledge creation | Keep, re-route under Autopilot | Admin |
| `/knowledge-base/[id]` | Knowledge item detail + usage stats | `AppShell`, `KnowledgeItemDetail` | `getKnowledgeItemById`, `getKnowledgeUsage` | Knowledge detail | Keep, re-route | Admin |
| `/knowledge-base/[id]/edit` | Edit knowledge item | `AppShell`, `KnowledgeItemFormPage` | `updateKnowledgeItemDb` | Knowledge editing | Keep, re-route | Admin |
| `/prompts` | In-browser editor for all 8 prompt `.md` files | `AppShell` (client page) | `/api/prompts` GET/POST | Prompt editing | Move to **AI Autopilot** > Prompts | Admin |
| `/agents` (above) | (Already listed) | | | | | |
| `/business-context` | Form to fill in agency profile injected into all agent prompts | `AppShell`, `BusinessContextForm` | `/api/business-context` GET/POST | Business configuration | Move to **Settings** > Agency Profile | Configuration |
| `/costs` | API spend tracking by provider with daily chart | `AppShell`, `AnimatedBar`, `DateRangeFilter` | `getApiUsageSummary` | Cost monitoring | Move to **Settings** > API Spend | Configuration |
| `/settings` | Pipeline settings (scout countries/sectors, outreach limits, etc.) + API keys status + Telegram link | `AppShell`, `SettingsForm`, `TelegramLinkCard` | `getSettings`, `getTelegramLinkForUser`, `getSearchApiUsageThisMonth` | System configuration | Keep in **Settings** > Automation | Configuration |
| `/tutorial` | In-app tutorial page | `AppShell` | None | Onboarding | Keep as **Help** > Getting Started | Admin |
| `/help` | Help center with search | `AppShell`, `HelpSearch` | None | Help content | Keep as **Help** | Admin |

### API Routes

| Route | Method | Purpose | Classification |
|-------|--------|---------|----------------|
| `/api/activity` | GET | SSE stream of agent activity | Infrastructure |
| `/api/proposals/[id]/pdf` | GET | Download proposal as PDF | Customer |
| `/api/business-context` | GET, POST | Read and save business context | Configuration |
| `/api/prompts` | GET, POST | Read and save prompt files from filesystem | Admin |
| `/api/enrich-live` | GET | SSE stream of enrichment events for a lead | Infrastructure |
| `/api/whatsapp` | POST | Mark WhatsApp outreach as manually sent | Customer |

---

## D. Complete Agent Inventory

### 1. Scout (`agents/scout.js`)
- **Purpose:** Discover businesses by sector + city using Geoapify Places API
- **Inputs:** `sector`, `city`, `limit`, `offset`, `country`
- **Outputs:** `leads` rows inserted (status: raw)
- **Prompts consumed:** None (no LLM call)
- **Tools used:** `mapsClient.js` (Geoapify), `scraper.js` (website reachability check), `db.js` (insertLead, findLeadByNameAndLocation)
- **DB tables written:** `leads`
- **Current UI exposure:** `RunScoutModal` component on `/agents` and `/lead-discovery` pages; also triggered via `dailyPipeline.js`
- **Future UI exposure:** Trigger button in **AI Copilot** section; progress visible in **Opportunities** feed

### 2. WebScout (`agents/webScout.js`)
- **Purpose:** Discover businesses via Brave Search web queries (Google dorks, LinkedIn/Facebook snippets)
- **Inputs:** `sector`, `city`, `query`, `queryType`, `offset`, `country`
- **Outputs:** `leads` rows inserted (status: raw)
- **Prompts consumed:** None (no LLM call)
- **Tools used:** `searchClient.js` (Brave), `searchQueries.js`, `scraper.js`, `db.js`
- **DB tables written:** `leads`, `search_api_usage`, `api_usage`
- **Current UI exposure:** Part of `RunScoutModal` (web-scout mode); `dailyPipeline.js`
- **Future UI exposure:** Same as Scout — unified discovery trigger in AI Copilot

### 3. DirectoryScout (`agents/directoryScout.js`)
- **Purpose:** Discover businesses from BusinessGhana.com directory (phone-book style, no website)
- **Inputs:** `sector`, `categorySlug`, `page`
- **Outputs:** `leads` rows inserted (status: raw)
- **Prompts consumed:** None
- **Tools used:** `directoryClient.js`, `directoryParsing.js`, `db.js`
- **DB tables written:** `leads`
- **Current UI exposure:** `dailyPipeline.js` rotation only; no direct UI trigger
- **Future UI exposure:** Include in AI Copilot discovery run controls

### 4. Enricher (`agents/enricher.js`)
- **Purpose:** Find contact information (email, phone, owner name, social links, website) for leads
- **Inputs:** `limit`, `leadId`, `emit` (optional SSE callback)
- **Outputs:** Updates `leads.email`, `leads.phone`, `leads.website_url`, `leads.decision_maker_name`
- **Prompts consumed:** None (heuristic extraction, no LLM call)
- **Tools used:** `contactFinder.js`, `jinaReader.js`, `searchClient.js` (web + places), `db.js`
- **DB tables written:** `leads`, `enrich_events`
- **Current UI exposure:** Live-streaming enrichment visible on `/leads/[id]` via `EnrichLiveFeed` + SSE; also `dailyPipeline.js`
- **Future UI exposure:** Trigger from Opportunity detail page; live feed on same page

### 5. DmEnrich (`agents/dmEnrich.js`)
- **Purpose:** Find decision-maker name, title, email, LinkedIn from website content using LLM
- **Inputs:** `limit`, `leadId`
- **Outputs:** Updates `leads.dm_name`, `dm_title`, `dm_email`, `dm_phone`, `dm_linkedin_url`, `dm_enriched_at`
- **Prompts consumed:** `prompts/dmEnrich.md`
- **Tools used:** `jinaReader.js`, `llm.js`, `db.js`, `businessContext.js`
- **DB tables written:** `leads`
- **Current UI exposure:** `dailyPipeline.js` only; no direct UI trigger
- **Future UI exposure:** Auto-run shown as "AI enriched" indicator on Opportunity cards

### 6. Qualifier (`agents/qualifier.js`)
- **Purpose:** Score each lead 1–10 based on website quality and digital needs
- **Inputs:** `limit`, `leadId`
- **Outputs:** Updates `leads.score`, `score_reason`, `recommended_services`, `problems`, `qualified_at`, advances `status` to 'qualified'
- **Prompts consumed:** `prompts/qualify.md`
- **Tools used:** `llm.js`, `scraper.js`, `knowledge.js`, `businessContext.js`, `db.js`
- **DB tables written:** `leads`
- **Current UI exposure:** `AgentRunButton` on `/agents` page (runs qualify action); `dailyPipeline.js`
- **Future UI exposure:** Show scoring progress in AI Copilot; scores shown on Opportunity cards

### 7. IcpScorer (`agents/icpScorer.js`)
- **Purpose:** Score leads on Budget, Authority, Need, Urgency, Fit (BANUF — 5 dimensions, 1–5 each, total /25)
- **Inputs:** `limit`, `leadId`
- **Outputs:** Updates `leads.icp_budget`, `icp_authority`, `icp_need`, `icp_urgency`, `icp_fit`, `icp_total`, `icp_reasoning`, `icp_scored_at`
- **Prompts consumed:** `prompts/icpScore.md`
- **Tools used:** `llm.js`, `businessContext.js`, `db.js`
- **DB tables written:** `leads`
- **Current UI exposure:** `dailyPipeline.js` only; ICP scores shown on lead detail page
- **Future UI exposure:** Shown as a readiness indicator on Opportunity detail

### 8. Outreach (`agents/outreach.js`)
- **Purpose:** Draft personalized cold emails and WhatsApp messages per lead
- **Inputs:** `limit`, `leadId`, `signatureId`
- **Outputs:** Inserts `outreach` rows (status: draft); sends Telegram approval notification
- **Prompts consumed:** `prompts/outreach.md`, `prompts/outreach-whatsapp.md`; also reads `copywriting` skill if present
- **Tools used:** `llm.js`, `knowledge.js`, `businessContext.js`, `signature.js`, `channel.js`, `telegramNotify.js`, `jinaReader.js`, `db.js`
- **DB tables written:** `outreach`
- **Current UI exposure:** `OutreachGeneratePanel` on `/outreach` page; Telegram approval buttons; `dailyPipeline.js`
- **Future UI exposure:** Draft generation trigger in Conversations; approval inbox

### 9. Sequencer (`agents/sequencer.js`)
- **Purpose:** Draft and schedule follow-up messages for leads that haven't replied after N days
- **Inputs:** None (runs from settings: `sequencer_days_between_steps`, `sequencer_max_steps`)
- **Outputs:** Inserts `outreach` rows (follow-up drafts), inserts `follow_ups` rows; archives leads that exhaust the sequence
- **Prompts consumed:** Inline email prompt (hardcoded in `agents/sequencer.js`); `prompts/followup-whatsapp.md`; reads `emails` skill if present
- **Tools used:** `llm.js`, `knowledge.js`, `signature.js`, `db.js`
- **DB tables written:** `outreach`, `follow_ups`, `leads` (archived)
- **Current UI exposure:** `AgentRunButton` on `/agents` page; `dailyPipeline.js`; cron at 08:00
- **Future UI exposure:** Autopilot section shows follow-up sequence status

### 10. Proposal (`agents/proposal.js`)
- **Purpose:** Generate a full Markdown proposal document for a qualified lead
- **Inputs:** `leadId`, `services` (array), `budgetRange`
- **Outputs:** Inserts `proposals` row; advances `pipeline_stage` to 'Proposal Sent'
- **Prompts consumed:** `prompts/proposal.md`
- **Tools used:** `llm.js`, `knowledge.js`, `businessContext.js`, `jinaReader.js`, `countries.js`, `db.js`
- **DB tables written:** `proposals`, `leads` (pipeline_stage update)
- **Current UI exposure:** `ProposalWizard` component on `/leads/[id]` page
- **Future UI exposure:** "Create Proposal" action on Deal/Opportunity detail

### 11. ProposalDelivery (`agents/proposalDelivery.js`)
- **Purpose:** Render proposal to PDF and send via email
- **Inputs:** `proposalId`, `outPath` (export) or just `proposalId` (send)
- **Outputs:** PDF file written or email sent via Resend
- **Prompts consumed:** None
- **Tools used:** `proposalPdf.js` (Playwright), `emailSender.js` (Resend), `db.js`
- **DB tables written:** None (reads only)
- **Current UI exposure:** PDF download button in `ProposalModal` on `/proposals`; CLI only for send
- **Future UI exposure:** "Send Proposal" button in Deals

### 12. ReplyWatcher (`agents/replyWatcher.js`)
- **Purpose:** Poll email inbox for replies, classify them, create response drafts, notify Telegram
- **Inputs:** None (reads from `contact@tedmarkdigital.com` via IMAP)
- **Outputs:** Inserts `replies` rows with classification; optionally inserts new `outreach` draft; sends Telegram notification
- **Prompts consumed:** `prompts/classify-reply.md`
- **Tools used:** `inboxClient.js` (ImapFlow), `inboxParsing.js`, `llm.js`, `telegramNotify.js`, `db.js`
- **DB tables written:** `replies`, `outreach` (optional draft)
- **Current UI exposure:** Replies visible in lead thread on `/leads/[id]`; Telegram notification; no UI trigger (CLI: `check-replies`)
- **Future UI exposure:** Auto-run indicator in Conversations; replies surface in conversation thread

### 13. Analytics (`agents/analytics.js`)
- **Purpose:** Compute sector performance, channel effectiveness, and funnel conversion metrics; persist snapshot
- **Inputs:** None (queries live DB)
- **Outputs:** Inserts `analytics_snapshots` row
- **Prompts consumed:** None (pure SQL computation)
- **Tools used:** `db.js`
- **DB tables written:** `analytics_snapshots`
- **Current UI exposure:** Latest snapshot shown on `/analytics` and `/agents` pages; `AgentRunButton` on `/agents`
- **Future UI exposure:** Auto-computed on schedule; surfaced in Growth section

### 14. TelegramBot (`agents/telegramBot.js`)
- **Purpose:** Long-polling Telegram bot for mobile control (status, leads, pause/resume, approval)
- **Inputs:** Real-time Telegram updates
- **Outputs:** Telegram messages; triggers `runApprove` and `runSend` on approval; calls `setSetting` on pause/resume; cron daily report at 18:00
- **Prompts consumed:** Inline intent classification (classifyIntent function)
- **Tools used:** `telegram.js`, `telegramAuth.js`, `telegramNotify.js`, `db.js`, `settings.js`, `llm.js`
- **DB tables written:** `telegram_messages`, `settings`
- **Current UI exposure:** `TelegramLinkCard` on `/settings` page
- **Future UI exposure:** Settings > Notifications > Telegram

### 15. KnowledgeCleaner (`agents/knowledgeCleaner.js`)
- **Purpose:** Clean raw pasted text into a structured knowledge base entry
- **Inputs:** `category`, `text`
- **Outputs:** Returns cleaned text (CLI output only, does not write to DB)
- **Prompts consumed:** Inline system prompt (hardcoded in the agent)
- **Tools used:** `llm.js`
- **DB tables written:** None (CLI utility)
- **Current UI exposure:** CLI only (`node index.js clean-knowledge`)
- **Future UI exposure:** Could be a "paste & clean" helper in Knowledge Base editor

---

## E. Current User Journeys

### 1. Prospect Discovery
1. User navigates to `/agents` (default landing)
2. Clicks "Run Scout" button → `RunScoutModal` opens
3. Selects sector and city, submits → `AgentRunButton` triggers `/api/activity` stream
4. Results appear as raw leads in `/lead-discovery` table

### 2. Lead Enrichment
1. User navigates to `/lead-discovery`, finds a lead
2. Clicks lead → goes to `/leads/[id]`
3. Scrolls to "Enrichment" section → clicks "Enrich Now"
4. Live feed appears in `EnrichLiveFeed` component via SSE (`/api/enrich-live`)
5. Page refreshes to show updated phone/email fields

### 3. Qualification
1. On `/agents` page, clicks `AgentRunButton` "Run Qualifier"
2. Or qualification runs automatically in `dailyPipeline.js`
3. Results visible on `/qualified-leads` with score badges

### 4. ICP Scoring
1. Runs automatically after qualification in `dailyPipeline.js`
2. ICP breakdown (B/A/N/U/F scores) visible on `/leads/[id]`
3. No direct UI trigger in current web app

### 5. Outreach Drafting
1. On `/outreach` page, clicks `OutreachGeneratePanel` → selects signature, submits
2. Or runs automatically in `dailyPipeline.js`
3. Telegram notification received with Approve/Reject buttons
4. User approves on Telegram → email auto-sent; WhatsApp messages require manual copy-paste

### 6. Reply Handling
1. `replyWatcher` runs on CLI (`node index.js check-replies`)
2. Telegram notification received with classification
3. Draft reply created (if classified as interested/needs_info)
4. User reviews draft in `/outreach` → approves and sends

### 7. Follow-up Sequencing
1. `sequencer` cron runs at 08:00 daily
2. Leads that haven't replied in 3+ days get follow-up drafts
3. After 3 steps with no reply, lead is archived
4. Follow-up records visible on `/follow-ups`

### 8. Proposal Generation
1. User navigates to `/leads/[id]`
2. Scrolls to Proposal section → `ProposalWizard` opens
3. Selects services and budget range → AI generates Markdown proposal
4. User reviews on `/proposals` → downloads PDF or sends via CLI

### 9. Analytics
1. User navigates to `/analytics`
2. Views latest snapshot with sector/channel/funnel charts
3. Clicks `AgentRunButton` "Run Analytics" on `/agents` to refresh

### 10. Business Configuration
1. User navigates to `/business-context`
2. Fills in agency name, services, ICP, pricing, goals
3. Navigates to `/settings` to configure scout countries/sectors, outreach limits, Telegram integration
4. Navigates to `/prompts` to read/edit any of the 8 prompt files
5. Navigates to `/costs` to see API spend and enter cost rates

---

## F. UX Problems (with Code Evidence)

### F1. Wrong Default Landing Page
`web/src/app/page.tsx` line 3: `redirect("/agents")` — users land on the AI Orchestrator, a technical system status page. They must understand pipeline architecture before seeing any business value.

### F2. Navigation Exposes Implementation Concepts
`web/src/components/sidebar.tsx` lines 27–61: The sidebar exposes 13 navigation items in 4 groups labelled "Overview," "Pipeline," "AI Engine," and "Configuration." Items include:
- "AI Agents" — internal term for the orchestration engine
- "System Prompts" — requires knowing what AI prompts are
- "API Spend" — infrastructure concern
- "Business Context" — meta-configuration, not a business concept

A sales professional should never see "API Spend" or "System Prompts" in their primary navigation.

### F3. Pipeline Fragmented Across 5 Separate Pages
The lead pipeline (Lead Discovery → Qualified Leads → Outreach Drafts → Follow-ups → Proposals) occupies 5 separate nav items that a user must click through individually. There is no unified pipeline view. The DB has `pipeline_stage` values ('New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiating', 'Won', 'Lost') that are not reflected in the navigation at all.

### F4. Outreach Approval UX is Telegram-Only for the Critical Path
`agents/outreach.js` lines 183–218: Email outreach approval happens via Telegram inline keyboard buttons. The web app's `/outreach` page has an `OutreachModal` for web-based approval, but the primary prompt-to-action notification is Telegram. Users without Telegram linked get no notification. The empty state on `/outreach` reads: `'Click "Generate drafts" above, or run: node index.js outreach --limit 10'` — exposing the CLI command to end users.

### F5. WhatsApp Outreach Has No Sending Mechanism
`agents/outreach.js` lines 189–218: WhatsApp messages are drafted and saved to DB but cannot be sent from the web app. The Telegram bot says: "This is a WhatsApp message — open the dashboard to send it (no automated WhatsApp sending yet)." The `/api/whatsapp` route only marks a message as sent; there is no actual WhatsApp API integration. Users must manually copy the message text and paste it into WhatsApp.

### F6. System Prompts Editable via Raw Markdown in the Browser
`web/src/app/prompts/page.tsx` lines 1–50: The prompts page is a client-side text editor that reads and writes `.md` files directly from the server filesystem via `/api/prompts`. There is no validation, preview, diff, or rollback. Destructive edits to `qualify.md` would immediately change how all future leads are scored.

### F7. Two Shell Layouts, Only One Used
`web/src/components/command-shell.tsx` (49 nav items, "Deploy New Agent" button, search bar) exists but is imported by no page. `web/src/components/app-shell.tsx` is the actual shell. This creates maintenance confusion and the `CommandShell` has a non-functional search input and a non-functional "Deploy New Agent" button.

### F8. Mobile UX is Non-functional
`web/src/components/sidebar.tsx` lines 70–213: The sidebar is `position: fixed`, `width: 240px` (or 68px collapsed), with no mobile breakpoint. On screens narrower than 240px + main content, the main area is inaccessible. There is no hamburger menu. No page uses mobile-specific layout patterns.

The main content in `app-shell.tsx` line 17: `style={{ marginLeft: "240px" }}` is injected as inline style via a `<style>` tag from the sidebar — this overrides Tailwind's responsive utilities.

Several tables use `overflow-x: auto` containers (e.g. `/lead-discovery` uses `LeadDiscoveryTable`), but the sidebar itself prevents mobile use entirely.

### F9. `CommandShell` Has Stale Active Link Hardcoded
`web/src/components/command-shell.tsx` line 27: `{ href: "/agents", label: "AI Orchestrator", icon: Bot, active: true }` — `active: true` is hardcoded unconditionally, ignoring the current pathname. This component is unused but represents a systemic pattern where active state is not computed from pathname.

### F10. KPI Duplication Between Dashboard and Agents Pages
Both `/dashboard` and `/agents` call `getKpiSummary()`, `getRecentQualifiedLeads()`, `getFollowUps()`, `getOutreach()`, `getProposals()`. The two pages present overlapping data with different visual treatments but no clear differentiation in purpose for the user.

### F11. No Notification System in the Web App
Outreach approval notifications go to Telegram. The web app has a `NotificationsDropdown` component imported in `command-shell.tsx`, but no notifications are surfaced in `AppShell`'s header. Users who miss a Telegram message have no in-app way to know approvals are pending.

### F12. Settings Page Exposes Raw Environment Variable Status
`web/src/app/settings/page.tsx` lines 13–20: The settings page shows a table of API key names and their configured/unconfigured status by reading the `.env` file directly. This is developer-facing infrastructure exposure in a user-facing settings page.

---

## G. Target Information Architecture

| Section | Label | What It Means in Existing Functionality |
|---------|-------|----------------------------------------|
| **Home** | Home | Today's AI-generated next actions (due actions from `leads.next_action_due`), pipeline health KPIs, latest analytics summary, recent activity feed |
| **Opportunities** | Opportunities | Unified view of all leads regardless of status; filterable by pipeline stage; replaces `/lead-discovery`, `/qualified-leads`; lead detail becomes "opportunity detail" |
| **Conversations** | Conversations | Thread-centric view of all outreach: drafts pending approval, sent messages, follow-ups, inbound replies — per lead; replaces `/outreach`, `/follow-ups` as separate silos |
| **Deals** | Deals | Pipeline-stage-based deal tracking; proposal management; won/lost tracking with `deal_value`; replaces `/proposals` |
| **Growth** | Growth | Analytics: sector performance, channel effectiveness, funnel conversion rates; the `/analytics` route content |
| **AI Copilot** | AI Copilot | On-demand agent runs (scout, qualify, enrich, pipeline), activity log, agent status — the intelligence-facing part of `/agents` |
| **AI Autopilot** | AI Autopilot | Automation configuration: scout settings (countries, sectors, frequency), sequencer settings, outreach limits; Knowledge Base; prompt editing; the operational half of `/settings` + `/knowledge-base` + `/prompts` |
| **Settings** | Settings | Business profile (from `/business-context`), API key status, signatures, Telegram integration, cost rates; the user-facing part of current `/settings` + `/business-context` + `/costs` |

---

## H. Current → Future Mapping

| Current Route | Current Name | Future Section | Future Name | Action |
|---------------|-------------|----------------|-------------|--------|
| `/` | Root redirect | — | Redirect to `/home` | REFACTOR (target) |
| `/dashboard` | Dashboard | Home | Home | REFACTOR → `/home` |
| `/agents` | AI Agents | AI Copilot | AI Copilot | REFACTOR → `/copilot` |
| `/lead-discovery` | Lead Discovery | Opportunities | Opportunities | REFACTOR → `/opportunities` |
| `/qualified-leads` | Qualified Leads | Opportunities | Opportunities (filtered) | MERGE into `/opportunities` |
| `/leads/[id]` | Lead Detail | Opportunities | Opportunity Detail | REFACTOR → `/opportunities/[id]` |
| `/outreach` | Outreach Drafts | Conversations | Conversations | REFACTOR → `/conversations` |
| `/follow-ups` | Follow-ups | Conversations | Conversations (follow-ups tab) | MERGE into `/conversations` |
| `/proposals` | Proposals | Deals | Deals | REFACTOR → `/deals` |
| `/analytics` | Analytics | Growth | Growth | REFACTOR → `/growth` |
| `/knowledge-base` | Knowledge Base | AI Autopilot | AI Autopilot > Knowledge | MOVE → `/autopilot/knowledge` |
| `/knowledge-base/new` | New Knowledge Item | AI Autopilot | AI Autopilot > Knowledge > New | MOVE |
| `/knowledge-base/[id]` | Knowledge Detail | AI Autopilot | AI Autopilot > Knowledge > Detail | MOVE |
| `/knowledge-base/[id]/edit` | Edit Knowledge | AI Autopilot | AI Autopilot > Knowledge > Edit | MOVE |
| `/prompts` | System Prompts | AI Autopilot | AI Autopilot > Prompts | MOVE → `/autopilot/prompts` |
| `/business-context` | Business Context | Settings | Settings > Agency Profile | MOVE → `/settings` (tab) |
| `/costs` | API Spend | Settings | Settings > API Usage | MOVE → `/settings` (tab) |
| `/settings` | Settings | Settings + AI Autopilot | Settings > Automation | SPLIT: pipeline settings → `/autopilot`, API keys/Telegram → `/settings` |
| `/tutorial` | Tutorial | Help | Help > Getting Started | KEEP → `/help/tutorial` |
| `/help` | Help Center | Help | Help | KEEP |
| `/login` | Login | Login | Login | KEEP |

---

## I. Data Model Readiness

### Opportunities (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Business name, sector, location, country | EXISTS: `leads.business_name`, `sector`, `location`, `country` |
| Contact info (email, phone, website) | EXISTS: `leads.email`, `phone`, `website_url` |
| Discovery source | EXISTS: `leads.source` (maps/web/directory) |
| AI qualifier score (1–10) | EXISTS: `leads.score`, `score_reason`, `problems`, `recommended_services` |
| ICP scoring (BANUF) | EXISTS: `leads.icp_budget`, `icp_authority`, `icp_need`, `icp_urgency`, `icp_fit`, `icp_total` |
| Pipeline stage | EXISTS: `leads.pipeline_stage` (New/Contacted/Qualified/Proposal Sent/Negotiating/Won/Lost) |
| Status | EXISTS: `leads.status` (raw/qualified/contacted/archived) |
| Decision maker | EXISTS: `leads.dm_name`, `dm_title`, `dm_email`, `dm_phone`, `dm_linkedin_url` |
| Website signals | EXISTS: `leads.site_signals` (JSON: mobileFriendly, hasCTA, etc.) |
| Next action + due date | EXISTS: `leads.next_action`, `next_action_due` |

**Missing for Opportunities:** Priority/starred flag for pinning important leads. Tag/label system for user-defined categorization.

### Conversations (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Outreach messages (email + WhatsApp) | EXISTS: `outreach` table (message_type, subject, body, status) |
| Reply messages | EXISTS: `replies` table (body, classification, from_email) |
| Follow-up schedule | EXISTS: `follow_ups` table (sequence_step, scheduled_at, status) |
| Thread ordering (lead → outreach → replies) | PARTIAL: `getLeadThread` in `mutations.ts` joins outreach + replies; no unified threadId |
| Read/unread state for replies | MISSING: No `read` flag on `replies` table |
| Internal notes per lead | MISSING: No notes/comments table |

### Deals (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Proposals | EXISTS: `proposals` table (services, budget_range, content, knowledge_ids) |
| Pipeline stage | EXISTS: `leads.pipeline_stage` |
| Deal value | EXISTS: `leads.deal_value`, `deal_currency` (referenced in `getHistoricalResults` query) |
| Won/Lost tracking | EXISTS: `leads.pipeline_stage` = 'Won'/'Lost'; `won_revenue` computed |
| Proposal PDF | EXISTS: `proposalPdf.js` + `/api/proposals/[id]/pdf` |

**Missing for Deals:** Dedicated deals table separating deals from leads; multiple deals per lead; deal close date; deal probability.

### Next Best Action (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Per-lead next action + due date | EXISTS: `leads.next_action`, `next_action_due` |
| Overdue detection | EXISTS: used in `getDueActions()` query |
| AI-generated suggestion | MISSING: no `ai_next_action_suggestion` field; current next_action is human-set |

**Missing:** AI-generated next best action recommendations per lead. Currently `next_action` is a human-entered text field with a due date.

### Activity Feed (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Enrichment events | EXISTS: `enrich_events` table |
| Outreach events | PARTIAL: `outreach.created_at`, `sent_at` |
| Reply received events | PARTIAL: `replies.received_at` |
| Agent run history | MISSING: No `agent_runs` table; only inferred from max timestamps on records |

**Missing:** Unified activity log table. Currently activity is reconstructed from scattered timestamps.

### Goals / Growth Metrics (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Business goals text | EXISTS: `business_context.goals` |
| Historical conversion rates | EXISTS: computed in `analytics.js` from `leads` and `outreach` |
| Daily/weekly trends | EXISTS: `getLeadsTrend()`, `getGrowthStats()` |
| Sector performance | EXISTS: `analytics_snapshots.insights.sectors` |
| Channel performance | EXISTS: `analytics_snapshots.insights.channels` |

**Missing:** Goal progress tracking (target vs. actual numbers); weekly summary email.

### AI Recommendations (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Recommendations per lead | EXISTS via `recommended_services`, `problems`, `score_reason`, `icp_reasoning` |
| Recommendations for the business overall | PARTIAL: `analytics_snapshots.summary` is a single text |

**Missing:** Structured recommendations table; actionable AI suggestions with accept/dismiss state.

### Notifications (Target Concept)
| Field needed | DB status |
|-------------|-----------|
| Telegram notifications | EXISTS: `telegram_messages` table; `telegramNotify.js` |
| Web notifications | MISSING: No `notifications` table; no web push |

---

## J. Prompt / AI Configuration Audit

| Prompt File | Agent(s) Using It | How Loaded | UI Editable? | Persist Edits |
|-------------|------------------|------------|-------------|---------------|
| `prompts/qualify.md` | `qualifier.js` | `readFile` at runtime | Yes — `/prompts` page | Filesystem write via `/api/prompts` POST |
| `prompts/icpScore.md` | `icpScorer.js` | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |
| `prompts/dmEnrich.md` | `dmEnrich.js` | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |
| `prompts/outreach.md` | `outreach.js` (email channel) | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |
| `prompts/outreach-whatsapp.md` | `outreach.js` (WhatsApp channel) | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |
| `prompts/followup-whatsapp.md` | `sequencer.js` (WhatsApp follow-ups) | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |
| `prompts/proposal.md` | `proposal.js` | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |
| `prompts/classify-reply.md` | `replyWatcher.js` | `readFile` at runtime | Yes — `/prompts` page | Filesystem write |

**Note on the email follow-up prompt:** The email follow-up prompt in `sequencer.js` is **not** a file — it is a hardcoded template string defined inline in `agents/sequencer.js` lines 33–55. It is therefore NOT editable via the `/prompts` UI. This is a hidden configuration gap.

**Security note:** `/api/prompts` POST route accepts arbitrary file content and writes it directly to the filesystem. There is no content validation, character limit, or sanitization. Any authenticated user can edit any of the 8 prompt files to inject arbitrary instructions into the AI pipeline.

**Improvement opportunity:** Move prompt content to the `knowledge_items` DB table (with versioning, approval workflow, rollback) rather than the filesystem.

---

## K. Mobile UX Audit

### K1. Sidebar Blocks All Mobile Access
`web/src/components/sidebar.tsx` line 71–72:
```
className="h-screen fixed left-0 top-0 z-50 flex flex-col transition-all duration-300"
style={{ width: collapsed ? "68px" : "240px", ... }}
```
No `@media (max-width: 768px)` equivalent. The sidebar is always visible and always takes 68–240px. On a 375px mobile screen, main content is only 107–307px wide. No hamburger menu or overlay pattern exists.

### K2. Inline Style Overrides Kill Responsive Layout
`web/src/components/app-shell.tsx` line 17:
```
style={{ marginLeft: "240px", transition: "margin-left 0.3s" }}
```
This `style={}` prop takes precedence over Tailwind responsive utilities like `md:ml-60`. Even if a developer adds a responsive class, the inline style wins.

The `<style>` tag injected by the sidebar (`main { margin-left: ${collapsed ? "68px" : "240px"} !important; }`) uses `!important`, making it impossible for any external CSS to override.

### K3. Tables Are Not Mobile-Safe
`web/src/app/dashboard/page.tsx` line 302: `<div className="overflow-x-auto">` wraps the leads table, but on a 375px-wide screen with a 240px sidebar, only 135px remains for the scrollable area. The table has 5 columns.

### K4. KPI Grid Collapses Only to 2 Columns, Not 1
`web/src/app/dashboard/page.tsx` line 179: `className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"` — on mobile, 2 columns renders, but each column is only ~60px wide (after sidebar occupies 240px of 375px total). Text and numbers overflow.

### K5. No Mobile Navigation Alternative
The collapsed sidebar (68px icon-only mode) is controlled by a collapse button visible only on desktop. There is no swipe-to-open or tap-outside-to-close pattern for mobile.

---

## L. Reuse vs Refactor vs Hide vs Remove

| Feature | Current Location | Decision | Reason |
|---------|-----------------|----------|--------|
| KPI metrics (leadsTotal, qualified, contacted, replied) | `/dashboard` | KEEP → **Home** | Core business value; move to default landing |
| Trend chart (30-day leads/qualified) | `/dashboard` | KEEP → **Home** | Good visualization; keep on home |
| Funnel donut | `/dashboard` | KEEP → **Home** | Clear pipeline view |
| Sector breakdown | `/dashboard` | MOVE → **Growth** | Analytics data; better in Growth section |
| AI Orchestrator canvas | `/agents` | MOVE → **AI Copilot** | Valuable for advanced users; not for default landing |
| Agent run buttons (Scout, Analytics, Pipeline) | `/agents` | KEEP → **AI Copilot** | Critical trigger interface |
| KPI/growth stats on `/agents` | `/agents` | MERGE into **Home** | Duplicate of dashboard data |
| Lead discovery table | `/lead-discovery` | REFACTOR → **Opportunities** | Good functionality; needs UX rename |
| RunScoutModal | `/agents`, `/lead-discovery` | KEEP → **AI Copilot** | Move to copilot, accessible from Opportunities too |
| Lead detail page | `/leads/[id]` | REFACTOR → `/opportunities/[id]` | URL rename + CRM panel improvements |
| EnrichLiveFeed | `/leads/[id]` | KEEP | Good live UX |
| Qualified leads filter | `/qualified-leads` | MERGE → **Opportunities** (filter) | Separate page is unnecessary; one unified view |
| Outreach table | `/outreach` | REFACTOR → **Conversations** | Thread-centric view per lead is better |
| OutreachModal (approve/edit/send) | `/outreach` | KEEP | Core approval workflow |
| Follow-ups table | `/follow-ups` | MERGE → **Conversations** | Surface follow-ups in the conversation thread, not a separate page |
| Proposals table | `/proposals` | REFACTOR → **Deals** | Rename + add deal stage context |
| Analytics page | `/analytics` | REFACTOR → **Growth** | Rename, keep content |
| Knowledge base | `/knowledge-base/*` | MOVE TO ADMIN → AI Autopilot | Not a daily-use customer feature |
| System prompts editor | `/prompts` | MOVE TO ADMIN → AI Autopilot | Developer/admin feature; dangerous if misused |
| Business context form | `/business-context` | MOVE → **Settings** (Agency Profile tab) | Configuration, not workflow |
| API spend dashboard | `/costs` | MOVE → **Settings** (API Usage tab) | Infrastructure concern |
| Settings form (pipeline config) | `/settings` | SPLIT → Settings (user-facing) + AI Autopilot (automation) | Mix of user and developer concerns |
| Telegram link card | `/settings` | KEEP → **Settings** (Notifications tab) | User-facing feature |
| CommandShell component | `components/command-shell.tsx` | REMOVE | Unused, has non-functional elements |
| Tutorial page | `/tutorial` | KEEP | Onboarding value |
| Help page | `/help` | KEEP | Support value |

---

## M. Batch 2 Implementation Plan

Based on actual code findings, Batch 2 should implement the following in order of user impact:

### M1. Fix Default Landing (Critical)
- Change `web/src/app/page.tsx` to redirect to `/home` instead of `/agents`
- Create `web/src/app/home/page.tsx` that renders the KPI content from `/dashboard` + today's due actions prominently + AI analytics summary text

### M2. Refactor Sidebar Navigation
- Replace the 4-group, 13-item sidebar in `web/src/components/sidebar.tsx` with the 8-item target architecture: Home, Opportunities, Conversations, Deals, Growth, AI Copilot, AI Autopilot, Settings
- Remove "System Prompts," "API Spend," "Business Context" from primary navigation
- Implement pathname-based active detection (already works in current sidebar — keep this logic)

### M3. Create Opportunities Route
- Create `web/src/app/opportunities/page.tsx` (unified lead view replacing `/lead-discovery` + `/qualified-leads`)
- Add pipeline stage filter tabs: All, New, Contacted, Qualified, Proposal Sent, Negotiating, Won, Lost
- Use existing `getLeads()` and `getQualifiedLeadsFiltered()` queries
- Redirect `/lead-discovery` → `/opportunities`, `/qualified-leads` → `/opportunities?stage=qualified`
- Rename `/leads/[id]` → `/opportunities/[id]` (or keep route, change display copy)

### M4. Create Conversations Route
- Create `web/src/app/conversations/page.tsx` (unified outreach + replies + follow-ups)
- Group by lead, showing thread preview per conversation
- Use existing `getOutreach()`, `getFollowUps()`, and `getLeadThread()` functions
- Surface pending approvals prominently (drafts awaiting action)
- Redirect `/outreach` → `/conversations`, `/follow-ups` → `/conversations`

### M5. Create Deals Route
- Create `web/src/app/deals/page.tsx` showing pipeline-stage board or table
- Use existing `getProposals()` query, add `leads.pipeline_stage` filtering
- Redirect `/proposals` → `/deals`

### M6. Rename Growth Route
- Rename `/analytics` → `/growth`
- Add redirect for backward compatibility

### M7. Restructure Settings
- Create Settings with tabs: Agency Profile (currently `/business-context`), Automation (pipeline settings from `/settings`), Notifications (Telegram), API Usage (currently `/costs`), API Keys
- Move content from `/business-context`, `/costs` into `/settings` tabs

### M8. Create AI Autopilot Section
- Create `/autopilot` with tabs: Knowledge Base (`/knowledge-base`), Prompts (`/prompts`), Automation Schedule
- Move knowledge-base and prompts routes under `/autopilot`
- Add a warning banner on the Prompts tab: "Editing prompts changes AI behavior immediately. Changes are not versioned."

### M9. Create AI Copilot Route
- Rename `/agents` → `/copilot`
- Keep orchestration canvas, agent run buttons, activity log
- Remove duplicate KPI metrics that now live on Home

### M10. Add Web Notifications
- Add a `notifications` table or use existing `replies` + `outreach` query to surface pending approvals
- Wire the existing `NotificationsDropdown` component (currently imported only in `CommandShell`, not in `AppShell`) into `AppShell`'s header
- Show: new replies received, drafts pending approval, overdue next actions

### M11. Mobile Sidebar
- Remove `!important` from sidebar's injected `<style>` tag
- Add a mobile overlay pattern: sidebar hidden by default on `< 768px`, opened by hamburger button in header
- Replace inline `style={{ marginLeft: "240px" }}` in `AppShell` with a CSS class that can be overridden responsively

### M12. Remove Dead Code
- Delete `web/src/components/command-shell.tsx` (unused, has non-functional search and "Deploy New Agent" button)
- Remove stale `active: true` hardcoded in `CommandShell`'s NAV array

### M13. Fix Email Follow-up Prompt Visibility
- Move the hardcoded email follow-up prompt from `agents/sequencer.js` lines 33–55 into `prompts/followup-email.md`
- Register it in the `/prompts` page's `PROMPTS` array so it is editable alongside the other 8 prompts

---

*End of Batch 1 Audit — D:\tedmark-growth-engine\docs\UX-TRANSFORMATION-AUDIT.md*
