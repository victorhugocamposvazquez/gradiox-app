// El programa que corre dentro de la pasarela: lee su configuración, sondea
// los equipos al ritmo indicado y entrega las medidas a la nube.

import { Pasarela, enviarPorHttp, type Equipo, type Medida } from "./pasarela";
import { PERFILES } from "./perfiles";
import { PERFIL_BANCO } from "./perfiles/banco";
import { ControladorSimulado } from "./simulador";

export type Configuracion = { pasarela: string; nube: string; cadaSegundos: number; equipos: Equipo[] };

const texto = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const entero = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Comprueba el archivo de configuración. Si algo no vale, dice qué con palabras. */
export function leerConfiguracion(contenido: string, perfiles = PERFILES): Configuracion {
  let c: Record<string, unknown>;
  try {
    c = JSON.parse(contenido);
  } catch {
    throw new Error("El archivo de configuración no es JSON válido");
  }
  if (typeof c !== "object" || c === null) throw new Error("El archivo de configuración no es JSON válido");
  if (!texto(c.pasarela) || !/^[a-z0-9-]{1,60}$/.test(c.pasarela)) throw new Error("«pasarela» debe ser un identificador en minúsculas, con números y guiones");
  if (!texto(c.nube) || !/^https?:\/\//.test(c.nube)) throw new Error("«nube» debe ser la dirección de entrada de lecturas, por ejemplo https://gradiox.com/api/ingesta");
  const cada = c.cadaSegundos ?? 30;
  if (!entero(cada, 1, 3600)) throw new Error("«cadaSegundos» debe ser un número entre 1 y 3600");
  if (!Array.isArray(c.equipos)) throw new Error("Falta la lista «equipos»");
  const vistos = new Set<string>();
  const equipos = c.equipos.map((bruto: unknown, i: number): Equipo => {
    const e = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
    const quien = texto(e.id) ? `El equipo «${e.id}»` : `El equipo ${i + 1}`;
    if (!texto(e.id) || e.id.length > 80) throw new Error(`${quien} no tiene «id»`);
    if (vistos.has(e.id)) throw new Error(`Hay dos equipos con el id «${e.id}»`);
    vistos.add(e.id);
    if (!texto(e.host)) throw new Error(`${quien} no tiene «host», su dirección en la red`);
    const puerto = e.puerto ?? 502;
    if (!entero(puerto, 1, 65535)) throw new Error(`${quien} tiene un «puerto» que no es válido`);
    const unidad = e.unidad ?? 1;
    if (!entero(unidad, 0, 255)) throw new Error(`${quien} tiene una «unidad» que no es válida (0 a 255)`);
    const perfil = texto(e.perfil) ? perfiles[e.perfil] : undefined;
    if (!perfil) throw new Error(`${quien} pide el perfil «${String(e.perfil)}», que no existe. Perfiles disponibles: ${Object.keys(perfiles).join(", ")}`);
    return { id: e.id, host: e.host, puerto, unidad, perfil };
  });
  return { pasarela: c.pasarela, nube: c.nube, cadaSegundos: cada, equipos };
}

export type OpcionesPrograma = {
  clave: string;
  /** Añade un controlador simulado en este mismo equipo, para probar sin instalación. */
  simulado?: boolean;
  registrar?: (linea: string) => void;
  enviar?: (lote: Medida[]) => Promise<void>;
};

/** Pone la pasarela a trabajar. Devuelve cómo pararla y cómo forzar un ciclo. */
export async function arrancarPrograma(config: Configuracion, opciones: OpcionesPrograma) {
  const registrar = opciones.registrar ?? (() => {});
  const equipos = [...config.equipos];
  let simulado: ControladorSimulado | null = null;
  if (opciones.simulado) {
    simulado = new ControladorSimulado();
    const puerto = await simulado.arrancar();
    equipos.push({ id: "camara-simulada", host: "127.0.0.1", puerto, unidad: 1, perfil: PERFIL_BANCO });
    registrar("Controlador simulado en marcha: no es un equipo real");
  }
  if (!equipos.length) throw new Error("No hay ningún equipo que leer");
  const pasarela = new Pasarela({ equipos, enviar: opciones.enviar ?? enviarPorHttp(config.nube, config.pasarela, opciones.clave) });
  let anterior = Date.now();
  let ocupado = false;
  let conNube: boolean | null = null;

  const ciclo = async (t = Date.now()) => {
    if (ocupado) return;
    ocupado = true;
    try {
      simulado?.avanzar(Math.max(0, t - anterior) / 60_000);
      anterior = t;
      const entregado = await pasarela.ciclo(t);
      // Solo se escribe cuando cambia algo, para no llenar el registro.
      if (entregado !== conNube) registrar(entregado ? `Entregando a la nube (${equipos.length} ${equipos.length === 1 ? "equipo" : "equipos"} cada ${config.cadaSegundos} s)` : "La nube no responde: las lecturas se guardan aquí y se entregarán al volver");
      else if (!entregado && pasarela.pendientes % 100 === 0) registrar(`Sin nube: ${pasarela.pendientes} lecturas guardadas`);
      conNube = entregado;
    } finally {
      ocupado = false;
    }
  };
  await ciclo();
  const reloj = setInterval(() => void ciclo(), config.cadaSegundos * 1000);
  return {
    ciclo,
    get pendientes() {
      return pasarela.pendientes;
    },
    async parar() {
      clearInterval(reloj);
      pasarela.cerrar();
      await simulado?.apagar();
    },
  };
}
