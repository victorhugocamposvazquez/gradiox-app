import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // El programa de pasarela publicado viaja con la ruta que lo sirve para actualizarse.
  // Cabeceras de seguridad en todas las respuestas: solo por conexión cifrada, sin poder meter Gradiox dentro de otra
  // página (para que nadie engañe con una pantalla falsa encima), sin adivinar tipos de archivo y sin cámara ni micrófono.
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
      ],
    },
  ],
  outputFileTracingIncludes: { "/api/pasarela/programa": ["./pasarela-opcua/publicado/**"] },
};

export default config;
