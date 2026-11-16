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
  instalaciones: Instalacion[];
};

export type Cliente = DatosCliente & { id: string; creado: number; actualizado: number };
export type ResumenCliente = { id: string; nombre: string; estado: EstadoCliente; direccion: string; instalaciones: number; puntos: number; fotos: number; actualizado: number };
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

export const instalacionVacia = (nombre = ""): Instalacion => ({ id: nuevoId(), nombre, direccion: "", internet: "", cobertura: "", sitioAparato: "", sistemaActual: "", informatica: "", notas: "", puntos: [] });
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
  const fecha = texto(visita.fecha, 10);
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
    visita: { fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "", preocupa: texto(visita.preocupa, 4000), comoSeEntera: texto(visita.comoSeEntera, 4000), soloLectura: clave(visita.soloLectura, SOLO_LECTURA, ""), otras: texto(visita.otras, 4000) },
    notas: texto(c.notas, 8000),
    instalaciones,
  };
}

export function validarDatosFoto(cuerpo: unknown): DatosFoto {
  const f = objeto(cuerpo);
  return { instalacion: esId(f.instalacion) ? f.instalacion : "", punto: esId(f.punto) ? f.punto : "", tipo: clave(f.tipo, TIPOS_FOTO, "otra"), pie: texto(f.pie, 240) };
}

export const resumir = (c: Cliente, fotos: number): ResumenCliente => ({
  id: c.id,
  nombre: c.nombre,
  estado: c.estado,
  direccion: c.direccion,
  instalaciones: c.instalaciones.length,
  puntos: c.instalaciones.reduce((n, i) => n + i.puntos.length, 0),
  fotos,
  actualizado: c.actualizado,
});
