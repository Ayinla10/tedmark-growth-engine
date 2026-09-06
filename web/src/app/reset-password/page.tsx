"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "@/lib/password-reset";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setPending(true);
    setError("");
    const result = await resetPassword(token, password);
    if (result.ok) {
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
    setPending(false);
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-400 mb-4">Invalid reset link.</p>
        <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300">Request a new one</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-3xl mb-4">✅</div>
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Password updated</h2>
        <p className="text-sm text-slate-400">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-semibold text-slate-100 mb-1">Set new password</h2>
      <p className="text-sm text-slate-400 mb-6">Choose a strong password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">New password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#070b16] border border-slate-700/50 rounded-lg px-3 py-2 pr-9 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Confirm password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full bg-[#070b16] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
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
          <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
