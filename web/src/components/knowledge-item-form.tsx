"use client";

import {
  BookOpen,
  Briefcase,
  Check,
  ClipboardList,
  FileStack,
  FileText,
  FileUp,
  HelpCircle,
  Layers,
  Search as SearchIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  cleanKnowledgeContentAction,
  createKnowledgeItemAction,
  updateKnowledgeItemAction,
} from "@/lib/actions";
import { AGENT_DESCRIPTIONS, AGENT_LABELS, CATEGORY_INFO, KNOWLEDGE_AGENTS, KNOWLEDGE_CATEGORIES } from "@/lib/knowledge-constants";
import { ResultBanner } from "./modal";

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  "Company Knowledge": Briefcase,
  "Services & Pricing": FileText,
  "Sales Playbook": ClipboardList,
  "Case Study": FileStack,
  "SEO Research": SearchIcon,
  "Content Library": Layers,
  FAQ: HelpCircle,
  "SOP / Workflow": BookOpen,
};

export type KnowledgeFormInitial = {
  title: string;
  category: string;
  content: string;
  applicable_agents: string[];
  target_audience: string | null;
  tags: string[];
  source: string | null;
  status: "draft" | "published";
};

export type ProposalOption = { id: string; business_name: string; content: string | null };

const EMPTY: KnowledgeFormInitial = {
  title: "",
  category: KNOWLEDGE_CATEGORIES[0],
  content: "",
  applicable_agents: [...KNOWLEDGE_AGENTS],
  target_audience: "All Businesses",
  tags: [],
  source: null,
  status: "published",
};

type Tab = "write" | "import" | "generate" | "improve";

