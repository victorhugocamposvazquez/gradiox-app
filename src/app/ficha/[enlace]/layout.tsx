import type { Metadata } from "next";
import type { ReactNode } from "react";

// Página privada por enlace: que no la indexe ningún buscador ni se filtre su dirección al salir de ella.
export const metadata: Metadata = { title: "Ficha técnica de conexión · Gradiox", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Marco({ children }: { children: ReactNode }) {
  return children;
}
