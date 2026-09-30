import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Crear cuenta" };

type Props = { searchParams: Promise<{ next?: string; negocio?: string }> };

// No redirige si ya hay sesión: al crear la cuenta la página se vuelve a renderizar
// y el formulario tiene que seguir en pantalla para mostrar el código de recuperación.
export default async function RegisterPage({ searchParams }: Props) {
  const sp = await searchParams;
  const forBusiness = sp.negocio !== undefined;
  const next =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : forBusiness ? "/negocio/nuevo" : "/mis-turnos";
  return (
    <AuthShell
      title={forBusiness ? "Probá gratis 14 días" : "Crear cuenta"}
      subtitle={forBusiness ? "Creá tu usuario y después cargamos los datos de tu negocio. Sin tarjeta." : undefined}
    >
      <AuthForm initialMode="register" next={next} />
    </AuthShell>
  );
}
