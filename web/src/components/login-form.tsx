"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/auth-actions";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="text-xs text-slate-400 block mb-1.5">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="w-full bg-[#070b16] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          placeholder="you@tedmark.agency"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-xs text-slate-400 block mb-1.5">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full bg-[#070b16] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          placeholder="••••••••"
        />
      </div>
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-emerald-500/15 border border-emerald-500/50 text-emerald-400 rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
