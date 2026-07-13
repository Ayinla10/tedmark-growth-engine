import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

function getConfig() {
  const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD } = process.env;
  if (!IMAP_HOST || !IMAP_USER || !IMAP_PASSWORD) {
    throw new Error('IMAP_HOST, IMAP_USER, and IMAP_PASSWORD must be set in .env to check replies.');
  }
  return {
    host: IMAP_HOST,
    port: Number(IMAP_PORT) || 993,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASSWORD },
    logger: false,
    disableCompression: true,
  };
}

// Fetches every unseen message in INBOX, parses it, and marks all of them
// \Seen once the fetch stream has fully closed — so a crash/restart never
// reprocesses the same message twice. Flagging is done in one batched call
// after the loop (not interleaved with it) because issuing a STORE command
// while a FETCH response is still streaming hangs some IMAP servers.
export async function fetchUnseenMessages() {
  const client = new ImapFlow(getConfig());
  const messages = [];
  const uids = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        const parsed = await simpleParser(msg.source);
        messages.push({
          uid: msg.uid,
          messageId: parsed.messageId ?? `uid-${msg.uid}-${Date.now()}`,
          from: parsed.from?.text ?? '',
          subject: parsed.subject ?? '',
          text: parsed.text ?? '',
          date: parsed.date ?? new Date(),
        });
        uids.push(msg.uid);
      }

      if (uids.length > 0) {
        await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}
