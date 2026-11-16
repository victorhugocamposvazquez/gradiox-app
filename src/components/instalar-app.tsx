"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { alCambiarInstalacion, estadoInstalacion, instalar, type EstadoInstalacion } from "@/lib/instalacion";

/** Tarjeta para poner Gradiox como app en el móvil o en el ordenador. */
export function InstalarApp() {
  const [estado, setEstado] = useState<EstadoInstalacion | null>(null);
  useEffect(() => {
    const mirar = () => setEstado(estadoInstalacion());
    mirar();
    return alCambiarInstalacion(mirar);
  }, []);
  if (estado === null) return null;

  return (
    <section className="gx-tarjeta gx-instalar" aria-label="Instalar Gradiox">
      <img src="/icono2-192.png" alt="" width={44} height={44} />
      <div>
        <h2>{estado === "instalada" ? "Gradiox está instalado en este dispositivo" : "Instalar Gradiox en este dispositivo"}</h2>
        {estado === "instalada" && <p className="gx-nota">Lo estás usando como app, con su icono y sin la barra del navegador.</p>}
        {estado === "lista" && <p className="gx-nota">Se abre con su icono, a pantalla completa y sin la barra del navegador.</p>}
        {estado === "iphone" && (
          <ol className="gx-nota">
            <li>Abre esta página en Safari.</li>
            <li>Pulsa el botón de compartir.</li>
            <li>Elige «Añadir a pantalla de inicio».</li>
          </ol>
        )}
        {estado === "manual" && <p className="gx-nota">Abre el menú del navegador y elige «Instalar Gradiox» o «Añadir a pantalla de inicio». En Chrome y Edge de ordenador también sale un icono de instalar en la barra de direcciones.</p>}
      </div>
      {estado === "lista" && (
        <button type="button" className="gx-boton" onClick={() => void instalar()}>
          <Download size={18} strokeWidth={1.6} aria-hidden="true" /> Instalar
        </button>
      )}
    </section>
  );
}
