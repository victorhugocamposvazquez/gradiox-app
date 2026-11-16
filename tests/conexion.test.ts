import { afterEach, describe, expect, it } from "vitest";
import { ClienteModbus, ErrorModbus } from "../src/conexion/modbus";
import { escribirConsigna, leerEquipo } from "../src/conexion/perfil";
import { PERFIL_BANCO } from "../src/conexion/perfiles/banco";
import { Pasarela, type Medida } from "../src/conexion/pasarela";
import { ControladorSimulado } from "../src/conexion/simulador";

const abiertos: { apagar?: () => Promise<void>; cerrar?: () => void }[] = [];
afterEach(async () => {
  for (const a of abiertos.splice(0)) {
    a.cerrar?.();
    await a.apagar?.();
  }
});

async function banco(inicio: ConstructorParameters<typeof ControladorSimulado>[0] = {}) {
  const equipo = new ControladorSimulado(inicio);
  const puerto = await equipo.arrancar();
  const cliente = new ClienteModbus("127.0.0.1", puerto, 500);
  await cliente.conectar();
  abiertos.push(equipo, cliente);
  return { equipo, puerto, cliente };
}

describe("lectura por Modbus con un perfil", () => {
  it("lee del equipo lo mismo que marca, con temperaturas bajo cero", async () => {
    const { equipo, cliente } = await banco({ temperatura: -24.7, consigna: -25, puerta: true });
    equipo.avanzar(1);
    const l = await leerEquipo(cliente, 1, PERFIL_BANCO, 1000);
    expect(l.t).toBe(1000);
    // El equipo da décimas: la lectura no puede alejarse más de media décima de lo que marca.
    expect(Math.abs((l.temperatura ?? 99) - equipo.estado.temperatura)).toBeLessThanOrEqual(0.051);
    expect(l.consigna).toBe(-25);
    expect(l.puerta).toBe(true);
    expect(l.compresor).toBe(equipo.estado.compresor);
    expect(l.desescarche).toBe(false);
  });

  it("el termostato simulado mantiene la cámara cerca de la consigna", async () => {
    const { equipo } = await banco({ temperatura: -15, consigna: -20 });
    equipo.avanzar(120);
    expect(equipo.estado.temperatura).toBeGreaterThanOrEqual(-20.2);
    expect(equipo.estado.temperatura).toBeLessThanOrEqual(-17.8);
  });

  it("con el compresor averiado la temperatura sube y el equipo da alarma", async () => {
    const { equipo, cliente } = await banco({ temperatura: -20, consigna: -20, compresorAveriado: true });
    equipo.avanzar(60);
    const l = await leerEquipo(cliente, 1, PERFIL_BANCO);
    expect(l.compresor).toBe(false);
    expect(l.temperatura).toBeGreaterThan(-14);
    expect(l.alarma).toBe(true);
  });

  it("una dirección que no existe vuelve como error claro", async () => {
    const { cliente } = await banco();
    await expect(cliente.leer(1, "retencion", 40)).rejects.toThrow("Esa dirección no existe en el equipo");
  });
});

describe("cambio de consigna", () => {
  it("escribe, comprueba y el equipo queda con la consigna nueva", async () => {
    const { equipo, cliente } = await banco({ consigna: -20 });
    await escribirConsigna(cliente, 1, PERFIL_BANCO, -22.5);
    expect(equipo.estado.consigna).toBe(-22.5);
  });

  it("se niega a salir del rango del perfil sin llegar a escribir", async () => {
    const { equipo, cliente } = await banco({ consigna: -20 });
    await expect(escribirConsigna(cliente, 1, PERFIL_BANCO, 15)).rejects.toThrow("fuera del rango permitido");
    expect(equipo.estado.consigna).toBe(-20);
  });

  it("avisa si el equipo rechaza un valor que el perfil sí permitía", async () => {
    const { equipo, cliente } = await banco({ consigna: -20 });
    await expect(escribirConsigna(cliente, 1, PERFIL_BANCO, -29)).rejects.toBeInstanceOf(ErrorModbus);
    expect(equipo.estado.consigna).toBe(-20);
  });
});

describe("pasarela", () => {
  it("guarda las medidas sin nube y las entrega en orden cuando vuelve", async () => {
    const { equipo, puerto } = await banco({ temperatura: -20, consigna: -20 });
    const recibidas: Medida[] = [];
    let nube = false;
    const pasarela = new Pasarela({
      equipos: [{ id: "camara-1", host: "127.0.0.1", puerto, unidad: 1, perfil: PERFIL_BANCO }],
      enviar: async (lote) => {
        if (!nube) throw new Error("sin internet");
        recibidas.push(...lote);
      },
      plazo: 500,
    });
    abiertos.push(pasarela);
    for (const t of [1000, 2000, 3000]) {
      equipo.avanzar(1);
      expect(await pasarela.ciclo(t)).toBe(false);
    }
    expect(pasarela.pendientes).toBe(3);
    expect(recibidas).toHaveLength(0);
    nube = true;
    expect(await pasarela.ciclo(4000)).toBe(true);
    expect(pasarela.pendientes).toBe(0);
    expect(recibidas.map((m) => m.t)).toEqual([1000, 2000, 3000, 4000]);
    expect(recibidas.every((m) => m.lectura !== null)).toBe(true);
  });

  it("un equipo apagado sale como sin datos y los demás se siguen leyendo; al volver, se recupera", async () => {
    const a = await banco({ temperatura: 2, consigna: 2 });
    const b = await banco({ temperatura: -20, consigna: -20 });
    const recibidas: Medida[] = [];
    const pasarela = new Pasarela({
      equipos: [
        { id: "fresco", host: "127.0.0.1", puerto: a.puerto, unidad: 1, perfil: PERFIL_BANCO },
        { id: "congelado", host: "127.0.0.1", puerto: b.puerto, unidad: 1, perfil: PERFIL_BANCO },
      ],
      enviar: async (lote) => void recibidas.push(...lote),
      plazo: 500,
    });
    abiertos.push(pasarela);
    await pasarela.ciclo(1000);
    await b.equipo.apagar();
    await pasarela.ciclo(2000);
    await b.equipo.arrancar(b.puerto);
    await pasarela.ciclo(3000);
    const de = (id: string) => recibidas.filter((m) => m.equipo === id).map((m) => m.lectura !== null);
    expect(de("fresco")).toEqual([true, true, true]);
    expect(de("congelado")).toEqual([true, false, true]);
    expect(recibidas.find((m) => m.equipo === "congelado" && m.t === 2000)?.error).toBeTruthy();
  });

  it("sin nube mucho tiempo, conserva lo más reciente y cuenta lo perdido", async () => {
    const { puerto } = await banco();
    const pasarela = new Pasarela({
      equipos: [{ id: "camara-1", host: "127.0.0.1", puerto, unidad: 1, perfil: PERFIL_BANCO }],
      enviar: async () => {
        throw new Error("sin internet");
      },
      capacidad: 3,
      plazo: 500,
    });
    abiertos.push(pasarela);
    for (let t = 1; t <= 5; t++) await pasarela.ciclo(t * 1000);
    expect(pasarela.pendientes).toBe(3);
    expect(pasarela.perdidas).toBe(2);
  });
});
