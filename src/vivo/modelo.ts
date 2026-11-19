// Lo que se ve en Hoy y en Servicios de una instalación conectada: de la lista
// de variables del autómata y de lo último que ha entregado la pasarela salen
// sus servicios (cámaras y túneles), con su temperatura, su estado y su curva
// de la última hora. Todo se deduce de los nombres de las variables, como en
// «Datos_C10_1_REAL.TT9» (temperatura de la cámara 10) o
// «Datos_C10_1_BOOL.Refrigeracion» (está enfriando).

import type { LecturaOpc, Pasarela, VariableOpc } from "../pasarelas/modelo";

export type Estado = "correcto" | "aviso" | "error" | "sindatos";
export type Rumbo = "sube" | "baja" | "estable";

/** Pasado este tiempo sin entregas, la pasarela se da por callada. */
export const CALLADA_MS = 3 * 60_000;
/** Una temperatura más vieja que esto ya no dice cómo está la cámara. La pasarela manda una lectura de control cada 10 min aunque no cambie. */
export const VIEJA_MS = 15 * 60_000;
/** Lo que se pide a la base de datos: lo último de cada variable dentro de este rato. */
export const VENTANA_MS = 30 * 60_000;
/** La curva de cada servicio. */
export const CURVA_MS = 60 * 60_000;
export const PUNTOS_CURVA = 30;
/** A cuántos grados de la alarma alta del autómata se avisa. */
export const CERCA_ALARMA = 1;
/** Sin alarma alta en el autómata, cuánto por encima de la consigna se avisa. */
export const SOBRE_CONSIGNA = 3;

export type Evaporador = { nombre: string; enfriando: boolean | null; averia: boolean };

export type ServicioVivo = {
  /** Instalación (pasarela) de la que viene, para abrir su histórico. */
  pasarela: string;
  clave: string;
  nombre: string;
  clase: "camara" | "tunel";
  /** Variable de la temperatura, para abrir su histórico. */
  variable: string;
  temp: number | null;
  consigna: number | null;
  /** Alarmas que ya tiene puestas el autómata. */
  muyAlta: number | null;
  muyBaja: number | null;
  humedad: number | null;
  enfriando: boolean | null;
  desescarche: boolean | null;
  averia: boolean;
  /** false si la cámara está parada (sin «marcha»). */
  enMarcha: boolean | null;
  /** Evaporadores de la misma cámara que no tienen sonda propia. */
  evaporadores: Evaporador[];
  estado: Estado;
  motivo: string;
  rumbo: Rumbo;
  /** Temperatura de la última hora en puntos espaciados por igual. */
  curva: number[];
  /** Instante de la última temperatura. */
  ultima: number | null;
};

export type CompresorVivo = { nombre: string; marcha: boolean | null; bloqueado: boolean };

export type InstalacionViva = {
  id: string;
  nombre: string;
  /** Cliente al que pertenece, si está asignada en el panel interno. */
  cliente: { id: string; nombre: string } | null;
  /** Ubicación (nave, almacén) donde está. Sin asignar, la propia instalación hace de ubicación. */
  ubicacion: { id: string; nombre: string };
  simulada: boolean;
  /** Última vez que la pasarela entregó algo. */
  entrega: number | null;
  conectada: boolean;
  servicios: ServicioVivo[];
  compresores: CompresorVivo[];
};

const TIPO = /_(REAL|BOOL|INT|WORD|DINT|UINT)$/i;
/** «Datos_C6_1_REAL.TT9» → clave «Datos_C6_1», campo «tt9». */
export function partes(n: string): { clave: string; campo: string } | null {
  const i = n.lastIndexOf(".");
  if (i <= 0) return null;
  return { clave: n.slice(0, i).replace(TIPO, ""), campo: n.slice(i + 1).toLowerCase() };
}

