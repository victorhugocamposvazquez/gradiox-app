import { afterAll, describe, expect, it } from "vitest";
import { almacenEnMemoria, type Almacen } from "../src/conexion/almacen";
import { almacenPostgres } from "../src/conexion/almacen-postgres";
import type { Medida } from "../src/conexion/pasarela";
import { arrancarPrograma, leerConfiguracion } from "../src/conexion/programa";
import { resumenLecturas } from "../src/conexion/resumen";
import { direccionBase } from "../src/conexion/servidor";

// Las mismas pruebas para los dos almacenes. El de base de datos solo se prueba
// si GRADIOX_PRUEBA_BASE_URL apunta a un Postgres de pruebas: nunca a uno real.
const urlPrueba = process.env.GRADIOX_PRUEBA_BASE_URL;
const medida = (equipo: string, t: number, temperatura?: number): Medida => (temperatura === undefined ? { equipo, t, lectura: null, error: "No responde" } : { equipo, t, lectura: { t, temperatura, compresor: true } });

function contrato(nombre: string, crear: () => Promise<Almacen>) {
  describe(`almacén ${nombre}`, () => {
    it("guarda, no duplica un reenvío y devuelve la serie en orden", async () => {
      const a = await crear();
      await a.guardar("p1", [medida("c2", 2000, -19), medida("c1", 1000, -20), medida("c1", 2000, -20.5)]);
      await a.guardar("p1", [medida("c1", 2000, -99), medida("c1", 3000)]);
      expect((await a.serie("p1", "c1", 0)).map((m) => [m.t, m.lectura?.temperatura])).toEqual([[1000, -20], [2000, -20.5], [3000, undefined]]);
      expect((await a.serie("p1", "c1", 2000)).length).toBe(2);
      expect((await a.serie("p1", "c1", 0))[2]).toEqual({ equipo: "c1", t: 3000, lectura: null, error: "No responde" });
    });

    it("da la última de cada equipo y separa las pasarelas", async () => {
      const a = await crear();
      await a.guardar("p1", [medida("c1", 1000, -20), medida("c1", 2000, -21), medida("c2", 1500, 3)]);
      await a.guardar("p2", [medida("c1", 9000, 5)]);
      expect((await a.ultimas("p1")).map((m) => [m.equipo, m.t])).toEqual([["c1", 2000], ["c2", 1500]]);
      expect(await a.pasarelas()).toEqual([{ id: "p1", ultima: 2000, equipos: 2 }, { id: "p2", ultima: 9000, equipos: 1 }]);
      expect(await a.ultimas("ninguna")).toEqual([]);
    });

    it("el resumen para la pantalla trae la última medida y la temperatura de la última hora", async () => {
      const a = await crear();
      const fin = 10 * 3_600_000;
      await a.guardar("p1", [medida("c1", fin - 2 * 3_600_000, -10), ...Array.from({ length: 200 }, (_, i) => medida("c1", fin - (199 - i) * 10_000, -20 - i / 100))]);
      const r = await resumenLecturas(a, true);
      expect(r).toMatchObject({ abierta: true, guardado: a.tipo });
      const e = r.pasarelas[0].equipos[0];
      expect(e.ultima.t).toBe(fin);
      expect(e.temperaturas.length).toBeLessThanOrEqual(90);
      expect(e.temperaturas[e.temperaturas.length - 1]).toEqual({ t: fin, v: -21.99 });
      expect(e.temperaturas.every((p) => p.t >= fin - 3_600_000)).toBe(true);
    });
  });
}

contrato("en memoria", async () => almacenEnMemoria());

if (urlPrueba) {
  const base = almacenPostgres(urlPrueba);
  afterAll(() => base.cerrar());
  contrato("en base de datos", async () => {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: urlPrueba });
    await base.pasarelas();
    await pool.query("truncate gradiox_medidas");
    await pool.end();
    return base;
  });
} else {
  describe.skip("almacén en base de datos (define GRADIOX_PRUEBA_BASE_URL para probarlo)", () => it("pendiente", () => {}));
}

describe("elección del almacén", () => {
  it("usa la base de datos cuando el servidor tiene su dirección y la memoria cuando no", () => {
    expect(direccionBase({})).toBeUndefined();
    expect(direccionBase({ POSTGRES_URL: "postgres://a" })).toBe("postgres://a");
    expect(direccionBase({ DATABASE_URL: "postgres://b", GRADIOX_BASE_URL: "postgres://c" })).toBe("postgres://c");
  });
});

describe("programa de la pasarela", () => {
  const base = { pasarela: "nave-1", nube: "https://gradiox.com/api/ingesta", equipos: [{ id: "c1", host: "192.168.1.50", perfil: "banco-camara-v1" }] };

  it("lee la configuración y completa lo que se puede dar por hecho", () => {
    const c = leerConfiguracion(JSON.stringify(base));
    expect(c.cadaSegundos).toBe(30);
    expect(c.equipos[0]).toMatchObject({ id: "c1", puerto: 502, unidad: 1 });
    expect(c.equipos[0].perfil.id).toBe("banco-camara-v1");
  });

  it("dice con palabras qué está mal en la configuración", () => {
    const con = (cambio: object) => () => leerConfiguracion(JSON.stringify({ ...base, ...cambio }));
    expect(() => leerConfiguracion("{")).toThrow("no es JSON válido");
    expect(con({ pasarela: "Nave 1" })).toThrow("«pasarela»");
    expect(con({ nube: "gradiox.com" })).toThrow("«nube»");
    expect(con({ cadaSegundos: 0 })).toThrow("«cadaSegundos»");
    expect(con({ equipos: [{ ...base.equipos[0], perfil: "otro" }] })).toThrow("que no existe");
    expect(con({ equipos: [base.equipos[0], base.equipos[0]] })).toThrow("dos equipos");
  });

  it("con el controlador simulado lee y entrega sin ninguna instalación", async () => {
    const recibido: Medida[] = [];
    const programa = await arrancarPrograma({ pasarela: "banco", nube: "http://x", cadaSegundos: 3600, equipos: [] }, { clave: "k", simulado: true, enviar: async (lote) => void recibido.push(...lote) });
    await programa.ciclo(Date.now() + 60_000);
    await programa.parar();
    expect(recibido.length).toBe(2);
    expect(recibido[1]).toMatchObject({ equipo: "camara-simulada", lectura: { consigna: -20 } });
    expect(programa.pendientes).toBe(0);
  });

  it("sin equipos y sin simulador no arranca", async () => {
    await expect(arrancarPrograma({ pasarela: "banco", nube: "http://x", cadaSegundos: 30, equipos: [] }, { clave: "k" })).rejects.toThrow("ningún equipo");
  });
});
