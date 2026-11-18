// Órdenes de Gradiox al PLC a través de la pasarela. Van con doble llave: se
// activan para la instalación en el panel y, además, en el propio programa, en
// la planta. Solo se puede cambiar lo que está en la lista de variables que se
// pueden escribir, dentro de sus límites, y cada orden queda apuntada.

import { randomBytes } from "node:crypto";

export type Escribible = {
  /** Nombre de la variable, el mismo que en la lista de lectura. */
  n: string;
  /** Si es un sí/no; si no, es un número. */
  sino: boolean;
  min?: number;
  max?: number;
};

export type EstadoOrden = "pendiente" | "enviada" | "hecha" | "rechazada" | "caducada" | "anulada";

export type Orden = {
  id: string;
  n: string;
  valor: boolean | number;
  /** Lo que tenía la variable antes, según la última lectura y según el PLC al escribir. */
  antes?: boolean | number | string | null;
  /** Lo que lee el programa justo después de escribir. */
  leido?: boolean | number | string | null;
  estado: EstadoOrden;
  motivo?: string;
  pedida: number;
  cambio: number;
  simulada?: boolean;
  /** Quién la pidió. */
  por?: string;
};

/** Lo que se guarda con la instalación. Las órdenes van en su propia tabla, que nunca se recorta. */
export type Escritura = { activa: boolean; variables: Escribible[] };

export const escrituraVacia = (): Escritura => ({ activa: false, variables: [] });
export const ABIERTAS: EstadoOrden[] = ["pendiente", "enviada"];

/** Lo que una orden tarda en caducar si el programa no la recoge: una orden vieja no se ejecuta. */
export const CADUCA_MS = 2 * 60_000;
export const MAX_ESCRIBIBLES = 200;

const numero = (t: string) => {
  const x = Number(t.replace(",", "."));
  return t.trim() !== "" && Number.isFinite(x) ? x : undefined;
};

/**
 * Lee la lista de variables que se pueden cambiar, una por línea:
 * «variable; mínimo; máximo» para números y «variable; sí/no» para las de dos estados.
 */
export function escribiblesDeTexto(texto: string): { variables: Escribible[] } | { error: string } {
  const out: Escribible[] = [];
  const vistas = new Set<string>();
  for (const [i, bruta] of texto.split(/\r?\n/).entries()) {
    const linea = bruta.trim();
    if (!linea || linea.startsWith("#")) continue;
    const c = linea.split(/[;\t]/).map((x) => x.trim());
    const n = c[0];
    if (!n || n.length > 200 || /^variable$/i.test(n)) continue;
    if (vistas.has(n)) continue;
    vistas.add(n);
    if (/^(s[ií]\/no|bool|sino)$/i.test(c[1] ?? "")) {
      out.push({ n, sino: true });
      continue;
    }
    const min = numero(c[1] ?? ""), max = numero(c[2] ?? "");
    if (min === undefined || max === undefined) return { error: `Línea ${i + 1}: falta el mínimo y el máximo («${n}; -25; 5») o «sí/no»` };
    if (min > max) return { error: `Línea ${i + 1}: el mínimo es mayor que el máximo` };
    out.push({ n, sino: false, min, max });
    if (out.length > MAX_ESCRIBIBLES) return { error: `Como mucho ${MAX_ESCRIBIBLES} variables` };
  }
  return { variables: out };
}

export const textoDeEscribibles = (v: Escribible[]) => v.map((e) => (e.sino ? `${e.n}; sí/no` : `${e.n}; ${e.min}; ${e.max}`)).join("\n");

/** Comprueba una orden contra la lista y sus límites. Devuelve el valor limpio o el motivo. */
export function validarValor(e: Escribible | undefined, valor: unknown): { valor: boolean | number } | { error: string } {
  if (!e) return { error: "Esa variable no está entre las que se pueden cambiar" };
  if (e.sino) return typeof valor === "boolean" ? { valor } : { error: "Esa variable es de sí o no" };
  const x = typeof valor === "number" ? valor : typeof valor === "string" ? numero(valor) : undefined;
  if (x === undefined || !Number.isFinite(x)) return { error: "Falta un número" };
  if ((e.min !== undefined && x < e.min) || (e.max !== undefined && x > e.max)) return { error: `Fuera de los límites: entre ${e.min} y ${e.max}` };
  return { valor: x };
}

export const nuevaOrden = (n: string, valor: boolean | number, antes: Orden["antes"], ahora: number, por: string): Orden => ({
  id: randomBytes(8).toString("hex"),
  n,
  valor,
  // Sin dato (null) es lo mismo que no saberlo: no se guarda.
  ...(antes === undefined || antes === null ? {} : { antes }),
  estado: "pendiente",
  pedida: ahora,
  cambio: ahora,
  por,
});

export const MOTIVO_CADUCADA = "El programa no la recogió a tiempo";

const ESTADOS_FINALES = new Set<EstadoOrden>(["hecha", "rechazada", "caducada", "anulada"]);
export const terminada = (o: Orden) => ESTADOS_FINALES.has(o.estado);

export type CambioOrden = Partial<Pick<Orden, "estado" | "motivo" | "antes" | "leido" | "simulada">> & { cambio: number };

/** Lo que el programa cuenta de una orden, ya limpio. Null si no se entiende. */
export function resultado(r: Record<string, unknown>, ahora: number): CambioOrden | null {
  const estado = r.estado === "hecha" ? "hecha" : r.estado === "rechazada" ? "rechazada" : null;
  if (!estado) return null;
  const simple = (x: unknown) => (typeof x === "boolean" || (typeof x === "number" && Number.isFinite(x)) ? x : typeof x === "string" ? x.slice(0, 200) : undefined);
  const motivo = typeof r.motivo === "string" ? r.motivo.slice(0, 300) : undefined;
  const antes = simple(r.antes), leido = simple(r.leido);
  return { estado, cambio: ahora, ...(motivo ? { motivo } : {}), ...(antes !== undefined ? { antes } : {}), ...(leido !== undefined ? { leido } : {}), ...(r.simulada === true ? { simulada: true } : {}) };
}
