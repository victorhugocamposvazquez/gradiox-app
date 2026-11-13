"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { registroInicial, type Intervencion } from "./equipos";
import { FALLOS_INICIALES, type FalloTipico } from "./fallos";
import { AJUSTES_INICIALES, type Ajustes, type Averia } from "./sim";

/** `atendidas` guarda cuándo se atendió cada alarma, por cámara e instante de inicio. */
type Guardado = { ajustes: Ajustes; registro: Intervencion[] | null; atendidas: Record<string, number>; fallos: FalloTipico[] | null };
const INICIAL: Guardado = { ajustes: AJUSTES_INICIALES, registro: null, atendidas: {}, fallos: null };
type Demo = {
  /** Instante actual; null hasta que la página se monta en el navegador. */
  ahora: number | null;
  ajustes: Ajustes;
  registro: Intervencion[];
  atendidas: Record<string, number>;
  atender: (clave: string) => void;
  fallos: FalloTipico[];
  anadirFallo: (f: Omit<FalloTipico, "id">) => void;
  quitarFallo: (id: string) => void;
  simularAveria: (camaraId: string, tipo: Averia["tipo"]) => void;
  quitarAveria: (camaraId: string) => void;
  cambiarConsigna: (camaraId: string, valor: number) => void;
  activarPlan: (activo: boolean) => void;
  apuntar: (i: Omit<Intervencion, "id">) => void;
  reiniciar: () => void;
};

const CLAVE = "gradiox-demo-v1";
const Contexto = createContext<Demo | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [ahora, setAhora] = useState<number | null>(null);
  const [estado, setEstado] = useState<Guardado>(INICIAL);

  useEffect(() => {
    try {
      const crudo = window.localStorage.getItem(CLAVE);
      if (crudo) setEstado({ ...INICIAL, ...(JSON.parse(crudo) as Partial<Guardado>) });
    } catch {
      // Sin almacenamiento la demo funciona igual, solo que no recuerda.
    }
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, []);

  const guardar = useCallback((cambio: (g: Guardado) => Guardado) => {
    setEstado((previo) => {
      const nuevo = cambio(previo);
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
      } catch {
        // Ver arriba.
      }
      return nuevo;
    });
  }, []);

  const valor = useMemo<Demo>(() => {
    const registro = estado.registro ?? registroInicial(ahora ?? 0);
    const fallos = estado.fallos ?? FALLOS_INICIALES;
    const conAjustes = (f: (a: Ajustes) => Ajustes) => {
      guardar((g) => ({ ...g, ajustes: f(g.ajustes) }));
      // Que el cambio se vea al momento, sin esperar al siguiente tic.
      setAhora(Date.now() + 1);
    };
    return {
      ahora,
      ajustes: estado.ajustes,
      registro,
      atendidas: estado.atendidas,
      fallos,
      anadirFallo: (f) => guardar((g) => ({ ...g, fallos: [...(g.fallos ?? FALLOS_INICIALES), { ...f, id: `f${Date.now()}` }] })),
      quitarFallo: (id) => guardar((g) => ({ ...g, fallos: (g.fallos ?? FALLOS_INICIALES).filter((f) => f.id !== id) })),
      atender: (clave) => guardar((g) => ({ ...g, atendidas: { ...g.atendidas, [clave]: Date.now() } })),
      simularAveria: (id, tipo) => conAjustes((a) => ({ ...a, averias: { ...a.averias, [id]: { tipo, desde: Date.now() } } })),
      quitarAveria: (id) =>
        conAjustes((a) => {
          const averias = { ...a.averias };
          delete averias[id];
          return { ...a, averias };
        }),
      cambiarConsigna: (id, v) => conAjustes((a) => ({ ...a, consignas: { ...a.consignas, [id]: v } })),
      activarPlan: (activo) => conAjustes((a) => ({ ...a, planActivo: activo })),
      apuntar: (i) => guardar((g) => ({ ...g, registro: [{ ...i, id: `i${Date.now()}` }, ...(g.registro ?? registroInicial(Date.now()))] })),
      reiniciar: () => guardar(() => INICIAL),
    };
  }, [ahora, estado, guardar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDemo(): Demo {
  const d = useContext(Contexto);
  if (!d) throw new Error("useDemo se usa dentro de DemoProvider");
  return d;
}
