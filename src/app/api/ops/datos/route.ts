import { CONTROL_MS, DIAS_DETALLE, VIGENCIA_MS } from "@/pasarelas/ahorro";
import type { Guardado } from "@/pasarelas/almacen";
import { conPasarelas } from "@/pasarelas/rutas";

// Qué hay guardado de cada instalación y cuánto ocupa (zona interna). Solo con sesión iniciada en el panel.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type DatosInstalacion = { id: string; nombre: string; simulada: boolean; variables: number; guardado: Guardado };
export type RespuestaDatos = { guardado: "memoria" | "base"; ahora: number; total: number | null; reglas: { controlMin: number; vigenciaMin: number; diasDetalle: number }; instalaciones: DatosInstalacion[] };

export const GET = () =>
  conPasarelas(async (a): Promise<RespuestaDatos> => {
    const instalaciones: DatosInstalacion[] = [];
    for (const p of await a.listar()) {
      instalaciones.push({ id: p.id, nombre: p.nombre, simulada: p.contacto?.estado.simulado === true, variables: (await a.variablesLeidas(p.id)).length, guardado: await a.guardado(p.id) });
    }
    return { guardado: a.tipo, ahora: Date.now(), total: await a.espacioTotal(), reglas: { controlMin: CONTROL_MS / 60_000, vigenciaMin: VIGENCIA_MS / 60_000, diasDetalle: DIAS_DETALLE }, instalaciones };
  });
