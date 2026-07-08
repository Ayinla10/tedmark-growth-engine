import type { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-app-bg text-ink min-h-screen">
      <Sidebar />
      <Header />
      <main className="ml-64 pt-16">{children}</main>
    </div>
  );
}