const esTemperatura = (campo: string) => /^tt\d+$/.test(campo);
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const bool = (x: unknown) => (typeof x === "boolean" ? x : null);
const redondo = (v: number) => Math.round(v * 10) / 10;
const grados = (v: number) => `${redondo(v).toString().replace(".", ",").replace("-", "−")} °C`;
const hora = (t: number) => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

/** La temperatura de un rato en `n` puntos espaciados por igual: en cada punto vale la última lectura anterior. */
export function muestrear(lecturas: { t: number; x: unknown }[], desde: number, hasta: number, n = PUNTOS_CURVA): number[] {
  const ls = lecturas.filter((l) => num(l.x) !== null).sort((a, b) => a.t - b.t);
  if (!ls.length) return [];
  const out: number[] = [];
  let i = 0;
  let valor: number | null = null;
  for (let k = 0; k < n; k++) {
    const t = desde + ((hasta - desde) * k) / (n - 1);
    while (i < ls.length && ls[i].t <= t) valor = num(ls[i++].x);
    if (valor !== null) out.push(valor);
  }
  return out;
}

function rumboDe(curva: number[]): Rumbo {
  if (curva.length < 8) return "estable";
  // Lo de ahora frente a hace un cuarto de hora (la curva es de una hora).
  const antes = curva[Math.max(0, curva.length - 1 - Math.round(curva.length / 4))];
  const d = curva[curva.length - 1] - antes;
  return d > 0.3 ? "sube" : d < -0.3 ? "baja" : "estable";
}

type Campos = Map<string, string>; // campo → nombre de la variable

/**
 * Monta la instalación. `variables` es su lista (la aceptada y la que propone
 * el programa), `ultimas` lo último de cada variable y `curvas` lo leído de
 * cada temperatura en la última hora.
 */
