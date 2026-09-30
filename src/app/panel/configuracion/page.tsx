import type { Metadata } from "next";
import { PageHeader } from "@/components/panel-ui";
import { env } from "@/lib/env";
import { daysUntil, requireBusiness } from "@/lib/panel";
import { toPublicBusiness } from "@/lib/public";
import { SettingsForms } from "./settings-forms";

export const metadata: Metadata = { title: "Configuración" };

type Props = { searchParams: Promise<{ mp?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const { mp } = await searchParams;
  const { business, role } = await requireBusiness();
  return (
    <>
      <PageHeader title="Configuración" description="Datos del negocio, reglas de reserva, señas y cobros." />
      <SettingsForms
        isOwner={role === "owner"}
        appUrl={env.appUrl}
        mpStatus={mp ?? null}
        business={{
          ...toPublicBusiness(business),
          category: business.category,
          maxDaysInFuture: business.maxDaysInFuture,
          minAnticipationMinutes: business.minAnticipationMinutes,
          minAnticipationEditMinutes: business.minAnticipationEditMinutes,
          maxClientEdits: business.maxClientEdits,
          autoRefund: business.autoRefund,
          refundMinAnticipationMinutes: business.refundMinAnticipationMinutes,
          slotMinutes: business.slotMinutes,
          holdMinutes: business.holdMinutes,
          maxActiveBookingsPerClient: business.maxActiveBookingsPerClient,
          depositPercent: business.depositPercent,
          depositMinAmount: business.depositMinAmount,
          mpConnected: Boolean(business.mpAccessToken),
          mpUserId: business.mpUserId,
          mpLiveMode: business.mpLiveMode,
          mpOauth: env.mp.oauthEnabled,
          mpMock: env.mp.mockEnabled,
          trialDays: daysUntil(business.trialEndsAt),
          subscriptionStatus: business.subscriptionStatus,
        }}
      />
    </>
  );
}
