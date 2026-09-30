import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageHeader } from "@/components/panel-ui";
import { getDb } from "@/db";
import { branches } from "@/db/schema";
import { requireBusiness } from "@/lib/panel";
import { BranchList } from "./branch-list";

export const metadata: Metadata = { title: "Sucursales" };

export default async function BranchesPage() {
  const { business } = await requireBusiness();
  const db = await getDb();
  const rows = await db
    .select()
    .from(branches)
    .where(eq(branches.businessId, business.id))
    .orderBy(asc(branches.order), asc(branches.createdAt));
  return (
    <>
      <PageHeader
        title="Sucursales"
        description="Los lugares donde atendés. Cada profesional tiene su propio horario en cada sucursal."
      />
      <BranchList branches={rows} />
    </>
  );
}
