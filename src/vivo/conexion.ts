// Cómo está conectada de verdad una instalación: lo que dice su pasarela
// (programa, ordenador, autómata, ritmo, variables) y lo que hay apuntado en
// su ficha del panel interno (autómata, vía, permiso, internet). De aquí salen
// la pantalla Conexiones y el «Cómo funciona» de cada cliente: nada de esto
// es un texto fijo, todo viene de lo configurado para esa instalación.

import type { Pasarela } from "../pasarelas/modelo";
import type { InstalacionViva } from "./modelo";
import { fraseSoporte } from "@/clientes/tecnica";

/** Lo que cuenta la pasarela de sí misma y de su configuración. */
export type ConexionViva = {
  /** Versión del programa de la pasarela. Vacío si todavía no se ha estrenado. */
  programa: string;
  /** Ordenador donde corre: «windows-amd64», «darwin-arm64»… */
  plataforma: string;
  /** Si el programa llega al autómata. null si todavía no ha dicho nada. */
  plc: boolean | null;
  /** Lo que dice el programa cuando no llega. */
  detalle: string;
  /** Variables con valor y variables que lee. */
  leidas: number;
  total: number;
  /** Lecturas guardadas en el ordenador esperando a poder entregarse. */
  pendientes: number;
  /** 0 si el ritmo lo pone el propio programa. */
  cadaSegundos: number;
  /** Órdenes al autómata encendidas en el panel y en el programa. */
  ordenes: boolean;
  /** Cuántas variables se pueden escribir. */
  escribibles: number;
  /** Hay tarifa eléctrica apuntada para esta instalación. */
  tarifa: boolean;
};

/** Lo apuntado en la ficha del cliente para la ubicación de esta instalación. */
export type FichaViva = { automata: string; cpu: string; gobierno: string; via: string; permiso: string; internet: string; soporte?: string };

export function conexionDe(p: Pasarela): ConexionViva {
  const e = p.contacto?.estado;
  return {
    programa: p.contacto?.programa ?? "",
    plataforma: p.contacto?.plataforma ?? "",
    plc: e ? e.plc === "conectado" : null,
    detalle: e?.detalle ?? "",
    leidas: e?.leidas ?? 0,
    total: e?.total ?? p.variables.length,
    pendientes: e?.pendientes ?? 0,
    cadaSegundos: p.cadaSegundos,
    ordenes: !!p.escritura?.activa && !!e?.ordenes,
    escribibles: p.escritura?.variables.length ?? 0,
    tarifa: !!p.actua?.tarifa,
  };
}

const ORDENADOR: Record<string, string> = { "darwin-arm64": "un Mac", "darwin-amd64": "un Mac", "windows-amd64": "un ordenador con Windows", "linux-amd64": "un ordenador con Linux" };
export const ordenadorDe = (plataforma: string) => ORDENADOR[plataforma] ?? "un ordenador de la planta";

const VIA: Record<string, string> = { opcua: "OPC UA", "modbus-rtu": "Modbus por cable (RTU)", "modbus-tcp": "Modbus por red (TCP)" };
const INTERNET: Record<string, string> = { cable: "por el cable de red de la empresa", wifi: "por la wifi de la empresa", movil: "con una tarjeta de móvil" };

