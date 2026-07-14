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
      <main className="ml-64 pt-16">{children}</main>
    </div>
  );
}
