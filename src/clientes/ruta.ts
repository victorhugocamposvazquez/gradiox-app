// La hoja de ruta de un cliente en el panel interno: los pasos del alta, en
// orden, y las comprobaciones del seguimiento una vez está en marcha. Nada se
// marca a mano: cada paso se da por hecho mirando lo que hay de verdad en su
// ficha, sus pasarelas y sus usuarios.

import type { Acceso } from "../accesos/modelo";
import type { Pasarela } from "../pasarelas/modelo";
import type { Cliente } from "./modelo";

export type PasoRuta = {
  id: string;
  titulo: string;
  hecho: boolean;
  /** Qué hay o qué falta, en una frase. */
  detalle: string;
  /** Dónde se hace: una pantalla del panel. */
  donde: string;
};
export type Chequeo = { id: string; titulo: string; nivel: "bien" | "mirar" | "mal"; detalle: string; donde: string };
export type Ruta = { alta: PasoRuta[]; hechos: number; siguiente: PasoRuta | null; seguimiento: Chequeo[]; enMarcha: boolean };

const CALLADA_MS = 3 * 60_000;
const DIA = 86_400_000;
const AVANZADAS = new Set(["aceptada", "pedido", "instalando", "leyendo", "incidencia", "parada"]);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const hace = (ms: number) => (ms < 90_000 ? "hace un momento" : ms < 3_600_000 ? `hace ${Math.round(ms / 60_000)} min` : ms < 2 * DIA ? `hace ${Math.round(ms / 3_600_000)} h` : `hace ${Math.round(ms / DIA)} días`);
/** Compara «0.4.1» con «0.10.0» por números, no por letras. */
export const versionMenor = (a: string, b: string) => {
  const [x, y] = [a, b].map((v) => v.split(".").map((n) => Number(n) || 0));
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
};

/**
 * `pasarelas`: las asignadas a este cliente, sin las anuladas. `accesos`: sus
 * usuarios de la app. `publicada`: la última versión del programa por plataforma.
 */
/** Dónde se ve una instalación conectada en ops, y en qué pestaña. */
const aInstalacion = (id: string, pestana?: string) => `/ops/instalaciones/${id}${pestana ? `?pestana=${pestana}` : ""}`;
/** Si el cliente tiene una sola instalación, se va directo a ella; si tiene varias, a la lista. */
const unaOTodas = (pasarelas: { id: string }[], pestana?: string) => (pasarelas.length === 1 ? aInstalacion(pasarelas[0].id, pestana) : "/ops/instalaciones");

