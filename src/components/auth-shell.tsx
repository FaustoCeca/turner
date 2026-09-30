import Link from "next/link";
import type { ReactNode } from "react";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg">
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
          <Link href="/" className="text-xl font-bold text-white">
            {appName}
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_4px_18px_rgba(93,93,239,0.15)]">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
