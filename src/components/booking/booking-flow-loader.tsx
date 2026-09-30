"use client";

import dynamic from "next/dynamic";

/**
 * El flujo de reserva depende del carrito guardado en sessionStorage, así que se renderiza
 * sólo en el navegador (el encabezado y los datos del negocio sí llegan renderizados del servidor).
 */
export const BookingFlowLoader = dynamic(() => import("./booking-flow").then((m) => m.BookingFlow), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-[480px] px-4 pt-6" aria-busy>
      <div className="h-[92px] animate-pulse rounded-xl bg-white shadow-[0_4px_18px_rgba(93,93,239,0.18)]" />
    </div>
  ),
});
