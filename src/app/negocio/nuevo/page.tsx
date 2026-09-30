import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Crear negocio" };

export default async function NewBusinessPage() {
  await requireUser("/negocio/nuevo");
  return (
    <AuthShell title="Datos de tu negocio" subtitle="En 1 minuto tenés tu página de reservas online. Todo se puede cambiar después.">
      <OnboardingForm appUrl={(process.env.APP_URL ?? "http://localhost:3000").replace(/^https?:\/\//, "")} />
    </AuthShell>
  );
}
