import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import pool from "./db";

const SESSION_COOKIE = "tedmark_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — required to sign session cookies.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  // null only for role === 'super_admin' — every other role belongs to
  // exactly one agency (enforced by users_agency_required_unless_super_admin).
  agencyId: string | null;
};

export async function createSession(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email, name: user.name, role: user.role, agencyId: user.agencyId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.id !== "string" || typeof payload.email !== "string") return null;
    return {
      id: payload.id,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : "",
      role: typeof payload.role === "string" ? payload.role : "admin",
      agencyId: typeof payload.agencyId === "string" ? payload.agencyId : null,
    };
  } catch {
    return null;
  }
}

/** Server Components / Server Actions only — reads the session cookie. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;

export async function findUserByEmail(email: string) {
  const res = await pool.query(
    `SELECT id, email, password_hash, name, role, agency_id FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  );
  return res.rows[0] ?? null;
}
