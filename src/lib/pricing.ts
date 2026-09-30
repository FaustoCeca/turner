export type CouponLike = { discountType: "percent" | "fixed"; value: number };

export type PricingItem = {
  price: number;
  priceTBD: boolean;
  /** Si este ítem exige seña (config. del negocio + servicio + cliente). */
  depositApplies: boolean;
  depositPercent: number;
};

export type PricedItem = { price: number; discount: number; final: number; deposit: number };

export type PricingResult = {
  items: PricedItem[];
  subtotal: number;
  discount: number;
  total: number;
  deposit: number;
};

const ROUND_TO = 100;

/**
 * Seña de un turno: porcentaje del precio redondeado hacia arriba a $100,
 * nunca menor al mínimo configurado ni mayor al precio.
 */
export function computeDeposit(
  price: number,
  percent: number,
  minAmount: number,
  priceTBD = false,
): number {
  if (priceTBD) return Math.max(0, minAmount);
  if (price <= 0) return 0;
  const raw = (price * percent) / 100;
  const rounded = Math.ceil(raw / ROUND_TO) * ROUND_TO;
  return Math.min(price, Math.max(rounded, minAmount));
}

/** Reparte el descuento del cupón entre los ítems (proporcional al precio). */
export function distributeDiscount(prices: number[], coupon: CouponLike | null): number[] {
  if (!coupon) return prices.map(() => 0);
  const subtotal = prices.reduce((a, b) => a + b, 0);
  if (subtotal <= 0) return prices.map(() => 0);

  const totalDiscount =
    coupon.discountType === "percent"
      ? Math.round((subtotal * Math.min(100, Math.max(0, coupon.value))) / 100)
      : Math.min(subtotal, Math.max(0, coupon.value));

  const shares = prices.map((p) => Math.floor((totalDiscount * p) / subtotal));
  // El resto por redondeo va al ítem más caro para que la suma cierre exacta.
  let remainder = totalDiscount - shares.reduce((a, b) => a + b, 0);
  const order = prices.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (remainder <= 0) break;
    const room = prices[i] - shares[i];
    const add = Math.min(room, remainder);
    shares[i] += add;
    remainder -= add;
  }
  return shares;
}

export function priceBooking(
  items: PricingItem[],
  coupon: CouponLike | null,
  depositMinAmount: number,
): PricingResult {
  const prices = items.map((i) => (i.priceTBD ? 0 : i.price));
  const discounts = distributeDiscount(prices, coupon);
  const priced = items.map((item, idx) => {
    const final = prices[idx] - discounts[idx];
    const deposit = item.depositApplies
      ? computeDeposit(final, item.depositPercent, depositMinAmount, item.priceTBD)
      : 0;
    return { price: prices[idx], discount: discounts[idx], final, deposit };
  });
  const subtotal = prices.reduce((a, b) => a + b, 0);
  const discount = discounts.reduce((a, b) => a + b, 0);
  return {
    items: priced,
    subtotal,
    discount,
    total: subtotal - discount,
    deposit: priced.reduce((a, b) => a + b.deposit, 0),
  };
}

export function formatMoney(amount: number, currency = "ARS"): string {
  const n = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
  return currency === "ARS" ? `$ ${n}` : `${currency} ${n}`;
}
