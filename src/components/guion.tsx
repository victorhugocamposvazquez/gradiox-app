"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CAMARAS } from "@/lib/datos";
import { useDemo } from "@/lib/store";

// Demostración guiada: una avería contada de principio a fin, pantalla a pantalla.
// Recorrido: dónde está cada cosa, para quien entra por primera vez.
type Paso = { ruta: string; texto: string };
export const CLAVE_RECORRIDO = "gradiox-recorrido";
const CAMARA = CAMARAS[0];
const AVERIA: Paso[] = [
  { ruta: `/servicios/${CAMARA.id}`, texto: `Se ha parado el compresor de ${CAMARA.nombre}. La temperatura sube y la ficha dice qué hacer y cuánto queda para el límite.` },
  { ruta: "/notificaciones", texto: "La alarma llega al momento como notificación, junto con el fallo típico que le corresponde y lo que hay que revisar." },
  { ruta: "/avisos", texto: "En Avisos queda la alarma abierta hasta que alguien la marca como atendida." },
  { ruta: `/mantenimiento?equipo=${CAMARA.id}-comp&tipo=Avería&nota=${encodeURIComponent("Compresor parado. Se rearma tras comprobar protecciones.")}`, texto: "La intervención se apunta en el libro con el equipo y el motivo ya puestos." },
  { ruta: `/servicios/${CAMARA.id}`, texto: `Se rearma el compresor. ${CAMARA.nombre} vuelve a enfriar y llega el aviso de vuelta a la normalidad.` },
];

const RECORRIDO: Paso[] = [
  { ruta: "/", texto: "Hoy es el inicio: de un vistazo, si todo está en orden y qué toca hacer." },
  { ruta: "/servicios", texto: "En Servicios está cada cámara, túnel, muelle o mueble con su temperatura en vivo. Al tocar uno se abre su ficha, con la gráfica y lo que hay que hacer." },
  { ruta: "/avisos", texto: "Avisos guarda las alarmas: quién las ha visto, quién las lleva y cómo se cerraron." },
  { ruta: "/mantenimiento", texto: "Mantenimiento lleva las órdenes de trabajo, las revisiones y el libro de cada equipo." },
  { ruta: "/turno", texto: "Turno es para el relevo y la ronda diaria. Y en Demostración, desde Hoy, puedes provocar una avería para ver cómo reacciona todo." },
];
const GUIONES = { averia: AVERIA, recorrido: RECORRIDO };
type Cual = keyof typeof GUIONES;
const recordarRecorrido = () => {
  try {
    window.localStorage.setItem(CLAVE_RECORRIDO, "visto");
  } catch {
    // Sin almacenamiento volverá a ofrecerse.
  }
};

type Guion = { paso: number | null; cual: Cual; empezar: () => void; recorrer: () => void; seguir: () => void; salir: () => void };
const Contexto = createContext<Guion | null>(null);

export function GuionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { simularAveria, quitarAveria } = useDemo();
  const [paso, setPaso] = useState<number | null>(null);
  const [cual, setCual] = useState<Cual>("averia");

  const ir = useCallback(
    (c: Cual, n: number) => {
      // En el último paso de la avería se arregla.
      if (c === "averia" && n === AVERIA.length - 1) quitarAveria(CAMARA.id);
      setCual(c);
      setPaso(n);
      router.push(GUIONES[c][n].ruta);
    },
    [quitarAveria, router],
  );
  const valor = useMemo<Guion>(
    () => ({
      paso,
      cual,
      empezar: () => {
        // Parado desde hace un rato, para que la temperatura ya haya subido.
        simularAveria(CAMARA.id, "compresor", 50);
        ir("averia", 0);
      },
      recorrer: () => {
        recordarRecorrido();
        ir("recorrido", 0);
      },
      seguir: () => {
        if (paso === null) return;
        if (paso < GUIONES[cual].length - 1) return ir(cual, paso + 1);
        setPaso(null);
        router.push("/");
      },
      salir: () => {
        if (cual === "averia") quitarAveria(CAMARA.id);
        setPaso(null);
      },
    }),
    [paso, cual, ir, simularAveria, quitarAveria, router],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useGuion(): Guion {
  const g = useContext(Contexto);
  if (!g) throw new Error("useGuion se usa dentro de GuionProvider");
  return g;
}

export function PanelGuion() {
  const { paso, cual, seguir, salir } = useGuion();
  if (paso === null) return null;
  const pasos = GUIONES[cual];
  const ultimo = paso === pasos.length - 1;
  const nombre = cual === "averia" ? "Demostración" : "Recorrido";
  return (
    <aside className="gx-guion" aria-label={cual === "averia" ? "Demostración guiada" : "Recorrido"} aria-live="polite">
      <div className="gx-fila">
        <strong>{nombre} · paso {paso + 1} de {pasos.length}</strong>
        <button type="button" className="gx-guion-salir" aria-label={cual === "averia" ? "Salir de la demostración" : "Salir del recorrido"} onClick={salir}>
          <X size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      <div className="gx-guion-barra" aria-hidden="true"><i style={{ width: `${((paso + 1) / pasos.length) * 100}%` }} /></div>
      <p>{pasos[paso].texto}</p>
      <button type="button" className="gx-boton" onClick={seguir}>
        {ultimo ? "Terminar" : "Siguiente"} {!ultimo && <ArrowRight size={18} strokeWidth={1.7} aria-hidden="true" />}
      </button>
    </aside>
  );
}