export function montarInstalacion(p: Pasarela, ultimas: LecturaOpc[], curvas: LecturaOpc[], ahora: number): InstalacionViva {
  const variables = listaDe(p, ultimas);
  const grupos = new Map<string, Campos>();
  const nombres = new Map<string, string>(); // clave → nombre claro
  for (const v of variables) {
    const x = partes(v.n);
    if (!x) continue;
    const c = grupos.get(x.clave) ?? new Map<string, string>();
    if (!c.has(x.campo)) c.set(x.campo, v.n);
    grupos.set(x.clave, c);
    if (v.g && !nombres.has(x.clave)) nombres.set(x.clave, v.g);
  }
  const ult = new Map(ultimas.map((l) => [l.v, l]));
  const valor = (n?: string) => (n ? ult.get(n)?.x : undefined);
  const entrega = p.contacto?.t ?? (ultimas.length ? Math.max(...ultimas.map((l) => l.t)) : null);
  const conectada = entrega !== null && ahora - entrega < CALLADA_MS;
  const porVariable = new Map<string, LecturaOpc[]>();
  for (const l of curvas) porVariable.set(l.v, [...(porVariable.get(l.v) ?? []), l]);

  const servicios: ServicioVivo[] = [];
  const sinSonda: { base: string; e: Evaporador }[] = [];
  const compresores: CompresorVivo[] = [];
  for (const [clave, c] of grupos) {
    const nombre = nombres.get(clave) ?? clave.replace(/^Datos_/i, "").replace(/_/g, " ");
    if (/^compresor/i.test(clave) && c.has("marcha")) {
      compresores.push({ nombre, marcha: bool(valor(c.get("marcha"))), bloqueado: bool(valor(c.get("bloq_comp"))) === true });
      continue;
    }
    const campoT = [...c.keys()].filter(esTemperatura).sort()[0];
    const enfriando = bool(valor(c.get("refrigeracion")));
    const averia = bool(valor(c.get("averia"))) === true;
    if (!campoT) {
      // Un evaporador sin sonda: se enseña dentro de su cámara si la tiene.
      if (c.has("refrigeracion")) sinSonda.push({ base: clave.replace(/_\d+$/, ""), e: { nombre, enfriando, averia } });
      continue;
    }
    const variable = c.get(campoT)!;
    const lt = ult.get(variable);
    const temp = num(lt?.x);
    const ultima = lt && temp !== null ? lt.t : null;
    const consigna = num(valor(c.get("p_consigna_ac")));
    const muyAlta = num(valor(c.get("t_muy_alta_ac")));
    const muyBaja = num(valor(c.get("t_muy_baja_ac")));
    const desescarche = bool(valor(c.get("desescarche")));
    const marcha = bool(valor(c.get("marcha")));
    const curva = muestrear(porVariable.get(variable) ?? [], ahora - CURVA_MS, ahora);

    let estado: Estado = "correcto";
    let motivo: string;
    if (!conectada) {
      estado = "sindatos";
      motivo = entrega ? `La pasarela no entrega desde las ${hora(entrega)}` : "La pasarela todavía no ha entregado";
    } else if (temp === null || ultima === null || ahora - ultima > VIEJA_MS) {
      estado = "sindatos";
      motivo = ultima ? `Sin lectura de temperatura desde las ${hora(ultima)}` : lt?.c ? "La sonda no responde" : "Sin lectura de temperatura";
    } else if (averia) {
      estado = "error";
      motivo = "Avería en el autómata";
    } else if (muyAlta !== null && temp >= muyAlta) {
      estado = "error";
      motivo = `Temperatura muy alta: alarma a ${grados(muyAlta)}`;
    } else if (muyBaja !== null && temp <= muyBaja) {
      estado = "error";
      motivo = `Temperatura muy baja: alarma a ${grados(muyBaja)}`;
    } else if (muyAlta !== null && temp >= muyAlta - CERCA_ALARMA) {
      estado = "aviso";
      motivo = `Cerca de la alarma alta (${grados(muyAlta)})`;
    } else if (muyAlta === null && consigna !== null && !desescarche && temp > consigna + SOBRE_CONSIGNA) {
      estado = "aviso";
      motivo = `${grados(temp - consigna)} por encima de la consigna`;
    } else {
      motivo = marcha === false ? "Parado" : desescarche ? "En desescarche" : enfriando ? "Enfriando" : enfriando === false ? "En reposo" : "Leyendo";
    }

    servicios.push({
      pasarela: p.id,
      clave,
      nombre,
      clase: /tunel|túnel/i.test(clave + nombre) ? "tunel" : "camara",
      variable,
      temp,
      consigna,
      muyAlta,
      muyBaja,
      humedad: num(valor(c.get("humedad"))),
      enfriando,
      desescarche,
      averia,
      enMarcha: marcha,
      evaporadores: [],
      estado,
      motivo,
      rumbo: rumboDe(curva),
      curva,
      ultima,
    });
  }
  for (const { base, e } of sinSonda) {
    const dueno = servicios.find((s) => s.clave.replace(/_\d+$/, "") === base);
    if (!dueno) continue;
    dueno.evaporadores.push(e);
    if (e.averia && conectada && dueno.estado !== "sindatos" && dueno.estado !== "error") {
      dueno.estado = "error";
      dueno.motivo = `Avería en ${e.nombre.toLowerCase()}`;
    }
  }
  // Una cámara con una sola sonda y varios evaporadores se llama como la cámara.
  for (const s of servicios) {
    const base = s.clave.replace(/_\d+$/, "");
    if (s.evaporadores.length && servicios.filter((o) => o.clave.replace(/_\d+$/, "") === base).length === 1) s.nombre = s.nombre.replace(/\s*·\s*evaporador\s*\d+$/i, "");
  }
  const orden = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, "es", { numeric: true });
  return { id: p.id, nombre: p.nombre, cliente: null, ubicacion: { id: p.id, nombre: p.nombre }, simulada: p.contacto?.estado.simulado ?? false, entrega, conectada, servicios: servicios.sort(orden), compresores: compresores.sort(orden) };
}

