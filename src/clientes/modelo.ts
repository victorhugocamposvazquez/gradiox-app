// Clientes de Gradiox: las empresas a las que se visita y se instala. Es la zona
// interna, no la ven los clientes. Cada cliente es una ficha con sus
// instalaciones y, dentro de cada una, sus puntos de frío. Las fotos van aparte.

export const ESTADOS = {
  posible: "Posible cliente",
  visitado: "Visitado",
  propuesta: "Propuesta enviada",
  piloto: "En piloto",
  activo: "Cliente activo",
  pausa: "En pausa",
  baja: "Baja",
} as const;
export type EstadoCliente = keyof typeof ESTADOS;
/** Color de la etiqueta de cada estado. */
export const TONO: Record<EstadoCliente, string> = { posible: "neutro", visitado: "azul", propuesta: "azul", piloto: "aviso", activo: "correcto", pausa: "neutro", baja: "neutro" };

export const INTERNET = {
  "": "Sin mirar",
  cable: "Llega cable de red",
  wifi: "Solo wifi",
  movil: "Solo cobertura de móvil",
  ninguno: "No hay internet ni cobertura",
} as const;
export type Internet = keyof typeof INTERNET;

/** Por dónde va una instalación, desde antes de la visita hasta que está leyendo. */
export const FASES = {
  sinvisitar: "Pendiente de visita",
  visitada: "Visitada",
  propuesta: "Propuesta enviada",
  aceptada: "Propuesta aceptada",
  pedido: "Aparato pedido",
  instalando: "Instalación en curso",
  leyendo: "Instalada y leyendo",
  incidencia: "Con incidencia",
  parada: "Parada",
} as const;
export type Fase = keyof typeof FASES;
export const TONO_FASE: Record<Fase, string> = { sinvisitar: "neutro", visitada: "azul", propuesta: "azul", aceptada: "azul", pedido: "aviso", instalando: "aviso", leyendo: "correcto", incidencia: "error", parada: "neutro" };

export const CONEXION_APARATO = { "": "Sin decidir", cable: "Cable de red del cliente", movil: "Tarjeta de móvil propia" } as const;
export type ConexionAparato = keyof typeof CONEXION_APARATO;

/** El aparato de Gradiox puesto en una instalación. */
export type Aparato = { modelo: string; serie: string; pasarela: string; instalado: string; conexion: ConexionAparato; tarjeta: string; notas: string };
export const aparatoVacio = (): Aparato => ({ modelo: "", serie: "", pasarela: "", instalado: "", conexion: "", tarjeta: "", notas: "" });

/** Una línea del registro de lo hecho con un cliente. Las automáticas las escribe el servidor al cambiar un estado. */
export type Apunte = { id: string; t: number; texto: string; auto: boolean };
const MAX_HISTORIAL = 500;

export const SOLO_LECTURA = { "": "Sin preguntar", si: "Sí, empezar solo mirando", no: "No, quiere actuar desde el principio", duda: "Lo tiene que pensar" } as const;
export type SoloLectura = keyof typeof SOLO_LECTURA;

export const TIPOS_FOTO = {
  controlador: "Controlador, de frente",
  etiqueta: "Etiqueta del controlador",
  cuadro: "Cuadro eléctrico",
  sitio: "Sitio para el aparato",
  sistema: "Sistema que ya tienen",
  otra: "Otra",
} as const;
export type TipoFoto = keyof typeof TIPOS_FOTO;

export type PuntoFrio = { id: string; nombre: string; guarda: string; temperatura: string; controlador: string; notas: string };

export type Instalacion = {
  id: string;
  nombre: string;
  direccion: string;
  internet: Internet;
  cobertura: string;
  sitioAparato: string;
  sistemaActual: string;
  informatica: string;
  notas: string;
  fase: Fase;
  aparato: Aparato;
  puntos: PuntoFrio[];
};

