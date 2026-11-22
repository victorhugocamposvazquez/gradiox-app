import { describe, expect, it } from "vitest";
import { pasarelasEnMemoria } from "../src/pasarelas/almacen";
import { darOrdenes, recibirResultados } from "../src/pasarelas/entrada";
import { aplicarCambios, huellaToken, nuevoToken, pasarelaVacia } from "../src/pasarelas/modelo";
import { nuevaPrueba, pararPrueba } from "../src/pasarelas/pruebas";

const AHORA = 1_800_000_000_000;
const V = "Datos_C6_1_REAL.P_consigna_ac";
const peticion = (token: string, cuerpo?: unknown) =>
  new Request("https://gradiox.com/api/pasarela/ordenes", {
    method: cuerpo === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "x-gradiox-protocolo": "1", "x-gradiox-programa": "0.4.1", "x-gradiox-plataforma": "darwin-arm64" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
const escritura = { activa: true, variables: [{ n: V, sino: false, min: -25, max: 5 }] };

async function montar() {
  const a = pasarelasEnMemoria(() => AHORA);
  const token = nuevoToken();
  const datos = aplicarCambios(pasarelaVacia("Nave", token, AHORA, 30), { variablesTexto: `variable\n${V}` });
  if ("error" in datos) throw new Error(datos.error);
  const p = await a.crear("11111111-1111-4111-8111-111111111111", huellaToken(token), { ...datos, escritura });
  return { a, token, p };
}

describe("prueba programada de órdenes", () => {
  it("rechaza lo que no se podría devolver o está fuera de límites", () => {
    expect(nuevaPrueba(undefined, [], { n: V, valor: -18, minutos: 5 }, -20, AHORA, "x")).toHaveProperty("error");
    expect(nuevaPrueba(escritura, [], { n: V, valor: 10, minutos: 5 }, -20, AHORA, "x")).toHaveProperty("error");
    expect(nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 5 }, undefined, AHORA, "x")).toHaveProperty("error");
    expect(nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 5 }, 30, AHORA, "x")).toHaveProperty("error");
    expect(nuevaPrueba(escritura, [], { n: V, valor: -20, minutos: 5 }, -20, AHORA, "x")).toHaveProperty("error");
    expect(nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 0 }, -20, AHORA, "x")).toHaveProperty("error");
    expect(nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 5, inicio: AHORA - 3_600_000 }, -20, AHORA, "x")).toHaveProperty("error");
    const ok = nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 5 }, -20, AHORA, "x");
    expect(ok).toMatchObject({ estado: "programada", valor: -18, original: -20 });
    if ("error" in ok) return;
    expect(nuevaPrueba(escritura, [ok], { n: V, valor: -19, minutos: 5 }, -20, AHORA, "x")).toHaveProperty("error");
  });

  it("espera a la hora, escribe, deja los minutos y vuelve sola al valor que leyó el PLC", async () => {
    const { a, token, p } = await montar();
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    const pr = nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 10, inicio: AHORA + 60_000 }, -20, AHORA, "Panel");
    if ("error" in pr) throw new Error(pr.error);
    await a.guardar(p.id, { ...datos, pruebas: [pr] });
    const pide = async (t: number) => (await darOrdenes(peticion(token), a, t)).cuerpo as { ordenes: { id: string; valor: number }[] };

    // Antes de la hora no pasa nada.
    expect((await pide(AHORA + 30_000)).ordenes).toEqual([]);
    // A la hora sale la ida.
    const ida = (await pide(AHORA + 61_000)).ordenes;
    expect(ida).toMatchObject([{ valor: -18 }]);
    // El PLC tenía en realidad -21 justo antes de escribir: se vuelve a eso.
    await recibirResultados(peticion(token, { resultados: [{ id: ida[0].id, estado: "hecha", antes: -21, leido: -18 }] }), a, AHORA + 65_000);
    expect((await pide(AHORA + 70_000)).ordenes).toEqual([]);
    expect((await a.leer(p.id))?.pruebas?.[0]).toMatchObject({ estado: "aplicada", original: -21 });
    // Antes de los 10 minutos, nada; después, la vuelta.
    expect((await pide(AHORA + 65_000 + 9 * 60_000)).ordenes).toEqual([]);
    const vuelta = (await pide(AHORA + 65_000 + 10 * 60_000 + 1000)).ordenes;
    expect(vuelta).toMatchObject([{ valor: -21 }]);
    // Si la vuelta falla, se pide otra vez.
    await recibirResultados(peticion(token, { resultados: [{ id: vuelta[0].id, estado: "rechazada", motivo: "PLC sin conexión" }] }), a, AHORA + 12 * 60_000);
    const otra = (await pide(AHORA + 12 * 60_000 + 5000)).ordenes;
    expect(otra).toMatchObject([{ valor: -21 }]);
    expect(otra[0].id).not.toBe(vuelta[0].id);
    await recibirResultados(peticion(token, { resultados: [{ id: otra[0].id, estado: "hecha", leido: -21 }] }), a, AHORA + 13 * 60_000);
    await pide(AHORA + 13 * 60_000 + 5000);
    expect((await a.leer(p.id))?.pruebas?.[0]).toMatchObject({ estado: "devuelta", intentos: 2 });
  });

  it("si la ida no se hace, la prueba queda fallida y no se pide vuelta", async () => {
    const { a, token, p } = await montar();
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    const pr = nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 5 }, -20, AHORA, "Panel");
    if ("error" in pr) throw new Error(pr.error);
    await a.guardar(p.id, { ...datos, pruebas: [pr] });
    const ida = ((await darOrdenes(peticion(token), a, AHORA + 1000)).cuerpo as { ordenes: { id: string }[] }).ordenes;
    await recibirResultados(peticion(token, { resultados: [{ id: ida[0].id, estado: "rechazada", motivo: "No es escribible" }] }), a, AHORA + 2000);
    expect(((await darOrdenes(peticion(token), a, AHORA + 10 * 60_000)).cuerpo as { ordenes: unknown[] }).ordenes).toEqual([]);
    expect((await a.leer(p.id))?.pruebas?.[0]).toMatchObject({ estado: "fallida" });
  });

  it("se anula si no ha empezado y adelanta la vuelta si está en marcha", () => {
    const pr = nuevaPrueba(escritura, [], { n: V, valor: -18, minutos: 30 }, -20, AHORA, "x");
    if ("error" in pr) throw new Error(pr.error);
    expect(pararPrueba([pr], pr.id, AHORA)).toMatchObject([{ estado: "anulada" }]);
    expect(pararPrueba([{ ...pr, estado: "aplicada", aplicada: AHORA }], pr.id, AHORA + 1000)).toMatchObject([{ estado: "aplicada", minutos: 0 }]);
    expect(pararPrueba([{ ...pr, estado: "devuelta" }], pr.id, AHORA)).toHaveProperty("error");
  });
});
