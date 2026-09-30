import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { images } from "@/db/schema";

/** Sirve logos y fotos. El id es único por imagen, así que se cachea para siempre. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const db = await getDb();
  const [image] = await db.select().from(images).where(eq(images.id, id)).limit(1);
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(image.data, "base64"), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
