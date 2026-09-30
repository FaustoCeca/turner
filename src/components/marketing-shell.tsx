import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser } from "@/lib/auth";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

export async function MarketingShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg">
      <header className="sticky top-0 z-20 bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="text-xl font-bold text-white">
            {appName}
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/precios" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:block">
              Precios
            </Link>
            {user ? (
              <Link href="/panel" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
                Ir a mi panel
              </Link>
            ) : (
              <>
                <Link href="/login?next=/panel" className="rounded-lg px-3 py-2 text-white/80 hover:text-white">
                  Iniciar sesión
                </Link>
                <Link href="/registro?negocio" className="rounded-lg bg-brand px-4 py-2 font-medium text-white">
                  Probá gratis
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
