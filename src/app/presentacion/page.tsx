import type { Metadata } from "next";
import { Web } from "./web";

const TITULO = "Gradiox · El sistema de optimización de refrigeración que necesitas";
const DESCRIPCION = "Gradiox controla el frío, optimiza el consumo energético y se anticipa a los problemas. Menos averías, menos pérdidas y más ahorro. Demostración con datos simulados.";
export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  openGraph: { title: TITULO, description: DESCRIPCION, images: [{ url: "/web/servicios-dark.webp", width: 2400, height: 1500 }], locale: "es_ES", type: "website" },
};
export const dynamic = "force-dynamic";

export default function Presentacion() {
  // Solo se enseña un contacto si quien despliega lo ha puesto; no se inventa ninguno.
  const contacto = process.env.GRADIOX_CONTACTO?.trim() || undefined;
  return <Web contacto={contacto} />;
}
