import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Iniciar sesión" };

type Props = { searchParams: Promise<{ next?: string }> };

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/mis-turnos";
}

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthShell title="Iniciar sesión" subtitle="Ingresá con tu email y contraseña.">
      <AuthForm next={next} />
    </AuthShell>
  );
}
