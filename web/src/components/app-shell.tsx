import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getSession();

  return (
    <div className="bg-app-bg text-ink min-h-screen">
      <Sidebar />
      <Header user={user} />
      <main className="ml-64 pt-16">{children}</main>
    </div>
  );
}
