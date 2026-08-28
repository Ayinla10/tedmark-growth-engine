import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Header } from "./header";
import { IdleLogout } from "./idle-logout";
import { Sidebar } from "./sidebar";

export async function AppShell({ children }: { children: ReactNode }) {
  const [user, settings] = await Promise.all([getSession(), getSettings()]);

  return (
    <div className="bg-app-bg text-ink min-h-screen">
      <IdleLogout timeoutMinutes={settings.idle_logout_minutes} />
      <Sidebar />
      <Header user={user} />
      {/*
        margin-left and header left are controlled by the Sidebar's injected <style> block.
        On desktop (≥768px): margin-left = sidebar width.
        On mobile (<768px): margin-left = 0 (sidebar is a drawer overlay).
        The pt-14 accounts for the fixed header height.
      */}
      <main className="pt-14 min-w-0 md:ml-[240px]">
        {children}
      </main>
    </div>
  );
}
