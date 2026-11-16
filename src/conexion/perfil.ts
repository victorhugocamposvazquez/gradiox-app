// Perfil de equipo: la ficha que dice, para un modelo de controlador, dónde
// está cada dato y cómo se convierte. Integrar un fabricante nuevo es escribir
// un perfil a partir de su manual; ni la pasarela ni la app cambian.

import { ErrorModbus, type ClienteModbus, type Tabla } from "./modbus";

/** Las señales que entiende Gradiox, iguales para cualquier marca. */
export type Senal = "temperatura" | "consigna" | "compresor" | "puerta" | "desescarche" | "alarma";
const NUMERICAS = ["temperatura", "consigna"] as const;
const BINARIAS = ["compresor", "puerta", "desescarche", "alarma"] as const;

export type Punto = {
  tabla: Tabla;
  direccion: number;
  /** Cómo viene el dato: entero con signo, sin signo, o un bit dentro de un registro. */
  tipo: "int16" | "uint16" | "bit";
  /** Por cuánto se multiplica lo leído para tener la unidad de Gradiox. 0,1 si el equipo da décimas. */
  escala?: number;
  /** Qué bit del registro, cuando `tipo` es "bit" y la tabla es de registros. */
  bit?: number;
  /** El equipo da 1 cuando la señal está en reposo. */
  invertido?: boolean;
  /** Solo si se puede escribir: rango que Gradiox no debe pasar nunca. */
  escribible?: { min: number; max: number };
};

export type Perfil = {
  id: string;
  marca: string;
  modelo: string;
  /** De dónde sale el perfil: manual y versión, o que es de pruebas. */
  origen: string;
  senales: Partial<Record<Senal, Punto>>;
};

/** Lo que se ha podido leer de un equipo en un instante. Falta lo que el perfil no tiene. */
export type LecturaEquipo = {
  t: number;
  temperatura?: number;
  consigna?: number;
  compresor?: boolean;
  puerta?: boolean;
  desescarche?: boolean;
  alarma?: boolean;
};

const redondear = (v: number) => Math.round(v * 100) / 100;

function descifrar(crudo: number, p: Punto): number {
  if (p.tabla === "bobina" || p.tabla === "discreta") return p.invertido ? 1 - crudo : crudo;
  if (p.tipo === "bit") {
    const b = (crudo >> (p.bit ?? 0)) & 1;
    return p.invertido ? 1 - b : b;
  }
  const entero = p.tipo === "int16" && crudo > 0x7fff ? crudo - 0x10000 : crudo;
  return redondear(entero * (p.escala ?? 1));
}

/** Lee del equipo todas las señales que su perfil conoce. */
export async function leerEquipo(cliente: ClienteModbus, unidad: number, perfil: Perfil, t = Date.now()): Promise<LecturaEquipo> {
  const lectura: LecturaEquipo = { t };
  for (const s of NUMERICAS) {
    const p = perfil.senales[s];
    if (p) lectura[s] = descifrar((await cliente.leer(unidad, p.tabla, p.direccion))[0], p);
  }
  for (const s of BINARIAS) {
    const p = perfil.senales[s];
    if (p) lectura[s] = descifrar((await cliente.leer(unidad, p.tabla, p.direccion))[0], p) === 1;
  }
  return lectura;
}

/**
 * Cambia la consigna del equipo. Se niega si el perfil no lo permite o si el
 * valor se sale del rango, y después vuelve a leer para comprobar que el equipo
 * lo ha aceptado.
 */
export async function escribirConsigna(cliente: ClienteModbus, unidad: number, perfil: Perfil, valor: number): Promise<void> {
  const p = perfil.senales.consigna;
  if (!p?.escribible) throw new ErrorModbus(`El perfil ${perfil.id} no permite cambiar la consigna`);
  if (p.tabla !== "retencion") throw new ErrorModbus(`El perfil ${perfil.id} tiene la consigna en una tabla que no se puede escribir`);
  const { min, max } = p.escribible;
  if (!(valor >= min && valor <= max)) throw new ErrorModbus(`Consigna ${valor} fuera del rango permitido (${min} a ${max})`);
  await cliente.escribirRegistro(unidad, p.direccion, Math.round(valor / (p.escala ?? 1)));
  const leido = descifrar((await cliente.leer(unidad, p.tabla, p.direccion))[0], p);
  if (Math.abs(leido - valor) > Math.abs(p.escala ?? 1) / 2) throw new ErrorModbus(`El equipo no ha aceptado la consigna: se pidió ${valor} y marca ${leido}`);
}