export type DatosCliente = {
  nombre: string;
  razon: string;
  nif: string;
  actividad: string;
  direccion: string;
  estado: EstadoCliente;
  contacto: { nombre: string; cargo: string; telefono: string; correo: string };
  mantenedor: { nombre: string; telefono: string };
  visita: { fecha: string; preocupa: string; comoSeEntera: string; soloLectura: SoloLectura; otras: string };
  notas: string;
  /** Lo siguiente que hay que hacer con este cliente, y para cuándo. */
  proximo: { texto: string; fecha: string };
  historial: Apunte[];
  instalaciones: Instalacion[];
};

export type Cliente = DatosCliente & { id: string; creado: number; actualizado: number };
export type Aviso = { nivel: "mal" | "mirar"; texto: string };
export type ResumenCliente = { id: string; nombre: string; estado: EstadoCliente; direccion: string; instalaciones: number; puntos: number; fotos: number; actualizado: number; fases: Fase[]; proximo: { texto: string; fecha: string }; avisos: Aviso[] };
/** Lo último que ha entregado cada aparato, por su identificador de pasarela. */
export type Lecturas = Record<string, { ultima: number; equipos: number }>;
export type Foto = { id: string; cliente: string; instalacion: string; punto: string; tipo: TipoFoto; pie: string; mime: string; tamano: number; creada: number };
export type DatosFoto = Pick<Foto, "instalacion" | "punto" | "tipo" | "pie">;

export const MAX_FOTO = 4 * 1024 * 1024;
export const MIMES_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAX_INSTALACIONES = 20;
const MAX_PUNTOS = 200;

export const nuevoId = () => crypto.randomUUID();
const ID = /^[0-9a-f-]{36}$/;
export const esId = (v: unknown): v is string => typeof v === "string" && ID.test(v);

const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clave = <T extends string>(v: unknown, mapa: Record<T, string>, porDefecto: T): T => (typeof v === "string" && v in mapa ? (v as T) : porDefecto);
const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);

const dia = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
function validarAparato(v: unknown): Aparato {
  const a = objeto(v);
  // El identificador es el que usa el aparato al entregar lecturas: minúsculas, números y guiones.
  return { modelo: texto(a.modelo, 120), serie: texto(a.serie, 120), pasarela: texto(a.pasarela, 120).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60), instalado: dia(a.instalado), conexion: clave(a.conexion, CONEXION_APARATO, ""), tarjeta: texto(a.tarjeta, 120), notas: texto(a.notas, 2000) };
}

export const instalacionVacia = (nombre = ""): Instalacion => ({ id: nuevoId(), nombre, direccion: "", internet: "", cobertura: "", sitioAparato: "", sistemaActual: "", informatica: "", notas: "", fase: "sinvisitar", aparato: aparatoVacio(), puntos: [] });
export const puntoVacio = (): PuntoFrio => ({ id: nuevoId(), nombre: "", guarda: "", temperatura: "", controlador: "", notas: "" });
export const clienteVacio = (): DatosCliente => ({
  nombre: "",
  razon: "",
  nif: "",
  actividad: "",
  direccion: "",
  estado: "posible",
  contacto: { nombre: "", cargo: "", telefono: "", correo: "" },
  mantenedor: { nombre: "", telefono: "" },
  visita: { fecha: "", preocupa: "", comoSeEntera: "", soloLectura: "", otras: "" },
  notas: "",
  proximo: { texto: "", fecha: "" },
  historial: [],
  instalaciones: [],
});

