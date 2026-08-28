import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PORT = process.env.WEBHOOK_PORT || 4000;

// ── GET /webhook — Facebook verification handshake ────────────────────────────
// Meta sends this once when you click "Verify and save" in the dashboard.
// It passes hub.verify_token (must match yours) and hub.challenge (echo it back).
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[webhook] ✅ Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook] ❌ Verification failed — token mismatch');
  return res.sendStatus(403);
});

// ── POST /webhook — Incoming WhatsApp messages ────────────────────────────────
// Meta sends every incoming message here. We log it and respond 200 immediately
// (Meta retries if it doesn't get 200 within 5 seconds).
app.post('/webhook', (req, res) => {
  const body = req.body;

  // Quick guard — only handle whatsapp_business_account events
  if (body.object !== 'whatsapp_business_account') {
    return res.sendStatus(404);
  }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // ── Incoming messages ──────────────────────────────────────────────
        for (const msg of value.messages ?? []) {
          const from    = msg.from;          // sender's WhatsApp number (E.164)
          const msgId   = msg.id;
          const type    = msg.type;          // text | image | audio | document …

          let text = null;
          if (type === 'text') text = msg.text?.body;

          console.log(`[webhook] 📩 Message from ${from}: ${text ?? `[${type}]`}`);

          // TODO: pass to agent or save to DB here
          // Example: await handleIncomingWhatsApp({ from, text, type, msgId });
        }

        // ── Status updates (sent / delivered / read / failed) ─────────────
        for (const status of value.statuses ?? []) {
          console.log(`[webhook] 📋 Status update: ${status.status} for message ${status.id} to ${status.recipient_id}`);
        }
      }
    }
  } catch (err) {
    console.error('[webhook] Error processing payload:', err);
  }

  // Always respond 200 immediately — Meta needs this within 5 seconds
  return res.sendStatus(200);
});

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, service: 'whatsapp-webhook' }));

app.listen(PORT, () => {
  console.log(`[webhook] WhatsApp webhook server running on port ${PORT}`);
  console.log(`[webhook] Callback URL: https://YOUR_DOMAIN/webhook`);
  console.log(`[webhook] Verify token: ${VERIFY_TOKEN}`);
});
