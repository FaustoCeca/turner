import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, createOnlineBooking } from "@/lib/bookings";
import { rateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        professionalId: z.string().min(1),
        branchId: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        minutes: z.number().int().min(0).max(1440),
      }),
    )
    .min(1)
    .max(10),
  couponCode: z.string().max(40).nullish(),
  notes: z.string().max(500).nullish(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Iniciá sesión para reservar" }, { status: 401 });
  if (!rateLimit(`booking:${user.id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas reservas seguidas. Probá más tarde." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de la reserva inválidos" }, { status: 400 });

  try {
    const result = await createOnlineBooking({ slug, user, ...parsed.data });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("[booking] error inesperado", err);
    return NextResponse.json({ error: "No pudimos crear la reserva. Intentá nuevamente." }, { status: 500 });
  }
}
