// Modbus TCP mínimo, sin dependencias: lo justo para leer y escribir en un
// controlador y para levantar uno simulado en el banco de pruebas.
// Solo se usa en el servidor y en la pasarela, nunca en el navegador.

import net from "node:net";

/** Las cuatro tablas de datos de Modbus. */
export type Tabla = "bobina" | "discreta" | "retencion" | "entrada";

const LEER: Record<Tabla, number> = { bobina: 1, discreta: 2, retencion: 3, entrada: 4 };
const TABLA_DE: Record<number, Tabla> = { 1: "bobina", 2: "discreta", 3: "retencion", 4: "entrada" };
const ESCRIBIR_REGISTRO = 6;

export class ErrorModbus extends Error {
  constructor(
    mensaje: string,
    /** Código de excepción que devolvió el equipo, si lo hubo. */
    readonly codigo?: number,
  ) {
    super(mensaje);
    this.name = "ErrorModbus";
  }
}

const EXCEPCIONES: Record<number, string> = {
  1: "El equipo no admite esa función",
  2: "Esa dirección no existe en el equipo",
  3: "El equipo rechaza ese valor",
  4: "El equipo ha fallado al atender la petición",
};

function trama(id: number, unidad: number, pdu: Buffer): Buffer {
  const cabecera = Buffer.alloc(7);
  cabecera.writeUInt16BE(id, 0);
  cabecera.writeUInt16BE(0, 2);
  cabecera.writeUInt16BE(pdu.length + 1, 4);
  cabecera.writeUInt8(unidad, 6);
  return Buffer.concat([cabecera, pdu]);
}

/** Separa las tramas completas que haya en `acumulado` y devuelve lo que sobra. */
function partir(acumulado: Buffer): { tramas: { id: number; unidad: number; pdu: Buffer }[]; resto: Buffer } {
  const tramas: { id: number; unidad: number; pdu: Buffer }[] = [];
  let resto = acumulado;
  while (resto.length >= 7) {
    const largo = resto.readUInt16BE(4);
    if (resto.length < 6 + largo) break;
    tramas.push({ id: resto.readUInt16BE(0), unidad: resto.readUInt8(6), pdu: resto.subarray(7, 6 + largo) });
    resto = resto.subarray(6 + largo);
  }
  return { tramas, resto };
}

type Espera = { resolver: (pdu: Buffer) => void; rechazar: (e: Error) => void; reloj: NodeJS.Timeout };

export class ClienteModbus {
  private conexion: net.Socket | null = null;
  private acumulado: Buffer = Buffer.alloc(0);
  private siguiente = 1;
  private esperas = new Map<number, Espera>();

  constructor(
    readonly host: string,
    readonly puerto: number,
    /** Milisegundos que se espera cada respuesta. */
    readonly plazo = 2000,
  ) {}

  conectar(): Promise<void> {
    return new Promise((resolver, rechazar) => {
      const c = net.createConnection({ host: this.host, port: this.puerto });
      const fallo = (e: Error) => rechazar(new ErrorModbus(`No se puede conectar con ${this.host}:${this.puerto}: ${e.message}`));
      c.once("error", fallo);
      c.once("connect", () => {
        c.off("error", fallo);
        c.on("error", (e) => this.soltar(new ErrorModbus(`Se ha cortado la conexión: ${e.message}`)));
        c.on("close", () => this.soltar(new ErrorModbus("Se ha cerrado la conexión")));
        c.on("data", (trozo: Buffer) => this.recibir(trozo));
        this.conexion = c;
        resolver();
      });
    });
  }

  cerrar() {
    this.conexion?.destroy();
    this.conexion = null;
  }

  private soltar(e: Error) {
    for (const espera of this.esperas.values()) {
      clearTimeout(espera.reloj);
      espera.rechazar(e);
    }
    this.esperas.clear();
    this.conexion = null;
  }

  private recibir(trozo: Buffer) {
    const { tramas, resto } = partir(Buffer.concat([this.acumulado, trozo]));
    this.acumulado = resto;
    for (const t of tramas) {
      const espera = this.esperas.get(t.id);
      if (!espera) continue;
      this.esperas.delete(t.id);
      clearTimeout(espera.reloj);
      espera.resolver(t.pdu);
    }
  }

  private pedir(unidad: number, pdu: Buffer): Promise<Buffer> {
    const c = this.conexion;
    if (!c) return Promise.reject(new ErrorModbus("No hay conexión con el equipo"));
    const id = this.siguiente;
    this.siguiente = (this.siguiente % 0xffff) + 1;
    return new Promise<Buffer>((resolver, rechazar) => {
      const reloj = setTimeout(() => {
        this.esperas.delete(id);
        rechazar(new ErrorModbus("El equipo no ha respondido a tiempo"));
      }, this.plazo);
      this.esperas.set(id, { resolver, rechazar, reloj });
      c.write(trama(id, unidad, pdu));
    }).then((respuesta) => {
      const funcion = respuesta.readUInt8(0);
      if (funcion & 0x80) {
        const codigo = respuesta.readUInt8(1);
        throw new ErrorModbus(EXCEPCIONES[codigo] ?? `El equipo ha devuelto el error ${codigo}`, codigo);
      }
      return respuesta;
    });
  }

