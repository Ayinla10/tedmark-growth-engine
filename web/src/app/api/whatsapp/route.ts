export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// ── GET — Meta webhook verification handshake ─────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[whatsapp] Webhook verified ✅");
    return new Response(challenge, { status: 200 });
  }

  console.warn("[whatsapp] Verification failed — token mismatch");
  return new Response("Forbidden", { status: 403 });
}

// ── POST — Incoming WhatsApp messages ─────────────────────────────────────────
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (body.object !== "whatsapp_business_account") {
    return new Response("Not Found", { status: 404 });
  }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;

        // Incoming messages
        for (const msg of value.messages ?? []) {
          const from = msg.from;       // sender's WhatsApp number in E.164 format
          const type = msg.type;       // text | image | audio | document | ...
          const text = type === "text" ? msg.text?.body : null;

          console.log(`[whatsapp] 📩 Message from ${from}: ${text ?? `[${type}]`}`);

          // TODO: match `from` to a lead in your DB and trigger reply logic
        }

        // Status updates (sent / delivered / read / failed)
        for (const status of value.statuses ?? []) {
          console.log(`[whatsapp] 📋 ${status.status} — msg ${status.id} to ${status.recipient_id}`);
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp] Error processing payload:", err);
  }

  // Must return 200 within 5s or Meta retries
  return new Response("OK", { status: 200 });
}
