// La ficha técnica de una instalación: qué gobierna el frío, cómo se conecta
// Gradiox, con qué permiso y qué señales se leen. Es lo que cambia de un
// cliente a otro. No guarda contraseñas: solo si el acceso está pedido o creado.

import type { Instalacion } from "./modelo";

export const GOBIERNO = {
  "": "Sin saber",
  automata: "Un autómata (PLC) para todo",
  controladores: "Un controlador en cada cámara",
  mixto: "Autómata (PLC) y controladores sueltos",
} as const;
export type Gobierno = keyof typeof GOBIERNO;

export const VIAS = {
  "": "Sin decidir",
  opcua: "Por red, al autómata (OPC UA)",
  "modbus-rtu": "Por cable, a cada controlador (Modbus RTU)",
  "modbus-tcp": "Por red, a cada equipo (Modbus TCP)",
  otra: "Otra (explicarla al final)",
} as const;
export type Via = keyof typeof VIAS;
export const VIA_CORTA: Record<Via, string> = { "": "Sin decidir", opcua: "OPC UA", "modbus-rtu": "Modbus por cable", "modbus-tcp": "Modbus por red", otra: "Otra" };

export const ACCESOS = { "": "Sin saber", usuario: "Con usuario y contraseña", certificado: "Con certificado", abierto: "Abierto, sin clave (anónimo)" } as const;
export type Acceso = keyof typeof ACCESOS;

export const USUARIOS = { "": "Sin pedir", pedido: "Pedido, esperando", creado: "Creado" } as const;
export type UsuarioGradiox = keyof typeof USUARIOS;

export const PERMISOS = { "": "Sin hablar", leer: "Solo leer", ordenes: "Leer y dar órdenes (lectura y escritura)" } as const;
export type Permiso = keyof typeof PERMISOS;

/** Dónde corre la pasarela en esta instalación. Se elige en cada una: no es igual para todos. */
export const SOPORTES = { "": "Sin decidir", aparato: "Un aparato de Gradiox (lo ponemos nosotros)", ordenador: "Un ordenador del cliente (programa instalado)" } as const;
export type Soporte = keyof typeof SOPORTES;
/** Cómo se nombra la pasarela en una frase, según lo elegido. */
export const fraseSoporte = (s: Soporte | string | undefined, ordenador = "un ordenador de la planta") =>
  s === "aparato" ? "un aparato de Gradiox puesto en la planta" : s === "ordenador" ? `un programa de Gradiox instalado en ${ordenador}` : `un programa de Gradiox, que va en un aparato nuestro o en ${ordenador}`;

export const ENCHUFAR = { "": "Sin preguntar", si: "Sí", no: "No" } as const;
export type Enchufar = keyof typeof ENCHUFAR;

export const TIPOS_SENAL = { temperatura: "Temperatura", alarma: "Alarma", estado: "Estado (marcha/paro)", consigna: "Consigna (setpoint)", otra: "Otra" } as const;
export type TipoSenal = keyof typeof TIPOS_SENAL;

/** Un dato que se lee del equipo: su nombre tal como está allí, qué es y de qué cámara. */
export type Senal = { id: string; nombre: string; tipo: TipoSenal; punto: string; escribe: boolean; nota: string };

/** Los datos de la ficha sobre los que se puede dejar un comentario desde el enlace. La clave vacía es el formulario entero. */
export const CAMPOS_COMENTARIO = {
  "": "El formulario en general",
  gobierno: "Tipo de sistema de control (arquitectura)",
  via: "Vía de conexión (protocolo)",
  direccion: "Dirección del servidor o del equipo",
  acceso: "Cómo se entra (autenticación)",
  usuario: "Usuario de solo lectura para Gradiox",
  senales: "Variables (señales)",
  documentos: "Documentos",
  automata: "Autómata (PLC)",
  cpu: "Modelo exacto de la CPU y versión (firmware)",
  programador: "Persona de contacto (quien programa el autómata)",
  permiso: "Qué podrá hacer Gradiox (permisos)",
  enchufar: "Conectar un equipo a la red de control",
  internet: "Salida a internet",
  informatica: "Quién lleva la informática",
  observaciones: "Observaciones",
} as const;
export type CampoComentario = keyof typeof CAMPOS_COMENTARIO;

/** Una corrección o sugerencia sobre un dato del formulario, escrita por quien lo rellena desde el enlace. Una por dato. */
export type Comentario = { id: string; campo: CampoComentario; texto: string; t: number; resuelto: boolean };
export const MAX_COMENTARIO = 1000;