  /** Lee `cantidad` posiciones seguidas. Las bobinas y entradas discretas vuelven como 0 o 1. */
  async leer(unidad: number, tabla: Tabla, direccion: number, cantidad = 1): Promise<number[]> {
    const pdu = Buffer.alloc(5);
    pdu.writeUInt8(LEER[tabla], 0);
    pdu.writeUInt16BE(direccion, 1);
    pdu.writeUInt16BE(cantidad, 3);
    const r = await this.pedir(unidad, pdu);
    const datos = r.subarray(2);
    const out: number[] = [];
    for (let i = 0; i < cantidad; i++) {
      if (tabla === "bobina" || tabla === "discreta") out.push((datos.readUInt8(i >> 3) >> (i & 7)) & 1);
      else out.push(datos.readUInt16BE(i * 2));
    }
    return out;
  }

  /** Escribe un registro de retención. `valor` va sin signo, de 0 a 65535. */
  async escribirRegistro(unidad: number, direccion: number, valor: number): Promise<void> {
    const pdu = Buffer.alloc(5);
    pdu.writeUInt8(ESCRIBIR_REGISTRO, 0);
    pdu.writeUInt16BE(direccion, 1);
    pdu.writeUInt16BE(valor & 0xffff, 3);
    await this.pedir(unidad, pdu);
  }
}

/** Lo que tiene que ofrecer un equipo para atenderse por Modbus. */
export type Memoria = {
  /** Valor de una posición, o undefined si no existe. */
  leer(tabla: Tabla, direccion: number): number | undefined;
  /** Escribe un registro de retención. Devuelve false si no se puede. */
  escribir(direccion: number, valor: number): boolean;
};

function excepcion(funcion: number, codigo: number): Buffer {
  return Buffer.from([funcion | 0x80, codigo]);
}

function atender(pdu: Buffer, memoria: Memoria): Buffer {
  const funcion = pdu.readUInt8(0);
  const tabla = TABLA_DE[funcion];
  if (tabla) {
    const direccion = pdu.readUInt16BE(1);
    const cantidad = pdu.readUInt16BE(3);
    const valores: number[] = [];
    for (let i = 0; i < cantidad; i++) {
      const v = memoria.leer(tabla, direccion + i);
      if (v === undefined) return excepcion(funcion, 2);
      valores.push(v);
    }
    if (tabla === "bobina" || tabla === "discreta") {
      const bytes = Buffer.alloc(Math.ceil(cantidad / 8));
      valores.forEach((v, i) => {
        if (v) bytes[i >> 3] |= 1 << (i & 7);
      });
      return Buffer.concat([Buffer.from([funcion, bytes.length]), bytes]);
    }
    const bytes = Buffer.alloc(cantidad * 2);
    valores.forEach((v, i) => bytes.writeUInt16BE(v & 0xffff, i * 2));
    return Buffer.concat([Buffer.from([funcion, bytes.length]), bytes]);
  }
  if (funcion === ESCRIBIR_REGISTRO) {
    const direccion = pdu.readUInt16BE(1);
    if (memoria.leer("retencion", direccion) === undefined) return excepcion(funcion, 2);
    return memoria.escribir(direccion, pdu.readUInt16BE(3)) ? pdu : excepcion(funcion, 3);
  }
  return excepcion(funcion, 1);
}

/** Levanta un equipo Modbus TCP que responde con lo que diga `memoria`. Con puerto 0 elige uno libre. */
export function servidorModbus(memoria: Memoria, puerto = 0): Promise<{ puerto: number; cerrar: () => Promise<void> }> {
  const abiertas = new Set<net.Socket>();
  const servidor = net.createServer((c) => {
    abiertas.add(c);
    let acumulado: Buffer = Buffer.alloc(0);
    c.on("data", (trozo: Buffer) => {
      const { tramas, resto } = partir(Buffer.concat([acumulado, trozo]));
      acumulado = resto;
      for (const t of tramas) c.write(trama(t.id, t.unidad, atender(t.pdu, memoria)));
    });
    c.on("error", () => c.destroy());
    c.on("close", () => abiertas.delete(c));
  });
  return new Promise((resolver, rechazar) => {
    servidor.once("error", rechazar);
    servidor.listen(puerto, "127.0.0.1", () => {
      const direccion = servidor.address();
      resolver({
        puerto: typeof direccion === "object" && direccion ? direccion.port : puerto,
        cerrar: () =>
          new Promise<void>((hecho) => {
            for (const c of abiertas) c.destroy();
            servidor.close(() => hecho());
          }),
      });
    });
  });
}
