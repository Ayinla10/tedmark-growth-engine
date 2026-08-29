export type HelpEntry = {
  id: string;
  category: string;
  title: string;
  body: string;
};

export const helpContent: HelpEntry[] = [
  {
    id: "theme-toggle",
    category: "Top bar",
    title: "Sun/moon icon (theme toggle)",
    body: "How: click it. Why: switches the whole dashboard between light and dark mode. It remembers your choice next time you open it.",
  },
  {
    id: "notifications",
    category: "Top bar",
    title: "Bell icon (notifications)",
    body: "How: click it to open a list. Why: shows a running log of what the agents have actually done — new businesses found, scores given, drafts written, emails sent, follow-ups scheduled, proposals made. It's a read-only history, not something you approve from.",
  },
  {
    id: "messages",
    category: "Top bar",
    title: "Chat bubble icon (messages)",
    body: "Honest answer: this one isn't wired up to anything yet. Clicking it does nothing right now — it's left over from the original design.",
  },
  {
    id: "deploy-agent",
    category: "Sidebar",
    title: "\"Deploy new agent\" button",
    body: "Honest answer: not wired up yet. Doesn't do anything if you click it.",
  },
  {
    id: "log-out",
    category: "Sidebar",
    title: "\"Log out\" link",
    body: "How: click it. Why: ends your session and takes you back to the login screen. Your data stays — nothing is deleted.",
  },
  {
    id: "run-scout",
    category: "Lead Discovery",
    title: "\"Run scout\" button",
    body: "How: click it, choose a business type (restaurant, school, clinic...), type a city, pick how many to find, then click Start scan. Why: it goes out and searches a real maps service (Geoapify) for actual businesses matching that, and saves each one to your list. It takes a few seconds because it's a real internet search, not instant.",
  },
  {
    id: "qualify-icon",
    category: "Lead Discovery",
    title: "Shield icon on a business row (qualify this one)",
    body: "How: only appears on a business that hasn't been scored yet. Click it to score just that one. Why: it sends that business's details to the AI, which rates 1-10 how much they need your services and explains why. Once it's scored, this icon disappears from that row — go to the Qualified Leads page if you want to re-score it later.",
  },
  {
    id: "enrich-icon",
    category: "Lead Discovery",
    title: "Wrench icon (enrich)",
    body: "How: click it on any row. Why: tries to dig up a missing email address or fix a phone number by checking the business's website, and turns a Ghanaian mobile number into a clickable WhatsApp link. It doesn't always find something — some small businesses genuinely have nothing online to find.",
  },
  {
    id: "map-pin",
    category: "Lead Discovery",
    title: "Map pin icon",
    body: "How: click it. Why: opens Google Maps in a new tab so you can see the actual place and check it's real. No setup, no cost — it's just a link.",
  },
  {
    id: "archive-icon",
    category: "Lead Discovery",
    title: "Archive icon (trash/box)",
    body: "How: click it, then confirm you mean it. Why: marks that business as \"not pursuing\" — nothing gets deleted, it just disappears from your active lists so it stops cluttering the view.",
  },
  {
    id: "qualify-batch",
    category: "Qualified Leads",
    title: "\"Qualify N raw leads\" button",
    body: "How: only shows up when there are businesses still waiting to be scored. Click to score all of them at once. Why: saves you clicking the shield icon one at a time. If you don't see this button at all, it means every business you've found has already been scored — there's nothing left to do.",
  },
  {
    id: "scoring-protocol",
    category: "Qualified Leads",
    title: "\"Scoring protocol\" box",
    body: "Not a button — it's there so a score isn't a mystery. It explains the actual rule the AI follows: no website at all usually means high priority (they need you most), a modern well-built site means low priority (they're probably fine).",
  },
  {
    id: "generate-outreach-icon",
    category: "Qualified Leads",
    title: "Mail icon (generate outreach)",
    body: "How: click it on a business that scored 6 or higher. Why: has the AI write a personalized cold email for that specific business, mentioning the exact gap it found (like \"no website\").",
  },
  {
    id: "generate-drafts-batch",
    category: "Outreach Drafts",
    title: "\"Generate drafts\" button",
    body: "How: click it. Why: does the same thing as the mail icon, but for every qualified business at once that doesn't already have a draft written.",
  },
  {
    id: "preview-outreach",
    category: "Outreach Drafts",
    title: "\"Preview\" button",
    body: "How: click it to open the full email in a pop-up. Why: the table only shows a short snippet of the message — Preview is where you read the whole thing. Edit, Approve, and Send all live inside this pop-up, not in the table itself.",
  },
  {
    id: "edit-outreach",
    category: "Outreach Drafts",
    title: "\"Edit\" (inside the preview pop-up)",
    body: "How: click Edit, change the wording, click Save. Why: the AI's draft is a starting point, not final — rewrite anything you want before it goes anywhere. You can't edit it anymore once it's actually been sent.",
  },
  {
    id: "approve-outreach",
    category: "Outreach Drafts",
    title: "\"Approve\" (inside the preview pop-up)",
    body: "How: only appears while the email is still a draft. Click it. Why: marks it as reviewed and ready to go out. It does not send anything by itself — sending is a separate step after this.",
  },
  {
    id: "send-outreach",
    category: "Outreach Drafts",
    title: "\"Send\" (inside the preview pop-up, email drafts)",
    body: "How: only appears after you've approved an email draft. Type in the recipient's email, click Send. Why: actually emails it for real through Resend. The email arrives in their inbox from the Tedmark address — and if they reply, it shows up automatically in Conversations.",
  },
  {
    id: "send-whatsapp",
    category: "Outreach Drafts",
    title: "\"Send via WhatsApp\" (inside the preview pop-up, WhatsApp drafts)",
    body: "How: appears after you approve a draft marked \"WhatsApp\" (these are written for businesses that only have a phone number, no email). Click it. Why: opens a WhatsApp chat in a new tab with the message already typed in — you still have to press send inside WhatsApp yourself, since there's no way to do that automatically for free. Clicking this button also marks it as sent on this side, on the assumption you're about to actually send it.",
  },
  {
    id: "email-vs-whatsapp-channel",
    category: "Outreach Drafts",
    title: "Why some drafts say \"Email\" and others say \"WhatsApp\"",
    body: "Not a button — just how the system decides. If a business has an email on file, it writes a proper email. If it only has a mobile phone number, it writes a shorter WhatsApp-style message instead, since that's the only way to reach them and cold WhatsApp actually works better in Ghana than cold email. Landline numbers don't get a draft at all since they can't receive WhatsApp.",
  },
  {
    id: "run-sequencer",
    category: "Follow-ups",
    title: "\"Run sequencer now\" button",
    body: "How: click it (on the Follow-ups page or the AI Agents page). Why: checks every sent email that's gone unanswered for 3+ days, writes a softer follow-up message, and repeats up to two more times. If there's still no reply after the third message, it automatically marks that lead as archived so it stops taking up your attention.",
  },
  {
    id: "new-proposal",
    category: "Proposals",
    title: "\"New proposal\" button",
    body: "How: click it, pick a business, tick which services you'd sell them (website, SEO, ads, automation, chatbot), pick a rough budget level, click Generate. Why: has the AI write a full pitch document — what you'd do for them, a timeline, pricing in cedis, and a clear next step.",
  },
  {
    id: "proposal-preview-edit-copy",
    category: "Proposals",
    title: "\"Preview\", \"Edit\", and \"Copy\" on a proposal",
    body: "How: Preview opens the full document, nicely formatted. Edit switches to plain text so you can rewrite it. Copy puts the whole thing on your clipboard to paste into an email or document. Why: the AI's version is a strong first draft, not something you're stuck with — polish it before it goes to a real client.",
  },
  {
    id: "lead-detail-google-links",
    category: "Lead detail page",
    title: "\"View on Google Maps\" / \"Search on Google\"",
    body: "How: click either link. Why: quick shortcuts to see the business on a map or search for it online — no setup, no cost, just plain links.",
  },
  {
    id: "log-reply",
    category: "Lead detail page",
    title: "Reply box at the bottom of the Conversation",
    body: "How: paste in whatever the business said back to you (copied from your email or WhatsApp), then click the arrow. Why: keeps a record of the real back-and-forth in one place. For a proper send-and-receive experience, use the Conversations page instead — it has a full compose box.",
  },
  {
    id: "conversations-page",
    category: "Conversations",
    title: "The Conversations page",
    body: "How: click Conversations in the sidebar. Why: this is the communication workspace — the question it answers is \"who is talking to me and what should I do?\" Every lead with any outreach activity appears here as a card, showing the business name, contact, state (needs approval / reply received / follow-up due / waiting), and a message preview. Click any card to open the thread.",
  },
  {
    id: "conversations-filters",
    category: "Conversations",
    title: "Filter tabs (All, Needs attention, Waiting, etc.)",
    body: "How: click any tab at the top of the list. Why: focuses the list on what matters right now. \"Needs attention\" shows anything with an unapproved draft or an unread reply — start here every day. \"Interested\", \"Questions\", and \"Objection\" filter by how the AI classified the lead's reply.",
  },
  {
    id: "conversations-thread",
    category: "Conversations",
    title: "The message thread (centre column)",
    body: "Shows every message in chronological order — outreach you sent (blue), replies they sent (white/green), AI drafts waiting for approval (dashed border), and follow-up events inline. WhatsApp messages appear with a green tint and show which number they came from; email messages show the address. Scroll up to see older messages; the compose box is always pinned at the bottom.",
  },
  {
    id: "conversations-send-reply",
    category: "Conversations",
    title: "\"Send reply\" tab (compose box)",
    body: "How: the compose box is at the bottom of every open thread. The Send reply tab is active by default when the lead has an email address. Type your message, adjust the subject if needed, and click the send arrow. Why: sends the email directly through Resend and logs it in the thread immediately — no copy-pasting required. If the lead has no email on file, this tab shows a warning and is disabled.",
  },
  {
    id: "conversations-log-inbound",
    category: "Conversations",
    title: "\"Log inbound\" tab (compose box)",
    body: "How: click the Log inbound tab in the compose box, paste what the lead said, click the arrow. Why: for replies that came through WhatsApp or your personal email rather than the system — this logs them so they appear in the thread alongside everything else. Replies that come to contact@tedmarkdigital.com appear automatically and don't need to be pasted.",
  },
  {
    id: "conversations-ai-panel",
    category: "Conversations",
    title: "AI interpretation panel (right column)",
    body: "Not a button — it's a read-only summary. Shows how the AI classified the lead's reply (Interested, Question, Not interested, etc.), what that means in plain English, and the recommended next action. On mobile it appears as a collapsible section below the thread.",
  },
  {
    id: "conversations-auto-replies",
    category: "Conversations",
    title: "Why replies appear automatically",
    body: "The system polls contact@tedmarkdigital.com every few minutes via IMAP. When a lead replies to an outreach email, it's matched by sender address, AI-classified, logged to the thread, and a Telegram notification is sent. If the AI thinks a follow-up message is appropriate, it also creates a draft that appears in the thread awaiting your approval.",
  },
  {
    id: "draft-vs-sent-bubbles",
    category: "Lead detail page",
    title: "Dashed messages vs solid blue messages in the conversation",
    body: "Not a button — just what it means. A message with a dashed border and a \"DRAFT — NOT SENT YET\" label hasn't gone anywhere yet, it's just written and waiting. A solid blue message has actually been sent to the business.",
  },
  {
    id: "settings-page",
    category: "Settings",
    title: "The Settings page",
    body: "Not buttons — it just shows you which API keys (DeepSeek for AI, Geoapify for finding businesses, Resend for sending email, and the database) are already connected versus still missing, so you know what's ready to use.",
  },
];
