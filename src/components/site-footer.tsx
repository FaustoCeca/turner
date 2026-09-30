import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

export type SocialLink = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";

export function SiteFooter({ socials = [] }: { socials?: SocialLink[] }) {
  return (
    <footer className="bg-[#312f32] text-white">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-12">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px]">
          <Link href="/precios">Precios</Link>
          <Link href="/ayuda">Preguntas frecuentes</Link>
          <Link href="/legal/terminos">Términos y condiciones</Link>
          <Link href="/legal/privacidad">Política de privacidad</Link>
        </nav>
        {socials.length > 0 && (
          <div className="flex gap-4">
            {socials.map(({ href, label, icon: Icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="rounded-full bg-white/10 p-2.5 hover:bg-white/20">
                <Icon className="size-5" />
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="border-t border-white/10 py-6 text-center text-sm text-white/80">
        Copyright © {new Date().getFullYear()} {appName}. Todos los derechos reservados.
      </p>
    </footer>
  );
}