export type Tecnica = {
  gobierno: Gobierno;
  /** Modelo exacto de la CPU del autómata y su versión. */
  cpu: string;
  via: Via;
  /** Dirección del equipo en la red del cliente y puerto. */
  direccion: string;
  acceso: Acceso;
  usuario: UsuarioGradiox;
  permiso: Permiso;
  enchufar: Enchufar;
  soporte: Soporte;
  notas: string;
  /** Lo que quiera añadir quien rellena la ficha desde el enlace. */
  observaciones: string;
  senales: Senal[];
  comentarios: Comentario[];
  /** Clave del enlace para rellenar la ficha desde fuera del panel. Vacía, el enlace está apagado. */
  enlace: string;
  /** Cuándo se rellenó por última vez desde el enlace. Lo pone el servidor. */
  externa: number;
  /** Cuándo pulsó «Enviar» por última vez quien la rellena desde el enlace. Lo pone el servidor. */
  enviada: number;
};

export const MAX_SENALES = 500;
const ID = /^[0-9a-f-]{36}$/;
const instante = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
const esId = (v: unknown): v is string => typeof v === "string" && ID.test(v);
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clave = <T extends string>(v: unknown, mapa: Record<T, string>, porDefecto: T): T => (typeof v === "string" && v in mapa ? (v as T) : porDefecto);

