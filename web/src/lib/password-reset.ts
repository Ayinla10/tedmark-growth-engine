"use server";

import crypto from "crypto";
import pool from "./db";
import { findUserByEmail } from "./auth";
import bcrypt from "bcryptjs";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Tedmark AI <noreply@tedmarkdigital.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const TOKEN_TTL_MINUTES = 30;

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  const user = await findUserByEmail(email);
  // Always return ok to avoid user enumeration
  if (!user) return { ok: true };

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET token = $2, expires_at = $3, used = false`,
    [user.id, token, expiresAt]
  );

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: email,
      subject: "Reset your Tedmark AI password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#10b981;margin-bottom:8px">Reset your password</h2>
          <p style="color:#64748b;margin-bottom:24px">
            Click the button below to reset your password. This link expires in ${TOKEN_TTL_MINUTES} minutes.
          </p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">
            If you didn't request this, ignore this email. Your password won't change.
          </p>
        </div>
      `,
    }),
  });

  return { ok: true };
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (!token || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const res = await pool.query(
    `SELECT user_id, expires_at, used FROM password_reset_tokens WHERE token = $1`,
    [token]
  );
  const row = res.rows[0];

  if (!row) return { ok: false, error: "Invalid or expired reset link." };
  if (row.used) return { ok: false, error: "This reset link has already been used." };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: "This reset link has expired. Request a new one." };

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, row.user_id]);
  await pool.query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [token]);

  return { ok: true };
}