/** Las variables de una instalación: su lista, la que propone el programa y lo que haya llegado sin estar en ninguna. */
export function listaDe(p: Pasarela, ultimas: LecturaOpc[] = []): VariableOpc[] {
  const todas = new Map<string, VariableOpc>();
  for (const v of [...(p.propuesta?.variables ?? []), ...p.variables]) todas.set(v.n, { ...todas.get(v.n), ...v });
  for (const l of ultimas) if (!todas.has(l.v)) todas.set(l.v, { n: l.v });
  return [...todas.values()];
}

/** Las temperaturas de las que hace falta la curva. */
export function variablesDeCurva(p: Pasarela, ultimas: LecturaOpc[]): string[] {
  return listaDe(p, ultimas)
    .map((v) => ({ v: v.n, x: partes(v.n) }))
    .filter((y) => y.x && esTemperatura(y.x.campo) && !/^compresor/i.test(y.x.clave))
    .map((y) => y.v);
}

const GRAVEDAD: Record<Estado, number> = { error: 0, sindatos: 1, aviso: 2, correcto: 3 };
export const porGravedad = (a: { estado: Estado }, b: { estado: Estado }) => GRAVEDAD[a.estado] - GRAVEDAD[b.estado];

/** El estado de toda la instalación y su frase. */
export function resumenDe(i: InstalacionViva): { estado: Estado; titular: string; alarmas: number; avisos: number; mudos: number; bien: number } {
  const cuenta = (e: Estado) => i.servicios.filter((s) => s.estado === e).length;
  const alarmas = cuenta("error");
  const avisos = cuenta("aviso");
  const mudos = cuenta("sindatos");
  const bien = cuenta("correcto");
  const estado: Estado = !i.conectada ? "sindatos" : alarmas ? "error" : mudos ? "sindatos" : avisos ? "aviso" : "correcto";
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const titular = !i.conectada
    ? "La pasarela no entrega"
    : alarmas
      ? plural(alarmas, "servicio en alarma", "servicios en alarma")
      : mudos
        ? plural(mudos, "servicio sin datos", "servicios sin datos")
        : avisos
          ? plural(avisos, "servicio con aviso", "servicios con aviso")
          : "Todo en orden";
  return { estado, titular, alarmas, avisos, mudos, bien };
}

/** Una ubicación con todas sus instalaciones: sus servicios y compresores juntos, para Hoy y Servicios. */
export type UbicacionViva = InstalacionViva & { instalaciones: { id: string; nombre: string; conectada: boolean; entrega: number | null }[] };

export function juntar(insts: InstalacionViva[]): UbicacionViva {
  const [primera] = insts;
  const entregas = insts.map((i) => i.entrega).filter((t): t is number => t !== null);
  return {
    ...primera,
    nombre: primera.ubicacion.nombre,
    simulada: insts.some((i) => i.simulada),
    entrega: entregas.length ? Math.max(...entregas) : null,
    // Conectada si lo están todas: si una se calla, la ubicación entera avisa.
    conectada: insts.every((i) => i.conectada),
    servicios: insts.flatMap((i) => i.servicios),
    compresores: insts.flatMap((i) => (insts.length > 1 ? i.compresores.map((c) => ({ ...c, nombre: `${c.nombre} · ${i.nombre}` })) : i.compresores)),
    instalaciones: insts.map((i) => ({ id: i.id, nombre: i.nombre, conectada: i.conectada, entrega: i.entrega })),
  };
}

/** Las instalaciones agrupadas por cliente y ubicación, en el orden en que llegan. */
export function porUbicacion(insts: InstalacionViva[]): UbicacionViva[] {
  const grupos = new Map<string, InstalacionViva[]>();
  for (const i of insts) {
    const k = `${i.cliente?.id ?? ""}|${i.ubicacion.id}`;
    grupos.set(k, [...(grupos.get(k) ?? []), i]);
  }
  return [...grupos.values()].map(juntar);
}
