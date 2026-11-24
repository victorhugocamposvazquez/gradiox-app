import { describe, expect, it } from "vitest";
import { soltarCliente, soltarNave } from "../src/clientes/borrar";
import type { Pasarela } from "../src/pasarelas/modelo";

// Almacenes de mentira con lo justo: lo que se guarda queda en un mapa.
function pasarelas(lista: Partial<Pasarela>[]) {
  const m = new Map(lista.map((p) => [p.id!, { creada: 0, actualizada: 0, contacto: null, nombre: p.id!, ...p } as Pasarela]));
  return { m, listar: async () => [...m.values()], guardar: async (id: string, d: object) => { const p = { ...m.get(id)!, ...d } as Pasarela; m.set(id, p); return p; } };
}

describe("borrar un cliente o una nave", () => {
  it("al borrar un cliente se borran sus usuarios y sus conexiones quedan sin cliente, sin perderse", async () => {
    const borrados: string[] = [];
    const accesos = { deCliente: async (c: string) => (c === "c1" ? [{ id: "u1" }, { id: "u2" }] : []) as never, borrar: async (id: string) => { borrados.push(id); return true; } };
    const ps = pasarelas([{ id: "p1", cliente: "c1", ubicacion: "n1" }, { id: "p2", cliente: "c2", ubicacion: "n9" }]);
    expect(await soltarCliente("c1", accesos, ps)).toEqual({ usuarios: 2, conexiones: 1 });
    expect(borrados).toEqual(["u1", "u2"]);
    expect(ps.m.get("p1")).toMatchObject({ cliente: undefined, ubicacion: undefined, nombre: "p1" });
    expect(ps.m.get("p2")).toMatchObject({ cliente: "c2", ubicacion: "n9" });
  });

  it("al quitar una nave su conexión sigue en el cliente, sin nave", async () => {
    const ps = pasarelas([{ id: "p1", cliente: "c1", ubicacion: "n1" }, { id: "p2", cliente: "c1", ubicacion: "n2" }]);
    expect(await soltarNave("c1", "n1", ps)).toBe(1);
    expect(ps.m.get("p1")).toMatchObject({ cliente: "c1", ubicacion: undefined });
    expect(ps.m.get("p2")).toMatchObject({ ubicacion: "n2" });
  });
});
