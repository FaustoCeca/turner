import { NextResponse } from "next/server";
import { latestNotifications, unreadCount } from "@/lib/notifications";
import { businessForAction } from "@/lib/panel";

/** Lo consulta el panel cada minuto para mostrar la campanita y avisos del navegador. */
export async function GET() {
  let business;
  try {
    ({ business } = await businessForAction());
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [unread, latest] = await Promise.all([unreadCount(business.id), latestNotifications(business.id, 1)]);
  return NextResponse.json(
    { unread, latest: latest[0] ? { id: latest[0].id, title: latest[0].title, body: latest[0].body } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
