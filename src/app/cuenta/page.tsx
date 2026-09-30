import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { isPlatformAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/auth";
import { AccountForms } from "./account-forms";
import { RecoveryCodeSection } from "./recovery-code-section";

export const metadata: Metadata = { title: "Mi cuenta" };

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

export default async function AccountPage() {
  const user = await requireUser("/cuenta");
  const admin = await isPlatformAdmin(user.id);
  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg">
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold text-white">
            {appName}
          </Link>
          <div className="flex gap-1 text-sm text-white">
            {admin && (
              <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
                Administración
              </Link>
            )}
            <Link href="/mis-turnos" className="rounded-lg px-3 py-1.5 hover:bg-white/10">
              Mis turnos
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">Mi cuenta</h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </div>
        <AccountForms user={{ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "" }} email={user.email} />
        <RecoveryCodeSection email={user.email} />
      </main>
      <SiteFooter />
    </div>
  );
}
