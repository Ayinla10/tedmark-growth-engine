"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/password-reset";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await requestPasswordReset(email);
    setSent(true);
    setPending(false);
  }

  return (
    <div className="min-h-screen bg-[#04060d] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <svg width="28" height="28" viewBox="0 0 26 26" fill="none">
            <path d="M4 6l9-4 9 4-9 4-9-4z" fill="#22c55e" />
            <path d="M4 6v8l9 4v-8L4 6z" fill="#16a34a" />
            <path d="M22 6v8l-9 4v-8l9-4z" fill="#4ade80" />
          </svg>
          <h1 className="text-xl font-bold text-emerald-400">Tedmark AI</h1>
        </div>
        <div className="rounded-3xl border border-emerald-500/15 bg-[#0a0f1e] p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-3xl mb-4">📬</div>
              <h2 className="text-lg font-semibold text-slate-100 mb-2">Check your email</h2>
              <p className="text-sm text-slate-400 mb-6">
                If <span className="text-slate-200">{email}</span> is registered, you'll receive a reset link shortly. Check your spam folder too.
              </p>
              <Link href="/login" className="text-xs text-emerald-400 hover:text-emerald-300">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">Forgot password?</h2>
              <p className="text-sm text-slate-400 mb-6">Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="text-xs text-slate-400 block mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[#070b16] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="you@tedmarkdigital.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
                >
                  {pending ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="text-center mt-4">
                <Link href="/login" className="text-xs text-slate-500 hover:text-slate-400">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