/** Limpia lo que llega del navegador: solo los campos conocidos, con su largo máximo. */
export function validarCliente(cuerpo: unknown): DatosCliente | { error: string } {
  const c = objeto(cuerpo);
  const nombre = texto(c.nombre, 120);
  if (!nombre) return { error: "Falta el nombre del cliente" };
  const contacto = objeto(c.contacto);
  const mantenedor = objeto(c.mantenedor);
  const visita = objeto(c.visita);
  const proximo = objeto(c.proximo);
  let puntos = 0;
  const instalaciones = lista(c.instalaciones, MAX_INSTALACIONES).map((x): Instalacion => {
    const i = objeto(x);
    return {
      id: esId(i.id) ? i.id : nuevoId(),
      nombre: texto(i.nombre, 120),
      direccion: texto(i.direccion, 240),
      internet: clave(i.internet, INTERNET, ""),
      cobertura: texto(i.cobertura, 240),
      sitioAparato: texto(i.sitioAparato, 2000),
      sistemaActual: texto(i.sistemaActual, 2000),
      informatica: texto(i.informatica, 240),
      notas: texto(i.notas, 4000),
      fase: clave(i.fase, FASES, "sinvisitar"),
      aparato: validarAparato(i.aparato),
      puntos: lista(i.puntos, MAX_PUNTOS).map((y): PuntoFrio => {
        const p = objeto(y);
        puntos++;
        return { id: esId(p.id) ? p.id : nuevoId(), nombre: texto(p.nombre, 120), guarda: texto(p.guarda, 240), temperatura: texto(p.temperatura, 60), controlador: texto(p.controlador, 240), notas: texto(p.notas, 2000) };
      }),
    };
  });
  if (puntos > MAX_PUNTOS) return { error: `Demasiados puntos de frío en una ficha (máximo ${MAX_PUNTOS})` };
  return {
    nombre,
    razon: texto(c.razon, 160),
    nif: texto(c.nif, 20),
    actividad: texto(c.actividad, 240),
    direccion: texto(c.direccion, 240),
    estado: clave(c.estado, ESTADOS, "posible"),
    contacto: { nombre: texto(contacto.nombre, 120), cargo: texto(contacto.cargo, 120), telefono: texto(contacto.telefono, 40), correo: texto(contacto.correo, 160) },
    mantenedor: { nombre: texto(mantenedor.nombre, 160), telefono: texto(mantenedor.telefono, 40) },
    visita: { fecha: dia(visita.fecha), preocupa: texto(visita.preocupa, 4000), comoSeEntera: texto(visita.comoSeEntera, 4000), soloLectura: clave(visita.soloLectura, SOLO_LECTURA, ""), otras: texto(visita.otras, 4000) },
    notas: texto(c.notas, 8000),
    proximo: { texto: texto(proximo.texto, 240), fecha: dia(proximo.fecha) },
    historial: lista(c.historial, MAX_HISTORIAL).flatMap((x): Apunte[] => {
      const a = objeto(x);
      const t = texto(a.texto, 2000);
      return t && typeof a.t === "number" && Number.isFinite(a.t) ? [{ id: esId(a.id) ? a.id : nuevoId(), t: a.t, texto: t, auto: a.auto === true }] : [];
    }),
    instalaciones,
  };
}

export function validarDatosFoto(cuerpo: unknown): DatosFoto {
  const f = objeto(cuerpo);
  return { instalacion: esId(f.instalacion) ? f.instalacion : "", punto: esId(f.punto) ? f.punto : "", tipo: clave(f.tipo, TIPOS_FOTO, "otra"), pie: texto(f.pie, 240) };
}

/** Una ficha guardada con una versión anterior del modelo se completa al leerla. */
export function completar(datos: unknown): DatosCliente {
  const v = validarCliente(datos);
  return "error" in v ? { ...clienteVacio(), nombre: "Cliente sin nombre" } : v;
}

export const apunte = (textoApunte: string, t: number, auto = false): Apunte => ({ id: nuevoId(), t, texto: textoApunte.trim().slice(0, 2000), auto });
export const conApuntes = (historial: Apunte[], nuevos: Apunte[]) => [...historial, ...nuevos].slice(-MAX_HISTORIAL);

