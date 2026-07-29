"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { clearSessionCookie, createSession, findUserByEmail, setSessionCookie } from "./auth";

export type LoginState = { error?: string };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/agents");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  const token = await createSession({ id: user.id, email: user.email, name: user.name, role: user.role, agencyId: user.agency_id ?? null });
  await setSessionCookie(token);
  redirect(next.startsWith("/") ? next : "/agents");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
