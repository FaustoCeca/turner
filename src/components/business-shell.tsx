import { Globe, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth";
import { FacebookIcon, InstagramIcon } from "@/components/brand-icons";
import { SiteFooter, type SocialLink } from "@/components/site-footer";
import type { SessionUser } from "@/lib/auth";
import type { PublicBusiness } from "@/lib/public";
import { whatsappLink } from "@/lib/whatsapp";

export function brandStyle(b: Pick<PublicBusiness, "primaryColor" | "secondaryColor" | "backgroundColor">): CSSProperties {
  return {
    "--brand": b.primaryColor.trim(),
    "--brand-dark": b.secondaryColor.trim(),
    "--brand-bg": b.backgroundColor.trim(),
  } as CSSProperties;
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export function whatsappUrl(phone: string, text?: string): string {
  return whatsappLink(phone, text) ?? `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function BusinessShell({
  business,
  user,
  subtitle = "Nuevo turno",
  children,
}: {
  business: PublicBusiness;
  user: SessionUser | null;
  subtitle?: string;
  children: ReactNode;
}) {
  const socials = [
    business.instagram && { href: normalizeUrl(business.instagram), label: "Instagram", icon: InstagramIcon },
    business.facebook && { href: normalizeUrl(business.facebook), label: "Facebook", icon: FacebookIcon },
    business.whatsapp && { href: whatsappUrl(business.whatsapp), label: "WhatsApp", icon: MessageCircle },
    business.website && { href: normalizeUrl(business.website), label: "Sitio web", icon: Globe },
  ].filter(Boolean) as SocialLink[];

  return (
    <div style={brandStyle(business)} className="flex min-h-dvh flex-col bg-brand-bg">
      <header className="bg-brand-dark">
        <div className="mx-auto flex h-[70px] max-w-4xl items-center justify-between gap-3 px-4">
          <Link href={`/${business.slug}`} className="flex min-w-0 items-center gap-4">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={business.logoUrl} alt="" className="size-12 shrink-0 rounded-full bg-black object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">
                {business.name.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-2xl font-bold leading-tight text-white">{business.name}</span>
              <span className="block text-[13px] font-medium uppercase text-[#ffe600]">{subtitle}</span>
            </span>
          </Link>
          {user ? (
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
                <UserRound className="size-4" />
                <span className="hidden sm:inline">{user.firstName}</span>
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-lg bg-white text-sm shadow-lg ring-1 ring-black/5">
                <Link href="/mis-turnos" className="block px-4 py-2.5 hover:bg-neutral-50">
                  Mis turnos
                </Link>
                <form action={logoutAction}>
                  <input type="hidden" name="next" value={`/${business.slug}`} />
                  <button className="block w-full px-4 py-2.5 text-left hover:bg-neutral-50">Cerrar sesión</button>
                </form>
              </div>
            </details>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/${business.slug}`)}`}
              className="shrink-0 rounded-lg bg-brand px-5 py-2.5 text-[15px] font-medium text-white hover:brightness-110"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter socials={socials} />
    </div>
  );
}