export type PasoVivo = {
  id: "automata" | "pasarela" | "internet" | "nube" | "avisos" | "ordenes";
  titulo: string;
  texto: string;
  /** Datos concretos de esta instalación. */
  datos: [string, string][];
  /** «bien»: funcionando. «mal»: configurado pero ahora falla. «falta»: todavía no está puesto. */
  estado: "bien" | "mal" | "falta";
  /** Qué pasa ahora mismo, en una frase. */
  ahora: string;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** El recorrido de esta instalación, del autómata a la pantalla, con lo que tiene configurado y cómo está ahora. */
export function recorridoDe(i: InstalacionViva): PasoVivo[] {
  const c = i.conexion;
  const f = i.ficha;
  const automata = f?.automata || f?.cpu || "";
  const via = VIA[f?.via ?? ""] ?? "OPC UA";
  const camaras = plural(i.servicios.length, "servicio", "servicios");
  const compresores = i.compresores.length ? ` y ${plural(i.compresores.length, "compresor", "compresores")}` : "";
  const leyendo = i.conectada && c?.plc !== false;
  const datos = (d: [string, string | false | undefined][]) => d.filter((x): x is [string, string] => !!x[1]);

  return [
    {
      id: "automata",
      titulo: i.simulada ? "Un autómata simulado hace de instalación" : "El autómata de la instalación gobierna el frío",
      texto: i.simulada
        ? `Esta instalación es de prueba: en vez de un autómata (PLC) real hay uno simulado, con ${camaras}${compresores}. Los valores que ves no son de una cámara de verdad; sirven para comprobar todo el recorrido antes de conectar la instalación real.`
        : `${automata ? `El autómata (PLC) ${automata}` : "El autómata (PLC) de la instalación"} ya mide y decide: temperaturas, consignas, desescarches, compresores y alarmas de ${camaras}${compresores}. Gradiox no lo sustituye ni lo reprograma: lee lo que él ya sabe.`,
      datos: datos([
        ["Autómata", i.simulada ? "Simulado" : automata],
        ["Modelo de CPU", !i.simulada && f?.cpu && f.cpu !== automata && f.cpu],
        ["Servicios", String(i.servicios.length)],
        ["Compresores", i.compresores.length > 0 && String(i.compresores.length)],
      ]),
      estado: c?.plc === false ? "mal" : "bien",
      ahora: c?.plc === false ? `El programa no llega al autómata${c.detalle ? `: ${c.detalle}` : ""}.` : c?.plc ? "El autómata contesta." : "Todavía sin noticias del autómata.",
    },
    {
      id: "pasarela",
      titulo: `La pasarela lo lee por ${via}`,
      texto: `La pasarela es ${fraseSoporte(f?.soporte || (c?.plataforma ? "ordenador" : ""), ordenadorDe(c?.plataforma ?? ""))}, en la misma red que el autómata. Le pregunta por ${via}${c?.cadaSegundos ? ` cada ${plural(c.cadaSegundos, "segundo", "segundos")}` : " cada pocos segundos"} y solo anota lo que cambia, más una lectura de control cada 10 minutos.`,
      datos: datos([
        ["Programa", c?.programa && `Versión ${c.programa}`],
        ["Variables que lee", c ? `${c.leidas} de ${c.total} con valor` : undefined],
        ["Ritmo", c?.cadaSegundos ? `Cada ${c.cadaSegundos} s` : undefined],
      ]),
      estado: !c?.programa ? "falta" : leyendo ? "bien" : "mal",
      ahora: !c?.programa ? "El programa todavía no se ha estrenado." : leyendo ? "Leyendo." : "No está entregando lecturas.",
    },
    {
      id: "internet",
      titulo: "Envía las lecturas a Gradiox por internet",
      texto: `Sale ${INTERNET[f?.internet ?? ""] ?? "por la conexión de la planta"}, siempre llamando de dentro hacia fuera: no hay que abrir nada en la red ni dejar entrar a nadie. Si internet se cae, la pasarela sigue leyendo, lo guarda y lo entrega en orden cuando vuelve.`,
      datos: datos([["Guardadas esperando", c && c.pendientes > 0 ? plural(c.pendientes, "lectura", "lecturas") : undefined]]),
      estado: !i.entrega ? "falta" : i.conectada ? "bien" : "mal",
      ahora: !i.entrega ? "Todavía no ha entregado nada." : i.conectada ? "Entregando." : "La pasarela ha dejado de entregar: puede ser internet o el ordenador apagado.",
    },
    {
      id: "nube",
      titulo: "Gradiox guarda cada lectura y la enseña",
      texto: "Todo lo que llega queda guardado con su hora. De ahí salen Hoy y Servicios, con el estado de cada cámara, y los Históricos, para ver qué pasó y cuándo.",
      datos: [],
      estado: i.entrega ? "bien" : "falta",
      ahora: i.entrega ? "Guardando." : "Aún no hay nada guardado.",
    },
    {
      id: "avisos",
      titulo: "Marca lo que se sale de sus límites",
      texto: "Los límites no se inventan aquí: son las alarmas de temperatura alta y baja que ya tiene puestas el autómata en cada cámara. Gradiox avisa en pantalla un grado antes de llegar a la alarma alta, y marca en rojo las averías y las alarmas. Los avisos al móvil y por correo todavía no están encendidos para esta instalación.",
      datos: datos([["Con alarma alta en el autómata", `${i.servicios.filter((s) => s.muyAlta !== null).length} de ${i.servicios.length}`]]),
      estado: "bien",
      ahora: "Vigilando en pantalla.",
    },
    {
      id: "ordenes",
      titulo: c?.ordenes ? "Puede cambiar las consignas elegidas" : "Solo lee: no toca nada",
      texto: c?.ordenes
        ? `Además de leer, Gradiox puede escribir en ${plural(c.escribibles, "variable elegida", "variables elegidas")} del autómata, y en ninguna más. Hace falta doble llave: activarlo en Gradiox y en el propio programa de la planta. Cada orden queda en los Históricos con quién la dio.`
        : `Gradiox no puede cambiar nada en el autómata. ${f?.permiso === "ordenes" ? "Está hablado dar órdenes más adelante, sobre variables elegidas y con doble llave: activarlo en Gradiox y en el programa de la planta." : "Dar órdenes (por ejemplo ajustar consignas según el precio de la luz) es un paso aparte que se activa con doble llave, en Gradiox y en el programa de la planta."}`,
      datos: datos([["Tarifa eléctrica", c?.tarifa ? "Apuntada" : undefined]]),
      estado: c?.ordenes ? "bien" : "falta",
      ahora: c?.ordenes ? "Órdenes encendidas." : "Órdenes apagadas.",
    },
  ];
}