/** Lo que el servidor apunta solo en el registro al guardar una ficha: cambios de estado, de fase y de instalaciones. */
export function cambios(antes: DatosCliente, ahora: DatosCliente, t: number): Apunte[] {
  const lineas: string[] = [];
  if (antes.estado !== ahora.estado) lineas.push(`El cliente pasa de «${ESTADOS[antes.estado]}» a «${ESTADOS[ahora.estado]}».`);
  const nombre = (i: Instalacion, n: number) => i.nombre || `Instalación ${n + 1}`;
  ahora.instalaciones.forEach((i, n) => {
    const previa = antes.instalaciones.find((x) => x.id === i.id);
    if (!previa) return lineas.push(`Se añade la instalación «${nombre(i, n)}».`);
    if (previa.fase !== i.fase) lineas.push(`«${nombre(i, n)}» pasa de «${FASES[previa.fase]}» a «${FASES[i.fase]}».`);
    if (previa.aparato.pasarela !== i.aparato.pasarela && i.aparato.pasarela) lineas.push(`«${nombre(i, n)}» queda enlazada al aparato ${i.aparato.pasarela}.`);
  });
  antes.instalaciones.forEach((i, n) => {
    if (!ahora.instalaciones.some((x) => x.id === i.id)) lineas.push(`Se quita la instalación «${nombre(i, n)}».`);
  });
  return lineas.map((l) => apunte(l, t, true));
}

/** Minutos sin lecturas a partir de los cuales un aparato que debería estar leyendo se da por callado. */
export const SILENCIO_MIN = 15;
const hoy = (t: number) => new Date(t).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/** Lo que pide atención en un cliente: lo que falla primero y lo que conviene mirar después. */
export function avisos(c: DatosCliente, fotos: number, lecturas: Lecturas, t: number): Aviso[] {
  const lista: Aviso[] = [];
  c.instalaciones.forEach((i, n) => {
    const nombre = i.nombre || `Instalación ${n + 1}`;
    if (i.fase === "incidencia") lista.push({ nivel: "mal", texto: `${nombre}: con incidencia` });
    if (i.fase === "leyendo") {
      const l = i.aparato.pasarela ? lecturas[i.aparato.pasarela] : undefined;
      if (!i.aparato.pasarela) lista.push({ nivel: "mirar", texto: `${nombre}: falta enlazar el aparato para ver si lee` });
      else if (!l) lista.push({ nivel: "mal", texto: `${nombre}: el aparato no ha entregado ninguna lectura` });
      else if (t - l.ultima > SILENCIO_MIN * 60_000) lista.push({ nivel: "mal", texto: `${nombre}: sin lecturas desde hace ${haceCuanto(t - l.ultima)}` });
    }
  });
  if (c.proximo.texto && c.proximo.fecha && c.proximo.fecha < hoy(t)) lista.push({ nivel: "mal", texto: `Paso atrasado: ${c.proximo.texto}` });
  else if (c.proximo.texto && c.proximo.fecha === hoy(t)) lista.push({ nivel: "mirar", texto: `Para hoy: ${c.proximo.texto}` });
  const viva = c.estado !== "baja" && c.estado !== "pausa";
  if (viva && !c.proximo.texto) lista.push({ nivel: "mirar", texto: "Sin próximo paso apuntado" });
  if (viva && c.estado !== "posible" && fotos === 0) lista.push({ nivel: "mirar", texto: "Sin fotos de la visita" });
  return lista.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "mal" ? -1 : 1));
}

export function haceCuanto(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} días`;
}

export const resumir = (c: Cliente, fotos: number, lecturas: Lecturas = {}, t = Date.now()): ResumenCliente => ({
  id: c.id,
  nombre: c.nombre,
  estado: c.estado,
  direccion: c.direccion,
  instalaciones: c.instalaciones.length,
  puntos: c.instalaciones.reduce((n, i) => n + i.puntos.length, 0),
  fotos,
  actualizado: c.actualizado,
  fases: c.instalaciones.map((i) => i.fase),
  proximo: c.proximo,
  avisos: avisos(c, fotos, lecturas, t),
});
