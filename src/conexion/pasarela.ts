// El programa de la pasarela: lee cada equipo con su perfil y entrega las
// medidas a la nube. Si la nube no responde, las guarda y las entrega en orden
// cuando vuelve, para que no queden huecos en el histórico.

import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { ClienteModbus } from "./modbus";
import { leerEquipo, type LecturaEquipo, type Perfil } from "./perfil";

export type Equipo = { id: string; host: string; puerto: number; unidad: number; perfil: Perfil };

export type Medida = {
  equipo: string;
  t: number;
  /** null cuando el equipo no ha respondido en este ciclo. */
  lectura: LecturaEquipo | null;
  /** Por qué no hay lectura, en texto. */
  error?: string;
};

export type OpcionesPasarela = {
  equipos: Equipo[];
  /** Entrega un lote a la nube. Si rechaza, el lote se conserva. */
  enviar: (lote: Medida[]) => Promise<void>;
  /** Cuántas medidas caben guardadas sin nube. Al llenarse se pierden las más antiguas. */
  capacidad?: number;
  /** Milisegundos que se espera a cada equipo. */
  plazo?: number;
  /** Cuántas medidas van en cada entrega. La nube no admite envíos enormes. */
  tanda?: number;
  /** Archivo donde se conserva lo no entregado, para que sobreviva a un reinicio de la pasarela. */
  disco?: string;
};

/** Medidas por entrega si no se indica otra cosa. Por debajo del máximo que admite la nube. */
export const TANDA = 1000;

export class Pasarela {
  private cola: Medida[] = [];
  private clientes = new Map<string, ClienteModbus>();
  /** Medidas descartadas por llenarse la memoria sin nube. */
  perdidas = 0;

  /** Líneas que hay en el archivo de disco. */
  private enDisco = 0;

  constructor(private opciones: OpcionesPasarela) {
    const { disco } = opciones;
    if (!disco || !existsSync(disco)) return;
    // Lo que quedó sin entregar antes del reinicio. Una línea a medias por un apagón se descarta.
    for (const linea of readFileSync(disco, "utf8").split("\n")) {
      if (!linea) continue;
      try {
        this.cola.push(JSON.parse(linea) as Medida);
      } catch {
        // Línea cortada: se ignora.
      }
    }
    this.recortar();
    this.reescribir();
  }

  /** Medidas guardadas a la espera de nube. */
  get pendientes() {
    return this.cola.length;
  }

  private recortar() {
    const capacidad = this.opciones.capacidad ?? 100_000;
    if (this.cola.length <= capacidad) return;
    this.perdidas += this.cola.length - capacidad;
    this.cola = this.cola.slice(-capacidad);
  }

  /** Deja el archivo igual que la cola. Primero en un archivo aparte, para no quedarse a medias. */
  private reescribir() {
    const { disco } = this.opciones;
    if (!disco) return;
    try {
      if (!this.cola.length) rmSync(disco, { force: true });
      else {
        writeFileSync(`${disco}.nuevo`, this.cola.map((m) => `${JSON.stringify(m)}\n`).join(""));
        renameSync(`${disco}.nuevo`, disco);
      }
      this.enDisco = this.cola.length;
    } catch {
      // Sin disco se sigue trabajando con la memoria.
    }
  }

  /** Apunta en el disco lo que ha cambiado en este ciclo, escribiendo lo menos posible. */
  private conservar(nuevas: Medida[], entregadas: number) {
    const { disco } = this.opciones;
    if (!disco) return;
    // Con nube y sin nada pendiente no se toca el disco: es lo normal y así no se gasta.
    if (!this.cola.length && !this.enDisco) return;
    const capacidad = this.opciones.capacidad ?? 100_000;
    if (entregadas || this.enDisco + nuevas.length > capacidad * 1.5) return this.reescribir();
    try {
      appendFileSync(disco, nuevas.map((m) => `${JSON.stringify(m)}\n`).join(""));
      this.enDisco += nuevas.length;
    } catch {
      // Ver arriba.
    }
  }

  private async cliente(e: Equipo): Promise<ClienteModbus> {
    const hay = this.clientes.get(e.id);
    if (hay) return hay;
    const nuevo = new ClienteModbus(e.host, e.puerto, this.opciones.plazo ?? 2000);
    await nuevo.conectar();
    this.clientes.set(e.id, nuevo);
    return nuevo;
  }

  private async medir(e: Equipo, t: number): Promise<Medida> {
    try {
      const c = await this.cliente(e);
      return { equipo: e.id, t, lectura: await leerEquipo(c, e.unidad, e.perfil, t) };
    } catch (error) {
      // Se suelta la conexión para volver a intentarla entera en el ciclo siguiente.
      this.clientes.get(e.id)?.cerrar();
      this.clientes.delete(e.id);
      return { equipo: e.id, t, lectura: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** Un ciclo: lee todos los equipos e intenta entregar todo lo pendiente. Devuelve si la nube lo ha recibido todo. */
  async ciclo(t = Date.now()): Promise<boolean> {
    const nuevas: Medida[] = [];
    for (const e of this.opciones.equipos) nuevas.push(await this.medir(e, t));
    this.cola.push(...nuevas);
    this.recortar();
    // Por tandas y en orden, de la más antigua a la más reciente. Si una falla, el resto espera.
    const tanda = this.opciones.tanda ?? TANDA;
    let entregadas = 0;
    let conNube = true;
    while (this.cola.length) {
      const lote = this.cola.slice(0, tanda);
      try {
        await this.opciones.enviar(lote);
      } catch {
        conNube = false;
        break;
      }
      this.cola = this.cola.slice(lote.length);
      entregadas += lote.length;
    }
    this.conservar(nuevas, entregadas);
    return conNube;
  }

  cerrar() {
    for (const c of this.clientes.values()) c.cerrar();
    this.clientes.clear();
  }
}

/** Entrega por internet a la nube de Gradiox. La conexión siempre sale de la pasarela. */
export function enviarPorHttp(url: string, pasarela: string, clave: string, pedir: typeof fetch = fetch): OpcionesPasarela["enviar"] {
  return async (lote) => {
    const r = await pedir(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${clave}`, "x-gradiox-pasarela": pasarela },
      body: JSON.stringify({ medidas: lote }),
    });
    if (!r.ok) throw new Error(`La nube ha respondido ${r.status}`);
  };
}
