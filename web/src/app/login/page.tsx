import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

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
          <h2 className="text-lg font-semibold text-slate-100 mb-1">Sign in</h2>
          <p className="text-sm text-slate-400 mb-6">Sales intelligence hub — authorized access only.</p>
          <LoginForm next={next ?? "/home"} />
        </div>
      </div>
    </div>
  );
}
