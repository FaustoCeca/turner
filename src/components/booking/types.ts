import type { DayAvailability } from "@/lib/availability";
import type { PublicBusiness, PublicService } from "@/lib/public";

export type { DayAvailability, PublicBusiness, PublicService };

export type ProfessionalInfo = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

export type BranchInfo = {
  id: string;
  name: string | null;
  address: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

export type ProfessionalGroup = { branch: BranchInfo; professionals: ProfessionalInfo[] };

export type CartItem = {
  key: string;
  service: PublicService;
  professional: ProfessionalInfo;
  branch: BranchInfo;
  date: string;
  minutes: number;
};

export type Quote = {
  subtotal: number;
  discount: number;
  total: number;
  deposit: number;
  items: { price: number; discount: number; final: number; deposit: number }[];
  coupon: { code: string } | null;
  couponError: string | null;
  paymentMode: "mercadopago" | "mock" | null;
};

export function mapsUrl(branch: BranchInfo): string {
  const q = branch.lat != null && branch.lng != null ? `${branch.lat},${branch.lng}` : [branch.address, branch.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
