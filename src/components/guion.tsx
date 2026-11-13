"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CAMARAS } from "@/lib/datos";
import { useDemo } from "@/lib/store";

// Demostración guiada: una avería contada de principio a fin, pantalla a pantalla.
const CAMARA = CAMARAS[0];
const PASOS = [
  { ruta: `/servicios/${CAMARA.id}`, texto: `Se ha parado el compresor de ${CAMARA.nombre}. La temperatura sube y la ficha dice qué hacer y cuánto queda para el límite.` },
  { ruta: "/notificaciones", texto: "La alarma llega al momento como notificación, junto con el fallo típico que le corresponde y lo que hay que revisar." },
  { ruta: "/avisos", texto: "En Avisos queda la alarma abierta hasta que alguien la marca como atendida." },
  { ruta: `/mantenimiento?equipo=${CAMARA.id}-comp&tipo=Avería&nota=${encodeURIComponent("Compresor parado. Se rearma tras comprobar protecciones.")}`, texto: "La intervención se apunta en el libro con el equipo y el motivo ya puestos." },
  { ruta: `/servicios/${CAMARA.id}`, texto: `Se rearma el compresor. ${CAMARA.nombre} vuelve a enfriar y llega el aviso de vuelta a la normalidad.` },
];

type Guion = { paso: number | null; empezar: () => void; seguir: () => void; salir: () => void };
const Contexto = createContext<Guion | null>(null);

export function GuionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { simularAveria, quitarAveria } = useDemo();
  const [paso, setPaso] = useState<number | null>(null);

  const ir = useCallback(
    (n: number) => {
      // En el último paso se arregla la avería.
      if (n === PASOS.length - 1) quitarAveria(CAMARA.id);
      setPaso(n);
      router.push(PASOS[n].ruta);
    },
    [quitarAveria, router],
  );
  const valor = useMemo<Guion>(
    () => ({
      paso,
      empezar: () => {
        // Parado desde hace un rato, para que la temperatura ya haya subido.
        simularAveria(CAMARA.id, "compresor", 50);
        ir(0);
      },
      seguir: () => {
        if (paso === null) return;
        if (paso < PASOS.length - 1) return ir(paso + 1);
        setPaso(null);
        router.push("/");
      },
      salir: () => {
        quitarAveria(CAMARA.id);
        setPaso(null);
      },
    }),
    [paso, ir, simularAveria, quitarAveria, router],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useGuion(): Guion {
  const g = useContext(Contexto);
  if (!g) throw new Error("useGuion se usa dentro de GuionProvider");
  return g;
}

export function PanelGuion() {
  const { paso, seguir, salir } = useGuion();
  if (paso === null) return null;
  const ultimo = paso === PASOS.length - 1;
  return (
    <aside className="gx-guion" aria-label="Demostración guiada" aria-live="polite">
      <div className="gx-fila">
        <strong>Demostración · paso {paso + 1} de {PASOS.length}</strong>
        <button type="button" className="gx-guion-salir" aria-label="Salir de la demostración" onClick={salir}>
          <X size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      <div className="gx-guion-barra" aria-hidden="true"><i style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} /></div>
      <p>{PASOS[paso].texto}</p>
      <button type="button" className="gx-boton" onClick={seguir}>
        {ultimo ? "Terminar" : "Siguiente"} {!ultimo && <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />}
      </button>
    </aside>
  );
}
