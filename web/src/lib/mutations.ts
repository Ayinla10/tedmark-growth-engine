import pool from "./db";

export async function approveOutreachDb(outreachId: string) {
  const res = await pool.query(
    `UPDATE outreach SET status = 'approved' WHERE id = $1 AND status = 'draft' RETURNING *`,
    [outreachId]
  );
  return res.rows[0] ?? null;
}

export async function editOutreachDb(outreachId: string, subject: string, body: string) {
  const res = await pool.query(
    `UPDATE outreach SET subject = $1, body = $2 WHERE id = $3 AND status != 'sent' RETURNING *`,
    [subject, body, outreachId]
  );
  return res.rows[0] ?? null;
}

export async function editProposalDb(proposalId: string, content: string) {
  const res = await pool.query(
    `UPDATE proposals SET content = $1 WHERE id = $2 RETURNING *`,
    [content, proposalId]
  );
  return res.rows[0] ?? null;
}

export async function markWhatsappSentDb(outreachId: string) {
  const outreach = await pool.query(
    `SELECT * FROM outreach WHERE id = $1 AND status = 'approved' AND message_type = 'whatsapp'`,
    [outreachId]
  );

  const row = outreach.rows[0];
  if (!row) return null;

  const sent = await pool.query(
    `UPDATE outreach SET status = 'sent', sent_at = now() WHERE id = $1 RETURNING *`,
    [outreachId]
  );
  await pool.query(`UPDATE leads SET status = 'contacted' WHERE id = $1`, [row.lead_id]);
  await pool.query(
    `UPDATE follow_ups SET status = 'sent', sent_at = now() WHERE lead_id = $1 AND status = 'pending'`,
    [row.lead_id]
  );

  return sent.rows[0];
}

export async function updatePipelineDb(
  leadId: string,
  fields: { pipelineStage?: string; nextAction?: string | null; nextActionDue?: string | null }
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.pipelineStage !== undefined) {
    params.push(fields.pipelineStage);
    sets.push(`pipeline_stage = $${params.length}`);
  }
  if (fields.nextAction !== undefined) {
    params.push(fields.nextAction);
    sets.push(`next_action = $${params.length}`);
  }
  if (fields.nextActionDue !== undefined) {
    params.push(fields.nextActionDue);
    sets.push(`next_action_due = $${params.length}`);
  }
  if (sets.length === 0) return null;
  params.push(leadId);
  const res = await pool.query(
    `UPDATE leads SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

export async function generateTelegramLinkCodeDb(userId: string, agencyId: string | null): Promise<string> {
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await pool.query(
    `INSERT INTO telegram_link_codes (user_id, agency_id, code, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [userId, agencyId, code]
  );
  return code;
}

export async function updateTelegramNotificationLevelDb(userId: string, level: string) {
  await pool.query(`UPDATE telegram_links SET min_notification_level = $1 WHERE user_id = $2`, [level, userId]);
}

export async function unlinkTelegramDb(userId: string) {
  await pool.query(`UPDATE telegram_links SET active = false WHERE user_id = $1`, [userId]);
}

export async function archiveLeadDb(leadId: string) {
  const res = await pool.query(
    `UPDATE leads SET status = 'archived' WHERE id = $1 RETURNING *`,
    [leadId]
  );
  return res.rows[0] ?? null;
}

export async function logReplyDb(leadId: string, outreachId: string | null, body: string) {
  const res = await pool.query(
    `INSERT INTO replies (lead_id, outreach_id, body) VALUES ($1, $2, $3) RETURNING *`,
    [leadId, outreachId, body]
  );

  if (outreachId) {
    await pool.query(`UPDATE outreach SET replied = true WHERE id = $1`, [outreachId]);
  } else {
    await pool.query(
      `UPDATE outreach SET replied = true
       WHERE lead_id = $1 AND status = 'sent'
       ORDER BY sent_at DESC LIMIT 1`,
      [leadId]
    );
  }

  return res.rows[0];
}

export type KnowledgeItemInput = {
  title: string;
  category: string;
  content: string;
  applicableAgents: string[];
  targetAudience: string | null;
  tags: string[];
  source: string | null;
  status: "draft" | "published";
};

export async function insertKnowledgeItemDb(input: KnowledgeItemInput) {
  const res = await pool.query(
    `INSERT INTO knowledge_items
       (title, category, content, applicable_agents, target_audience, tags, source, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.title,
      input.category,
      input.content,
      input.applicableAgents,
      input.targetAudience,
      input.tags,
      input.source,
      input.status,
    ]
  );
  return res.rows[0];
}

export async function updateKnowledgeItemDb(id: string, input: KnowledgeItemInput) {
  const res = await pool.query(
    `UPDATE knowledge_items
     SET title = $1, category = $2, content = $3, applicable_agents = $4,
         target_audience = $5, tags = $6, source = $7, status = $8, updated_at = now()
     WHERE id = $9
     RETURNING *`,
    [
      input.title,
      input.category,
      input.content,
      input.applicableAgents,
      input.targetAudience,
      input.tags,
      input.source,
      input.status,
      id,
    ]
  );
  return res.rows[0] ?? null;
}

export async function deleteKnowledgeItemDb(id: string) {
  const res = await pool.query(`DELETE FROM knowledge_items WHERE id = $1 RETURNING id`, [id]);
  return res.rows[0] ?? null;
}

export async function insertSignatureDb(label: string, body: string, isDefault: boolean) {
  if (isDefault) {
    await pool.query(`UPDATE signatures SET is_default = false`);
  }
  const res = await pool.query(
    `INSERT INTO signatures (label, body, is_default) VALUES ($1, $2, $3) RETURNING *`,
    [label, body, isDefault]
  );
  return res.rows[0];
}

export async function updateSignatureDb(id: string, label: string, body: string) {
  const res = await pool.query(
    `UPDATE signatures SET label = $1, body = $2 WHERE id = $3 RETURNING *`,
    [label, body, id]
  );
  return res.rows[0] ?? null;
}

export async function setDefaultSignatureDb(id: string) {
  await pool.query(`UPDATE signatures SET is_default = false`);
  const res = await pool.query(`UPDATE signatures SET is_default = true WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] ?? null;
}

export async function deleteSignatureDb(id: string) {
  const res = await pool.query(`DELETE FROM signatures WHERE id = $1 RETURNING id`, [id]);
  return res.rows[0] ?? null;
}

export type ThreadItem = {
  id: string;
  kind: "sent" | "draft" | "reply";
  subject: string | null;
  body: string;
  at: string;
  classification: string | null;
};

export async function getLeadThread(leadId: string): Promise<ThreadItem[]> {
  const [outreach, replies] = await Promise.all([
    pool.query(
      `SELECT id, subject, body, sent_at, created_at, status
       FROM outreach WHERE lead_id = $1 ORDER BY created_at ASC`,
      [leadId]
    ),
    pool.query(
      `SELECT id, body, received_at, classification FROM replies WHERE lead_id = $1 ORDER BY received_at ASC`,
      [leadId]
    ),
  ]);

  const items: ThreadItem[] = [
    ...outreach.rows.map((r) => ({
      id: r.id,
      kind: (r.status === "sent" ? "sent" : "draft") as "sent" | "draft",
      subject: r.subject,
      body: r.body,
      at: r.sent_at ?? r.created_at,
      classification: null,
    })),
    ...replies.rows.map((r) => ({
      id: r.id,
      kind: "reply" as const,
      subject: null,
      body: r.body,
      at: r.received_at,
      classification: r.classification,
    })),
  ];

  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
