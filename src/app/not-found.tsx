import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-brand-bg px-4 text-center">
      <p className="text-6xl font-bold text-brand">404</p>
      <h1 className="text-xl font-bold">No encontramos esta página</h1>
      <p className="text-neutral-600">Revisá que el link del negocio esté bien escrito.</p>
      <Link href="/" className="mt-2 rounded-lg bg-brand px-5 py-2.5 font-medium text-white">
        Ir al inicio
      </Link>
    </div>
  );
}
