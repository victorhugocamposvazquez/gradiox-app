// Controlador de cámara simulado que habla Modbus TCP con el mapa de
// PERFIL_BANCO. Hace de equipo real en el banco de pruebas: tiene su
// termostato, se le puede abrir la puerta, parar el compresor o apagarlo.

import { servidorModbus, type Memoria, type Tabla } from "./modbus";

export type EstadoSimulado = {
  temperatura: number;
  consigna: number;
  compresor: boolean;
  puerta: boolean;
  desescarche: boolean;
  /** Avería: el compresor no arranca aunque el termostato lo pida. */
  compresorAveriado: boolean;
};

const DIFERENCIAL = 2;
/** Grados por minuto que gana la cámara con el compresor parado, y con la puerta abierta. */
const GANA = 0.15;
const GANA_PUERTA = 0.6;
/** Grados por minuto que baja con el compresor en marcha. */
const BAJA = 0.5;
/** Grados por encima de la consigna a partir de los cuales el equipo da alarma. */
const MARGEN_ALARMA = 6;

const sinSigno = (v: number) => (v < 0 ? v + 0x10000 : v) & 0xffff;

export class ControladorSimulado {
  estado: EstadoSimulado;
  private servidor: { puerto: number; cerrar: () => Promise<void> } | null = null;

  constructor(inicio: Partial<EstadoSimulado> = {}) {
    this.estado = { temperatura: -20, consigna: -20, compresor: false, puerta: false, desescarche: false, compresorAveriado: false, ...inicio };
  }

  get alarma() {
    return this.estado.temperatura > this.estado.consigna + MARGEN_ALARMA;
  }

  /** Hace pasar `minutos` de funcionamiento. */
  avanzar(minutos: number) {
    const e = this.estado;
    for (let i = 0; i < Math.round(minutos * 6); i++) {
      if (e.temperatura >= e.consigna + DIFERENCIAL) e.compresor = true;
      if (e.temperatura <= e.consigna) e.compresor = false;
      if (e.compresorAveriado || e.desescarche) e.compresor = false;
      const porMinuto = (e.compresor ? -BAJA : GANA) + (e.puerta ? GANA_PUERTA : 0);
      e.temperatura = Math.round((e.temperatura + porMinuto / 6) * 1000) / 1000;
    }
  }

  private memoria: Memoria = {
    leer: (tabla: Tabla, direccion: number) => {
      const e = this.estado;
      if (tabla === "entrada" && direccion === 0) return sinSigno(Math.round(e.temperatura * 10));
      if (tabla === "retencion" && direccion === 0) return sinSigno(Math.round(e.consigna * 10));
      if (tabla === "discreta") return [e.compresor, e.puerta, e.desescarche, this.alarma].map(Number).at(direccion);
      return undefined;
    },
    escribir: (direccion: number, valor: number) => {
      if (direccion !== 0) return false;
      const consigna = (valor > 0x7fff ? valor - 0x10000 : valor) / 10;
      // El propio equipo tiene su rango, más estrecho que el del perfil a propósito
      // para poder probar que la pasarela detecta una orden no aceptada.
      if (consigna < -28 || consigna > 10) return false;
      this.estado.consigna = consigna;
      return true;
    },
  };

  async arrancar(puerto = 0): Promise<number> {
    this.servidor = await servidorModbus(this.memoria, puerto);
    return this.servidor.puerto;
  }

  /** Apaga el equipo: deja de responder, como un corte de alimentación o de cable. */
  async apagar() {
    await this.servidor?.cerrar();
    this.servidor = null;
  }
}