export function rutaDe(c: Cliente, pasarelas: Pasarela[], accesos: Acceso[], ahora: number, publicada: Record<string, string> = {}): Ruta {
  const ficha = `/ops/clientes/${c.id}`;
  const insts = c.instalaciones;
  const contacto = c.contacto.nombre && (c.contacto.telefono || c.contacto.correo);
  const visitadas = insts.filter((i) => i.fase !== "sinvisitar");
  const conCamaras = insts.filter((i) => i.puntos.length > 0);
  const conTecnica = insts.filter((i) => i.tecnica.via && i.tecnica.permiso);
  const aceptadas = insts.filter((i) => AVANZADAS.has(i.fase));
  const estrenadas = pasarelas.filter((p) => p.contacto);
  const conLista = pasarelas.filter((p) => p.variables.length > 0);
  const ubicadas = pasarelas.filter((p) => p.ubicacion);
  const activos = accesos.filter((a) => a.activo);
  const hanEntrado = activos.filter((a) => a.ultimo);

  const alta: PasoRuta[] = [
    { id: "empresa", titulo: "Datos de la empresa y persona de contacto", hecho: !!contacto, detalle: contacto ? `Contacto: ${c.contacto.nombre}` : "Falta el nombre del contacto y su teléfono o correo.", donde: `${ficha}?paso=datos` },
    { id: "visita", titulo: "Visita hecha y cámaras apuntadas", hecho: visitadas.length > 0 && conCamaras.length > 0, detalle: !insts.length ? "Todavía no hay ninguna instalación en la ficha." : !visitadas.length ? "Hay instalación apuntada pero sigue como pendiente de visita." : conCamaras.length ? `${plural(insts.length, "instalación", "instalaciones")}, ${plural(insts.reduce((n, i) => n + i.puntos.length, 0), "cámara apuntada", "cámaras apuntadas")}` : "Falta apuntar las cámaras de la instalación.", donde: `${ficha}?paso=instalaciones` },
    { id: "tecnica", titulo: "Ficha técnica: cómo se conecta y con qué permiso", hecho: conTecnica.length > 0, detalle: conTecnica.length ? `Decidido en ${plural(conTecnica.length, "instalación", "instalaciones")}` : "Falta decidir la vía de conexión y si Gradiox solo lee o también da órdenes.", donde: insts[0] ? `${ficha}/naves/${insts[0].id}?pestana=tecnica` : `${ficha}?paso=instalaciones` },
    { id: "aceptada", titulo: "Propuesta aceptada por el cliente", hecho: aceptadas.length > 0 || pasarelas.length > 0, detalle: aceptadas.length || pasarelas.length ? "Aceptada." : "Ninguna instalación ha llegado a «Propuesta aceptada».", donde: `${ficha}?paso=instalaciones` },
    { id: "pasarela", titulo: "Pasarela dada de alta y asignada a este cliente", hecho: pasarelas.length > 0, detalle: pasarelas.length ? pasarelas.map((p) => p.nombre).join(", ") : "Se crea en Instalaciones y se marca como suya en «Acceso a la app».", donde: pasarelas.length ? unaOTodas(pasarelas) : `${ficha}?paso=app` },
    { id: "leyendo", titulo: "Programa instalado en la planta y leyendo el autómata", hecho: estrenadas.length > 0 && estrenadas.length === pasarelas.length, detalle: !pasarelas.length ? "Primero hace falta la pasarela." : estrenadas.length === pasarelas.length ? `Programa ${[...new Set(estrenadas.map((p) => p.contacto!.programa))].join(", ")}` : `${plural(pasarelas.length - estrenadas.length, "pasarela no se ha estrenado", "pasarelas no se han estrenado")}: falta instalar el programa con su token.`, donde: unaOTodas(pasarelas) },
    { id: "variables", titulo: "Lista de variables revisada y aceptada", hecho: pasarelas.length > 0 && conLista.length === pasarelas.length, detalle: !pasarelas.length ? "Primero hace falta la pasarela." : conLista.length === pasarelas.length ? `${plural(pasarelas.reduce((n, p) => n + p.variables.length, 0), "variable", "variables")} en la lista` : "El programa propone una lista: hay que revisarla y aceptarla en la pestaña «Lecturas» de la instalación.", donde: unaOTodas(pasarelas, "lecturas") },
    { id: "ubicacion", titulo: "Cada pasarela en su ubicación (nave o almacén)", hecho: pasarelas.length > 0 && ubicadas.length === pasarelas.length, detalle: !pasarelas.length ? "Primero hace falta la pasarela." : ubicadas.length === pasarelas.length ? "Todas ubicadas." : "Falta elegir la ubicación en «Acceso a la app»: es como la verá el cliente en el selector.", donde: `${ficha}?paso=app` },
    { id: "usuarios", titulo: "Usuarios del cliente creados", hecho: activos.length > 0, detalle: activos.length ? plural(activos.length, "usuario activo", "usuarios activos") : "Nadie de este cliente puede entrar todavía.", donde: `${ficha}?paso=app` },
    { id: "entrada", titulo: "El cliente ha entrado en la app", hecho: hanEntrado.length > 0, detalle: hanEntrado.length ? `${hanEntrado.length} de ${activos.length} han entrado alguna vez` : activos.length ? "Tiene usuario pero no ha entrado nunca: llamarle y entrar juntos." : "Primero hace falta su usuario.", donde: `${ficha}?paso=app` },
  ];
  const hechos = alta.filter((p) => p.hecho).length;

  const seguimiento: Chequeo[] = [];
  for (const p of estrenadas) {
    const k = p.contacto!;
    const de = pasarelas.length > 1 ? ` (${p.nombre})` : "";
    const callada = ahora - k.t > CALLADA_MS;
    seguimiento.push({ id: `entrega-${p.id}`, titulo: `La pasarela entrega${de}`, nivel: callada ? "mal" : "bien", detalle: callada ? `Último contacto ${hace(ahora - k.t)}. Mirar que el ordenador de la planta esté encendido y con internet.` : `Último contacto ${hace(ahora - k.t)}.`, donde: aInstalacion(p.id) });
    if (callada) continue;
    const sinPlc = k.estado.plc !== "conectado";
    seguimiento.push({ id: `plc-${p.id}`, titulo: `Llega al autómata${de}`, nivel: sinPlc ? "mal" : "bien", detalle: sinPlc ? `El programa no llega al autómata: ${k.estado.detalle || "sin detalle"}.` : k.estado.simulado ? "Conectado a un autómata simulado: los valores son de prueba." : "Conectado.", donde: aInstalacion(p.id) });
    if (!sinPlc && k.estado.total > 0) {
      const sin = k.estado.total - k.estado.leidas;
      seguimiento.push({ id: `variables-${p.id}`, titulo: `Variables con valor${de}`, nivel: sin > k.estado.total * 0.1 ? "mirar" : "bien", detalle: `${k.estado.leidas} de ${k.estado.total}${sin > 0 ? `: ${plural(sin, "variable no devuelve", "variables no devuelven")} valor.` : "."}`, donde: aInstalacion(p.id, "lecturas") });
    }
    if (k.estado.pendientes > 0) seguimiento.push({ id: `cola-${p.id}`, titulo: `Lecturas esperando en la planta${de}`, nivel: "mirar", detalle: `${plural(k.estado.pendientes, "lectura guardada", "lecturas guardadas")} en el ordenador sin entregar todavía.`, donde: aInstalacion(p.id) });
    const ultima = publicada[k.plataforma];
    if (ultima) {
      const vieja = versionMenor(k.programa, ultima);
      seguimiento.push({ id: `programa-${p.id}`, titulo: `Programa al día${de}`, nivel: vieja ? "mirar" : "bien", detalle: vieja ? `Lleva la ${k.programa} y está publicada la ${ultima}: se actualiza solo en unos minutos; si no, mirar el ordenador.` : `Versión ${k.programa}.`, donde: aInstalacion(p.id) });
    }
  }
  for (const p of pasarelas) {
    const dias = Math.floor((p.caduca - ahora) / DIA);
    if (dias < 30) seguimiento.push({ id: `token-${p.id}`, titulo: `Token de ${p.nombre}`, nivel: dias < 7 ? "mal" : "mirar", detalle: dias < 0 ? "El token ha caducado: la pasarela ya no puede entregar. Hay que darle uno nuevo." : `Caduca en ${plural(dias, "día", "días")}: hay que renovarlo antes.`, donde: aInstalacion(p.id, "ajustes") });
    if (p.escritura?.activa) seguimiento.push({ id: `ordenes-${p.id}`, titulo: `Órdenes al autómata en ${p.nombre}`, nivel: "mirar", detalle: `Encendidas sobre ${plural(p.escritura.variables.length, "variable", "variables")}. Comprobar que sigue siendo lo acordado con el cliente.`, donde: aInstalacion(p.id, "ordenes") });
  }
  const piden = accesos.filter((a) => a.pideClave);
  if (piden.length) seguimiento.push({ id: "claves", titulo: "Contraseñas pedidas", nivel: "mirar", detalle: `${piden.map((a) => a.nombre || a.usuario).join(", ")} ${piden.length === 1 ? "espera" : "esperan"} una contraseña nueva.`, donde: `${ficha}?paso=app` });
  if (activos.length) {
    const reciente = activos.some((a) => a.ultimo && ahora - a.ultimo < 30 * DIA);
    seguimiento.push({ id: "uso", titulo: "El cliente usa la app", nivel: reciente ? "bien" : "mirar", detalle: reciente ? "Alguien ha entrado en los últimos 30 días." : "Nadie ha entrado en los últimos 30 días: conviene llamar.", donde: `${ficha}?paso=app` });
  }
  if (estrenadas.length) {
    const vencido = c.proximo.fecha && Date.parse(c.proximo.fecha) < ahora - DIA;
    seguimiento.push({ id: "proximo", titulo: "Próximo paso con fecha", nivel: !c.proximo.texto ? "mirar" : vencido ? "mirar" : "bien", detalle: !c.proximo.texto ? "No hay próximo paso apuntado con este cliente." : vencido ? `Vencido: ${c.proximo.texto}` : c.proximo.texto, donde: `${ficha}?paso=resumen` });
  }
  const ORDEN = { mal: 0, mirar: 1, bien: 2 } as const;
  seguimiento.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]);
  return { alta, hechos, siguiente: alta.find((p) => !p.hecho) ?? null, seguimiento, enMarcha: estrenadas.length > 0 };
}