const ENLACE = /^[A-Za-z0-9_-]{43}$/;
export const esEnlace = (v: unknown): v is string => typeof v === "string" && ENLACE.test(v);
/** Una clave nueva para el enlace: 32 bytes al azar, imposible de adivinar. */
export function nuevoEnlace(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const tecnicaVacia = (): Tecnica => ({ gobierno: "", cpu: "", via: "", direccion: "", acceso: "", usuario: "", permiso: "", enchufar: "", soporte: "", notas: "", observaciones: "", senales: [], comentarios: [], enlace: "", externa: 0, enviada: 0 });
export const senalVacia = (nombre = ""): Senal => ({ id: crypto.randomUUID(), nombre, tipo: "temperatura", punto: "", escribe: false, nota: "" });

function validarComentarios(v: unknown): Comentario[] {
  const vistos = new Set<string>();
  const lista: Comentario[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const c = objeto(x);
    const campo = clave<CampoComentario>(c.campo, CAMPOS_COMENTARIO, "");
    const textoComentario = texto(c.texto, MAX_COMENTARIO);
    if (!textoComentario || vistos.has(campo)) continue;
    vistos.add(campo);
    lista.push({ id: esId(c.id) ? c.id : crypto.randomUUID(), campo, texto: textoComentario, t: instante(c.t), resuelto: c.resuelto === true });
  }
  return lista;
}

/** Los datos de texto libre de la ficha: un comentario sobre uno de ellos puede pasar a ser el dato. */
const DATO_DE_COMENTARIO: Partial<Record<CampoComentario, "direccion" | "cpu" | "automata" | "programador" | "informatica">> = {
  direccion: "direccion",
  cpu: "cpu",
  automata: "automata",
  programador: "programador",
  informatica: "informatica",
};
const MAX_DATO = 240;
const MAX_NOTAS = 8000;

/** Adónde iría un comentario al pasarlo a la ficha: al dato, si está vacío y el texto cabe; si no, a las notas técnicas. */
export function destinoComentario(i: Instalacion, c: Comentario): "dato" | "notas" {
  const dato = DATO_DE_COMENTARIO[c.campo];
  if (!dato || c.texto.length > MAX_DATO) return "notas";
  const actual = dato === "direccion" || dato === "cpu" ? i.tecnica[dato] : i[dato];
  return actual.trim() ? "notas" : "dato";
}

/**
 * Da por bueno lo que dice un comentario: lo escribe en su dato o, si el dato ya tiene valor
 * (nunca se pisa) o no es de texto libre, lo añade a las notas técnicas. El comentario queda resuelto.
 */
export function pasarComentario(i: Instalacion, id: string): Partial<Instalacion> {
  const c = i.tecnica.comentarios.find((x) => x.id === id);
  if (!c) return {};
  const comentarios = i.tecnica.comentarios.map((x) => (x.id === id ? { ...x, resuelto: true } : x));
  const dato = DATO_DE_COMENTARIO[c.campo];
  if (dato && destinoComentario(i, c) === "dato") {
    if (dato === "direccion" || dato === "cpu") return { tecnica: { ...i.tecnica, [dato]: c.texto, comentarios } };
    return { [dato]: c.texto, tecnica: { ...i.tecnica, comentarios } };
  }
  const linea = `${CAMPOS_COMENTARIO[c.campo]}: ${c.texto} (dicho por el técnico)`;
  if (i.tecnica.notas.includes(linea)) return { tecnica: { ...i.tecnica, comentarios } };
  const notas = [i.tecnica.notas.trim(), linea].filter(Boolean).join("\n").slice(0, MAX_NOTAS);
  return { tecnica: { ...i.tecnica, notas, comentarios } };
}

/**
 * Los comentarios que llegan del enlace: el que no cambia conserva su fecha y si está resuelto;
 * el que cambia vuelve a quedar pendiente. Desde el enlace no se puede dar nada por resuelto.
 */
export function comentariosDeEnlace(antes: Comentario[], llegan: Comentario[], t: number): Comentario[] {
  return llegan.map((c) => {
    const previo = antes.find((x) => x.campo === c.campo);
    return previo && previo.texto === c.texto ? previo : { id: previo?.id ?? c.id, campo: c.campo, texto: c.texto, t, resuelto: false };
  });
}

export function validarTecnica(v: unknown): Tecnica {
  const t = objeto(v);
  return {
    gobierno: clave(t.gobierno, GOBIERNO, ""),
    cpu: texto(t.cpu, 240),
    via: clave(t.via, VIAS, ""),
    direccion: texto(t.direccion, 240),
    acceso: clave(t.acceso, ACCESOS, ""),
    usuario: clave(t.usuario, USUARIOS, ""),
    permiso: clave(t.permiso, PERMISOS, ""),
    enchufar: clave(t.enchufar, ENCHUFAR, ""),
    soporte: clave(t.soporte, SOPORTES, ""),
    notas: texto(t.notas, 8000),
    observaciones: texto(t.observaciones, 8000),
    enlace: esEnlace(t.enlace) ? t.enlace : "",
    externa: instante(t.externa),
    enviada: instante(t.enviada),
    comentarios: validarComentarios(t.comentarios),
    senales: (Array.isArray(t.senales) ? t.senales.slice(0, MAX_SENALES) : []).map((x): Senal => {
      const s = objeto(x);
      return { id: esId(s.id) ? s.id : crypto.randomUUID(), nombre: texto(s.nombre, 160), tipo: clave(s.tipo, TIPOS_SENAL, "otra"), punto: esId(s.punto) ? s.punto : "", escribe: s.escribe === true, nota: texto(s.nota, 240) };
    }),
  };
}

const tipoDeSenal = (n: string): TipoSenal =>
  /alarm|fallo|aver|(^|[_.\s])al_/i.test(n) ? "alarma" : /consigna|setpoint|\bsp\b|_sp/i.test(n) ? "consigna" : /temp|°c|\bt_|sonda|\btt\d/i.test(n) ? "temperatura" : /estado|marcha|paro|run|on_off|compres|desescarche|refrigeracion/i.test(n) ? "estado" : "otra";

// Por orden de preferencia: el nombre en el autómata antes que el nombre en la pantalla.
const COLUMNAS_NOMBRE = [/^plc ?tag/i, /^(variable|nodeid|node ?id)/i, /^(name|nombre|tag|se[ñn]al)/i];
const COLUMNA_NOTA = /^(qu[ée] |descripci|comment|comentario|nota)/i;

/**
 * Las líneas pegadas de una lista se convierten en señales; el tipo se adivina por el nombre y se puede corregir.
 * Si viene de una hoja de cálculo con cabecera, se busca la columna del nombre de la variable y la de su descripción;
 * si no, se toma la primera columna.
 */
export function senalesDeTexto(pegado: string): Senal[] {
  const filas = pegado.split(/\r?\n/).map((l) => l.split(/[\t;]/).map((c) => c.trim())).filter((f) => f.some(Boolean));
  if (!filas.length) return [];
  const cabecera = filas[0];
  const nombreEn = cabecera.length > 1 ? COLUMNAS_NOMBRE.map((r) => cabecera.findIndex((c) => r.test(c))).find((n) => n >= 0) ?? -1 : -1;
  const hayCabecera = nombreEn >= 0;
  const notaEn = hayCabecera ? cabecera.findIndex((c) => COLUMNA_NOTA.test(c)) : -1;
  const vistos = new Set<string>();
  const lista: Senal[] = [];
  for (const f of hayCabecera ? filas.slice(1) : filas) {
    const nombre = (f[hayCabecera ? nombreEn : 0] ?? "").slice(0, 160);
    if (!nombre || vistos.has(nombre)) continue;
    vistos.add(nombre);
    const nota = notaEn >= 0 ? (f[notaEn] ?? "").slice(0, 240) : "";
    lista.push({ ...senalVacia(nombre), tipo: tipoDeSenal(`${nombre} ${nota}`), nota });
    if (lista.length >= MAX_SENALES) break;
  }
  return lista;
}

export type FaltaTecnica = { texto: string; campo: string };

/** Lo que falta por saber para poder conectar esta instalación. Depende de lo que haya: no se pide lo que no aplica. */
export function faltaTecnica(i: Instalacion): FaltaTecnica[] {
  const t = i.tecnica;
  const lista: FaltaTecnica[] = [];
  const falta = (textoFalta: string, campo: string) => lista.push({ texto: textoFalta, campo });
  if (!t.gobierno) falta("Qué gobierna el frío: un autómata o controladores sueltos", "gobierno");
  const conAutomata = t.gobierno === "automata" || t.gobierno === "mixto";
  const conControladores = t.gobierno === "controladores" || t.gobierno === "mixto";
  if (conAutomata) {
    if (!i.automata) falta("Marca y modelo del autómata", "automata");
    if (!t.cpu) falta("Modelo exacto de la CPU y su versión (firmware)", "cpu");
    if (!i.programador) falta("Quién programa el autómata", "programador");
  }
  if (conControladores) {
    const sin = i.puntos.filter((p) => !p.controlador).length;
    if (i.puntos.length === 0) falta("Apuntar las cámaras y sus controladores", "camaras");
    else if (sin) falta(`Marca y modelo del controlador de ${sin === 1 ? "una cámara" : `${sin} cámaras`}`, "camaras");
  }
  if (!t.via) falta("Por qué vía se conecta Gradiox (protocolo)", "via");
  if ((t.via === "opcua" || t.via === "modbus-tcp") && !t.direccion) falta(t.via === "opcua" ? "Dirección del servidor (endpoint OPC UA)" : "Dirección del equipo en la red (IP y puerto)", "direccion");
  if (t.via === "opcua") {
    if (!t.acceso) falta("Cómo se entra (autenticación): usuario, certificado o abierto", "acceso");
    if (t.acceso !== "abierto" && t.usuario !== "creado") falta(t.usuario === "pedido" ? "Que creen el usuario de solo lectura para Gradiox (ya pedido)" : "Pedir un usuario de solo lectura para Gradiox", "usuario");
    if (t.senales.length === 0) falta("Lista de señales (variables) que se pueden leer", "senales");
  }
  if (!t.permiso) falta("Si Gradiox solo lee o también da órdenes", "permiso");
  if (!t.enchufar) falta("Si se puede enchufar el aparato a la red de los equipos (red de control)", "enchufar");
  if (!i.internet) falta("Si hay internet en la sala", "internet");
  return lista;
}

/** La conexión dicha en una frase, para entenderla de un vistazo. */
export function fraseConexion(i: Instalacion): string {
  const t = i.tecnica;
  const automata = i.automata ? ` ${i.automata}` : "";
  if (t.via === "opcua") return `Gradiox lee del autómata${automata} por OPC UA, por la red de la planta.`;
  if (t.via === "modbus-rtu") return "Gradiox lee de cada controlador por Modbus, con un cable de dos hilos.";
  if (t.via === "modbus-tcp") return "Gradiox lee de los equipos por Modbus, por la red de la planta.";
  if (t.via === "otra") return "La conexión es especial: está explicada en las notas.";
  if (t.gobierno === "automata" || t.gobierno === "mixto") return `Hay un autómata${automata} que lo gobierna. Falta decidir por dónde se lee.`;
  if (t.gobierno === "controladores") return "Hay un controlador en cada cámara. Falta decidir por dónde se leen.";
  return "Todavía no se sabe cómo se conecta esta instalación.";
}

export type ResumenTecnica = { id: string; nombre: string; via: Via; gobierno: Gobierno; faltan: number; senales: number; puntos: number; enviada: number; comentarios: number };
export const resumirTecnica = (i: Instalacion, n: number): ResumenTecnica => ({ id: i.id, nombre: i.nombre || `Instalación ${n + 1}`, via: i.tecnica.via, gobierno: i.tecnica.gobierno, faltan: faltaTecnica(i).length, senales: i.tecnica.senales.length, puntos: i.puntos.length, enviada: i.tecnica.enviada, comentarios: i.tecnica.comentarios.filter((c) => !c.resuelto).length });