export function KnowledgeItemForm({
  mode,
  itemId,
  initial,
  proposals = [],
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initial?: KnowledgeFormInitial;
  proposals?: ProposalOption[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const base = initial ?? EMPTY;
  const [title, setTitle] = useState(base.title);
  const [category, setCategory] = useState<string>(base.category);
  const [agents, setAgents] = useState<string[]>(base.applicable_agents);
  const [content, setContent] = useState(base.content);
  const [targetAudience, setTargetAudience] = useState(base.target_audience ?? "All Businesses");
  const [tags, setTags] = useState(base.tags.join(", "));
  const [source, setSource] = useState(base.source ?? "");
  const [pending, startTransition] = useTransition();
  const [cleaning, startCleaning] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; output: string } | null>(null);
  const [rawPaste, setRawPaste] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("write");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryInfo = CATEGORY_INFO[category as keyof typeof CATEGORY_INFO];

  function toggleAgent(agent: string) {
    setAgents((prev) => (prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]));
  }

  function handleTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "generate") {
      if (categoryInfo) setContent(categoryInfo.example);
      setActiveTab("write");
    } else if (tab === "import") {
      fileInputRef.current?.click();
      setActiveTab("write");
    }
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setContent(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  function startFromProposal(proposalId: string) {
    const p = proposals.find((x) => x.id === proposalId);
    if (p?.content) setContent(p.content);
  }

  function cleanUpWithAi() {
    const source = content.trim() || rawPaste.trim();
    if (!source) return;
    startCleaning(async () => {
      setResult(null);
      const r = await cleanKnowledgeContentAction(category, source);
      if (r.ok) {
        setContent(r.output);
        setRawPaste("");
        setActiveTab("write");
      }
      setResult(r);
    });
  }

  function save(status: "draft" | "published") {
    startTransition(async () => {
      setResult(null);
      const input = {
        title,
        category,
        content,
        applicableAgents: agents,
        targetAudience: targetAudience || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        source: source || null,
        status,
      };
      const r = mode === "create" ? await createKnowledgeItemAction(input) : await updateKnowledgeItemAction(itemId!, input);
      setResult(r);
      if (r.ok) onSaved?.();
    });
  }

  const checks = {
    title: title.trim().length > 0,
    category: Boolean(category),
    content: content.trim().length >= 20,
    agents: agents.length > 0,
  };
  const completeness = Math.round((Object.values(checks).filter(Boolean).length / 4) * 100);
  const ready = checks.title && checks.content;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Main column */}
      <div className="xl:col-span-2 space-y-6">
        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-5">
          <label className="text-xs font-medium text-slate-400 block mb-2">What are you teaching AI?</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Example: Website Design Service Packages"
            className="w-full bg-slate-100 text-slate-900 placeholder:text-slate-500 rounded-lg px-4 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-5">
          <p className="text-xs font-medium text-slate-400 mb-3">Category</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {KNOWLEDGE_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c];
              const selected = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`relative text-left rounded-xl border p-3 transition-colors ${
                    selected ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700/40 bg-[#070b16] hover:border-slate-600"
                  }`}
                >
                  {selected ? (
                    <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  ) : null}
                  <Icon size={16} className={selected ? "text-emerald-400" : "text-slate-500"} />
                  <p className={`text-xs font-medium mt-2 ${selected ? "text-emerald-300" : "text-slate-300"}`}>{c}</p>
                </button>
              );
            })}
          </div>
          {categoryInfo ? <p className="text-xs text-slate-500 mt-3">{categoryInfo.description}</p> : null}
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-5">
          <p className="text-xs font-medium text-slate-400 mb-3">Who should learn this knowledge?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {KNOWLEDGE_AGENTS.map((a) => {
              const on = agents.includes(a);
              return (
                <div key={a} className="flex items-center justify-between rounded-lg border border-slate-700/30 bg-[#070b16] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">{AGENT_LABELS[a]}</p>
                    <p className="text-xs text-slate-500 truncate">{AGENT_DESCRIPTIONS[a]}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggleAgent(a)}
                    className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${on ? "bg-emerald-500" : "bg-slate-700"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-medium text-slate-400">Knowledge Content</p>
            <div className="flex items-center gap-1.5 bg-[#070b16] rounded-lg p-1 border border-slate-700/30">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 ${activeTab === "write" ? "bg-slate-700/60 text-slate-100" : "text-slate-400 hover:text-slate-200"}`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => handleTab("import")}
                className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
              >
                <FileUp size={12} /> Import Document
              </button>
              <button
                type="button"
                onClick={() => handleTab("generate")}
                className="text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 text-slate-400 hover:text-slate-200"
              >
                Generate Example
              </button>
              <button
                type="button"
                onClick={() => setActiveTab((t) => (t === "improve" ? "write" : "improve"))}
                className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium ${
                  activeTab === "improve" ? "bg-emerald-500 text-black" : "text-emerald-400 hover:text-emerald-300"
                }`}
              >
                <Sparkles size={12} className="animate-pulse" /> Improve with AI
              </button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileImport} />

          {proposals.length > 0 ? (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) startFromProposal(e.target.value);
                e.target.value = "";
              }}
              className="text-xs bg-[#070b16] border border-slate-700/40 rounded px-2 py-1 text-slate-300 mb-2"
            >
              <option value="">Or start from an existing proposal…</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.business_name}
                </option>
              ))}
            </select>
          ) : null}

          {activeTab === "improve" ? (
            <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
              <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
                <Wand2 size={12} className="text-emerald-400" />
                {content.trim() ? "Cleans up the content already in the box below" : "Paste rough text below to have it cleaned into a proper entry"}
              </p>
              {!content.trim() ? (
                <textarea
                  value={rawPaste}
                  onChange={(e) => setRawPaste(e.target.value)}
                  placeholder="Paste raw text — a website page, a doc, meeting notes…"
                  rows={4}
                  className="w-full bg-[#070b16] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 mb-2"
                />
              ) : null}
              <button
                type="button"
                disabled={cleaning || (!content.trim() && !rawPaste.trim())}
                onClick={cleanUpWithAi}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:shadow-[0_0_12px_rgba(34,197,94,0.4)] disabled:opacity-50"
              >
                {cleaning ? "Cleaning up…" : "Clean up with AI"}
              </button>
            </div>
          ) : null}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your raw business knowledge, meeting notes, or service descriptions here…"
            rows={9}
            className="w-full bg-[#070b16] border border-slate-700/40 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-5">
          <p className="text-xs font-medium text-slate-400 mb-3">Metadata &amp; Discovery</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Target Audience</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="w-full bg-[#070b16] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-200"
              >
                <option>All Businesses</option>
                <option>Schools</option>
                <option>Clinics</option>
                <option>Retail</option>
                <option>Real Estate</option>
                <option>Logistics</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="website, pricing, ghana"
                className="w-full bg-[#070b16] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Source</label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Internal doc, website…"
                className="w-full bg-[#070b16] border border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>
          </div>
        </div>

        {result ? <ResultBanner ok={result.ok} output={result.output} /> : null}

        <div className="flex items-center justify-between rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] px-5 py-4">
          <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200">
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending || !ready}
              onClick={() => save("draft")}
              className="px-4 py-2 rounded-lg text-sm border border-slate-700/50 text-slate-200 hover:bg-slate-800/50 disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={pending || !ready}
              onClick={() => save("published")}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-500 text-black font-semibold hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save to AI Memory"}
            </button>
          </div>
        </div>
      </div>

      {/* Right rail — live preview, real data only */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-500/15 bg-[#0a0f1e] p-5 sticky top-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={15} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">Live Preview</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Reflects exactly what you&rsquo;ve entered — no AI guesswork.</p>

          <div className="rounded-xl bg-[#070b16] border border-slate-700/30 p-3 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-400">Completeness</p>
              <p className="text-xs font-semibold text-emerald-400">{completeness}%</p>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${completeness}%` }} />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckDot done={checks.title} />
              <span className={checks.title ? "text-slate-300" : "text-slate-500"}>Title {title ? `— "${title}"` : "not set"}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckDot done={checks.category} />
              <span className="text-slate-300">Category — {category}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckDot done={checks.content} />
              <span className={checks.content ? "text-slate-300" : "text-slate-500"}>
                Content — {wordCount} word{wordCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckDot done={checks.agents} />
              <span className={checks.agents ? "text-slate-300" : "text-slate-500"}>{agents.length} agent{agents.length === 1 ? "" : "s"} assigned</span>
            </div>
          </div>

          {agents.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-700/30">
              {agents.map((a) => (
                <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400">
                  {AGENT_LABELS[a]?.replace(" Agent", "")}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CheckDot({ done }: { done: boolean }) {
  return (
    <span
      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-emerald-500 text-black" : "bg-slate-700 text-transparent"}`}
    >
      <Check size={9} strokeWidth={3} />
    </span>
  );
}
