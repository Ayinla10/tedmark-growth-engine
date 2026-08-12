import { Resend } from 'resend';
import dotenv from 'dotenv';
import { recordApiUsage } from './db.js';

dotenv.config();

const DEFAULT_FROM = process.env.EMAIL_FROM || 'Ayinla at Tedmark <onboarding@resend.dev>';
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

let resend = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is missing from .env — cannot send email.');
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail({ to, from = DEFAULT_FROM, replyTo = DEFAULT_REPLY_TO, subject, text, attachments }) {
  const client = getClient();
  const result = await client.emails.send({ to, from, replyTo, subject, text, attachments });

  if (result.error) {
    throw new Error(`Resend rejected the email: ${result.error.message}`);
  }

  await recordApiUsage('resend', 'send_email', 'requests', 1).catch((err) => {
    console.warn(`[emailSender] Could not record API usage: ${err.message}`);
  });

  return result.data;
}
