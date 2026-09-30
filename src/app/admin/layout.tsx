import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: { default: "Administración", template: "%s | Administración" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="bg-neutral-900 text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <nav className="flex items-center gap-1 text-sm">
            <span className="mr-3 font-bold">Administración</span>
            <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
              Negocios
            </Link>
            <Link href="/admin/usuarios" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
              Usuarios
            </Link>
          </nav>
          <span className="truncate text-xs text-white/60">{admin.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
