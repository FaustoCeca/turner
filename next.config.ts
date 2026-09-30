import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres embebido para desarrollo) usa WASM y archivos propios: no se empaqueta.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
