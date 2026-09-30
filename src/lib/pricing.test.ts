import { describe, expect, it } from "vitest";
import { computeDeposit, distributeDiscount, priceBooking } from "./pricing";

describe("computeDeposit", () => {
  it("redondea hacia arriba a $100 (5% de $19.000 = $1.000)", () => {
    expect(computeDeposit(19000, 5, 0)).toBe(1000);
  });
  it("aplica el mínimo y nunca supera el precio", () => {
    expect(computeDeposit(10000, 10, 2500)).toBe(2500);
    expect(computeDeposit(1000, 10, 2500)).toBe(1000);
  });
  it("usa el mínimo cuando el precio es a definir", () => {
    expect(computeDeposit(0, 20, 3000, true)).toBe(3000);
  });
});

describe("distributeDiscount", () => {
  it("reparte un monto fijo y la suma cierra exacta", () => {
    const shares = distributeDiscount([19000, 14000, 23000], { discountType: "fixed", value: 1000 });
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });
  it("nunca descuenta más que el subtotal", () => {
    expect(distributeDiscount([500], { discountType: "fixed", value: 9999 })).toEqual([500]);
  });
});

describe("priceBooking", () => {
  it("calcula total y seña con cupón porcentual", () => {
    const r = priceBooking(
      [
        { price: 20000, priceTBD: false, depositApplies: true, depositPercent: 20 },
        { price: 10000, priceTBD: false, depositApplies: false, depositPercent: 20 },
      ],
      { discountType: "percent", value: 10 },
      0,
    );
    expect(r.subtotal).toBe(30000);
    expect(r.discount).toBe(3000);
    expect(r.total).toBe(27000);
    expect(r.deposit).toBe(3600); // 20% de 18.000
  });
});
