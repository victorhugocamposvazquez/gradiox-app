// El programa de la pasarela: lee cada equipo con su perfil y entrega las
// medidas a la nube. Si la nube no responde, las guarda y las entrega en orden
// cuando vuelve, para que no queden huecos en el histórico.

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
};

export class Pasarela {
  private cola: Medida[] = [];
  private clientes = new Map<string, ClienteModbus>();
  /** Medidas descartadas por llenarse la memoria sin nube. */
  perdidas = 0;

  constructor(private opciones: OpcionesPasarela) {}

  /** Medidas guardadas a la espera de nube. */
  get pendientes() {
    return this.cola.length;
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

  /** Un ciclo: lee todos los equipos e intenta entregar todo lo pendiente. Devuelve si la nube lo ha recibido. */
  async ciclo(t = Date.now()): Promise<boolean> {
    for (const e of this.opciones.equipos) this.cola.push(await this.medir(e, t));
    const capacidad = this.opciones.capacidad ?? 100_000;
    if (this.cola.length > capacidad) {
      this.perdidas += this.cola.length - capacidad;
      this.cola = this.cola.slice(-capacidad);
    }
    const lote = this.cola.slice();
    try {
      await this.opciones.enviar(lote);
    } catch {
      return false;
    }
    this.cola = this.cola.slice(lote.length);
    return true;
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
