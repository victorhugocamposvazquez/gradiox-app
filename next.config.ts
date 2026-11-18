import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // El programa de pasarela publicado viaja con la ruta que lo sirve para actualizarse.
  outputFileTracingIncludes: { "/api/pasarela/programa": ["./pasarela-opcua/publicado/**"] },
};

export default config;
