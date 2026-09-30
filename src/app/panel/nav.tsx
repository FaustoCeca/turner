"use client";

import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Percent,
  Scissors,
  Settings,
  Store,
  Users,
  UserSquare2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const ITEMS = [
  { href: "/panel", label: "Agenda", icon: CalendarDays, exact: true },
  { href: "/panel/turnos", label: "Turnos", icon: ClipboardList },
  { href: "/panel/recordatorios", label: "Recordatorios", icon: MessageCircle },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
  { href: "/panel/profesionales", label: "Profesionales", icon: UserSquare2 },
  { href: "/panel/sucursales", label: "Sucursales", icon: Store },
  { href: "/panel/cupones", label: "Cupones", icon: Percent },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/configuracion", label: "Configuración", icon: Settings },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
              active ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
