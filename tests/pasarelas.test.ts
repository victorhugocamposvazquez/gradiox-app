import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pasarelasEnMemoria, pasarelasPostgres, type AlmacenPasarelas } from "../src/pasarelas/almacen";
import { PARTE, darConfiguracion, darOrdenes, darPrograma, recibirLecturas, recibirPropuesta, recibirResultados } from "../src/pasarelas/entrada";
import { CADUCA_MS, escribiblesDeTexto, nuevaOrden, validarValor } from "../src/pasarelas/ordenes";
import { aplicarCambios, esToken, huellaToken, nuevoToken, pasarelaVacia, variablesDeTexto } from "../src/pasarelas/modelo";

const AHORA = 1_800_000_000_000;
const peticion = (ruta: string, token: string, cuerpo?: unknown, protocolo = "1") =>
  new Request(`https://gradiox.com${ruta}`, {
    method: cuerpo === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${token}`, "x-gradiox-protocolo": protocolo, "x-gradiox-programa": "0.1.0", "x-gradiox-plataforma": "windows-amd64" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

async function montar() {
  const a = pasarelasEnMemoria(() => AHORA);
  const token = nuevoToken();
  const datos = aplicarCambios(pasarelaVacia("Nave de pruebas", token, AHORA, 30), { plc: "50.50.0.1", cadaSegundos: 10, variablesTexto: "grupo\tvariable\ttipo\tqué es\tunidad\nCámara 6\tDatos_C6_1_REAL.TT9\tReal\tTemperatura\t°C\nCámara 6\tDatos_C6_1_BOOL.Averia\tBool\tAvería\tsí/no" });
  if ("error" in datos) throw new Error(datos.error);
  const p = await a.crear("11111111-1111-4111-8111-111111111111", huellaToken(token), datos);
  return { a, token, p };
}

describe("lista de variables pegada", () => {
  it("reconoce las columnas por su título, con tabuladores o con punto y coma", () => {
    const v = variablesDeTexto("Grupo;Variable en el PLC;Tipo;Dirección;Qué creemos que es;Unidad supuesta\nCámara 6;Datos_C6_1_REAL.TT9;Real;%DB1001.DBD0;Temperatura de la cámara;°C");
    expect(v).toEqual([{ n: "Datos_C6_1_REAL.TT9", g: "Cámara 6", tipo: "Real", d: "Temperatura de la cámara", u: "°C" }]);
  });
  it("sin títulos toma una variable por línea y no repite", () => {
    expect(variablesDeTexto("A.b\nA.b\nC.d").map((v) => v.n)).toEqual(["A.b", "C.d"]);
  });
});

describe("token de instalación", () => {
  it("tiene forma reconocible y solo se guarda su huella", async () => {
    const { a, token, p } = await montar();
    expect(esToken(token)).toBe(true);
    expect(JSON.stringify(await a.listar())).not.toContain(token.slice(4));
    expect(p.pista).toBe(token.slice(-4));
  });
  it("sin token, con uno inventado o con uno mal formado no se entra", async () => {
    const { a } = await montar();
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", nuevoToken()), a, AHORA)).estado).toBe(401);
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", "hola"), a, AHORA)).estado).toBe(401);
  });
  it("anulado o caducado deja de valer en el acto", async () => {
    const { a, token, p } = await montar();
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", token), a, p.caduca)).estado).toBe(403);
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    await a.guardar(p.id, { ...datos, anulada: true });
    expect((await recibirLecturas(peticion("/api/pasarela/lecturas", token, { lecturas: [] }), a, AHORA)).estado).toBe(403);
  });
  it("al renovarlo, el anterior ya no entra", async () => {
    const { a, token, p } = await montar();
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    const nuevo = nuevoToken();
    await a.guardar(p.id, datos, huellaToken(nuevo));
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", token), a, AHORA)).estado).toBe(401);
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", nuevo), a, AHORA)).estado).toBe(200);
  });
});

describe("protocolo", () => {
  it("a un programa demasiado antiguo se le dice que se actualice", async () => {
    const { a, token } = await montar();
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", token, undefined, "0"), a, AHORA)).estado).toBe(426);
  });
  it("sin versión de protocolo no se atiende", async () => {
    const { a, token } = await montar();
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", token, undefined, "x"), a, AHORA)).estado).toBe(400);
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", token, undefined, ""), a, AHORA)).estado).toBe(400);
  });
});

describe("configuración", () => {
  it("entrega lo que se puso en el panel y no lo repite si no ha cambiado", async () => {
    const { a, token, p } = await montar();
    const r = await darConfiguracion(peticion("/api/pasarela/configuracion", token), a, AHORA);
    expect(r.cuerpo).toMatchObject({ nombre: "Nave de pruebas", plc: "50.50.0.1", cadaSegundos: 10, revision: p.revision });
    expect((r.cuerpo as { variables: unknown[] }).variables).toHaveLength(2);
    expect((await darConfiguracion(peticion(`/api/pasarela/configuracion?revision=${p.revision}`, token), a, AHORA)).estado).toBe(304);
  });
  it("cada cambio trae una revisión nueva", async () => {
    const { p } = await montar();
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    const d = aplicarCambios(datos, { cadaSegundos: 30 });
    expect("error" in d ? "" : d.revision).not.toBe(p.revision);
    expect(aplicarCambios(datos, { plc: "esto no es una dirección" })).toHaveProperty("error");
  });
});

describe("entrega de lecturas", () => {
  it("guarda las de su lista, descarta las demás y apunta el contacto", async () => {
    const { a, token, p } = await montar();
    const r = await recibirLecturas(
      peticion("/api/pasarela/lecturas", token, {
        estado: { plc: "conectado", leidas: 2, total: 2, ultima: AHORA },
        lecturas: [
          { v: "Datos_C6_1_REAL.TT9", t: AHORA - 1000, x: -18.4 },
          { v: "Datos_C6_1_BOOL.Averia", t: AHORA - 1000, x: false },
          { v: "Otra.cosa", t: AHORA - 1000, x: 1 },
        ],
      }),
      a,
      AHORA,
    );
    expect(r).toEqual({ estado: 200, cuerpo: { recibidas: 2, revision: p.revision } });
    expect((await a.ultimas(p.id)).map((l) => l.v)).toEqual(["Datos_C6_1_BOOL.Averia", "Datos_C6_1_REAL.TT9"]);
    expect((await a.leer(p.id))?.contacto).toMatchObject({ t: AHORA, programa: "0.1.0", plataforma: "windows-amd64", estado: { plc: "conectado", leidas: 2 } });
  });
  it("un envío repetido no duplica y uno mal hecho se rechaza", async () => {
    const { a, token, p } = await montar();
    const lote = { lecturas: [{ v: "Datos_C6_1_REAL.TT9", t: AHORA, x: -18 }] };
    await recibirLecturas(peticion("/api/pasarela/lecturas", token, lote), a, AHORA);
    await recibirLecturas(peticion("/api/pasarela/lecturas", token, lote), a, AHORA);
    expect(await a.ultimas(p.id)).toHaveLength(1);
    expect((await recibirLecturas(peticion("/api/pasarela/lecturas", token, { lecturas: [{ v: "", t: 1 }] }), a, AHORA)).estado).toBe(400);
  });
});

describe("lista propuesta por el programa", () => {
  it("la elegida en la planta pasa a ser la de la instalación, guarda la de antes y cambia la revisión", async () => {
    const { a, token, p } = await montar();
    const variables = [{ n: "Datos_C6_1_REAL.TT9" }, { n: "Nueva.temperatura", nodo: 'ns=4;s="Nueva"."temperatura"' }];
    const r = await recibirPropuesta(peticion("/api/pasarela/propuesta", token, { origen: "elegidas", variables }), a, AHORA);
    expect(r).toEqual({ estado: 200, cuerpo: { recibidas: 2, pendiente: false, aceptada: true } });
    const guardada = await a.leer(p.id);
    expect(guardada?.variables).toEqual(variables);
    expect(guardada?.perfil).toBe("Elegidas en la planta");
    expect(guardada?.revision).not.toBe(p.revision);
    expect(guardada?.propuesta).toBeUndefined();
    expect(guardada?.anterior).toMatchObject({ t: AHORA, variables: p.variables });
    expect((await darConfiguracion(peticion("/api/pasarela/configuracion", token), a, AHORA)).cuerpo).toMatchObject({ propuesta: false, variables });
    const e = await recibirLecturas(peticion("/api/pasarela/lecturas", token, { lecturas: [{ v: "Nueva.temperatura", t: AHORA, x: 4 }, { v: "Otra.cosa", t: AHORA, x: 1 }] }), a, AHORA);
    expect(e.cuerpo).toMatchObject({ recibidas: 1 });
  });
  it("la de su archivo queda como propuesta, sin cambiar la lista ni la revisión", async () => {
    const { a, token, p } = await montar();
    const variables = [{ n: "Otra.cosa" }];
    const r = await recibirPropuesta(peticion("/api/pasarela/propuesta", token, { origen: "archivo", variables }), a, AHORA);
    expect(r.cuerpo).toMatchObject({ pendiente: true, aceptada: false });
    const guardada = await a.leer(p.id);
    expect(guardada?.variables).toEqual(p.variables);
    expect(guardada?.revision).toBe(p.revision);
    expect(guardada?.propuesta).toMatchObject({ origen: "archivo", variables });
  });
  it("si es la misma lista que ya tiene la instalación no queda nada pendiente, y vacía se rechaza", async () => {
    const { a, token, p } = await montar();
    const r = await recibirPropuesta(peticion("/api/pasarela/propuesta", token, { origen: "elegidas", variables: p.variables }), a, AHORA);
    expect(r.cuerpo).toMatchObject({ pendiente: false, aceptada: false });
    expect((await a.leer(p.id))?.propuesta).toBeUndefined();
    expect((await a.leer(p.id))?.anterior).toBeUndefined();
    expect((await recibirPropuesta(peticion("/api/pasarela/propuesta", token, { variables: [] }), a, AHORA)).estado).toBe(400);
    expect((await recibirPropuesta(peticion("/api/pasarela/propuesta", nuevoToken(), { variables: p.variables }), a, AHORA)).estado).toBe(401);
  });
});

describe("órdenes al PLC", () => {
  it("lee la lista de variables que se pueden cambiar y comprueba los límites", () => {
    const r = escribiblesDeTexto("variable; mínimo; máximo\nDatos_C6_1_REAL.P_consigna_ac; -25; 5\nDatos_C6_1_BOOL.Marcha; sí/no");
    expect(r).toEqual({ variables: [{ n: "Datos_C6_1_REAL.P_consigna_ac", sino: false, min: -25, max: 5 }, { n: "Datos_C6_1_BOOL.Marcha", sino: true }] });
    expect(escribiblesDeTexto("X.y; 5")).toHaveProperty("error");
    expect(escribiblesDeTexto("X.y; 5; 1")).toHaveProperty("error");
    const e = { n: "X.y", sino: false, min: -25, max: 5 };
    expect(validarValor(e, "-18,5")).toEqual({ valor: -18.5 });
    expect(validarValor(e, 10)).toHaveProperty("error");
    expect(validarValor(e, true)).toHaveProperty("error");
    expect(validarValor(undefined, 1)).toHaveProperty("error");
    expect(validarValor({ n: "B", sino: true }, false)).toEqual({ valor: false });
  });
  it("sin activar no se da ninguna; activada, se entrega una sola vez y se anota el resultado", async () => {
    const { a, token, p } = await montar();
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    expect((await darOrdenes(peticion("/api/pasarela/ordenes", token), a, AHORA)).cuerpo).toEqual({ activa: false, ordenes: [] });
    await a.guardar(p.id, { ...datos, escritura: { activa: true, variables: [{ n: "Datos_C6_1_REAL.TT9", sino: false, min: -25, max: 5 }] } });
    const orden = nuevaOrden("Datos_C6_1_REAL.TT9", -20, -18.4, AHORA, "Panel interno");
    await a.ponerOrden(p.id, orden);
    const r = await darOrdenes(peticion("/api/pasarela/ordenes", token), a, AHORA + 1000);
    expect(r.cuerpo).toMatchObject({ activa: true, ordenes: [{ id: orden.id, n: "Datos_C6_1_REAL.TT9", valor: -20, limites: { min: -25, max: 5 } }] });
    expect((await darOrdenes(peticion("/api/pasarela/ordenes", token), a, AHORA + 2000)).cuerpo).toMatchObject({ ordenes: [] });
    await recibirResultados(peticion("/api/pasarela/ordenes", token, { resultados: [{ id: orden.id, estado: "hecha", antes: -18.4, leido: -20, simulada: true }] }), a, AHORA + 3000);
    expect((await a.ordenes(p.id))[0]).toMatchObject({ estado: "hecha", leido: -20, cambio: AHORA + 3000, simulada: true, por: "Panel interno" });
    // Una orden terminada no cambia aunque el programa repita el resultado.
    await recibirResultados(peticion("/api/pasarela/ordenes", token, { resultados: [{ id: orden.id, estado: "rechazada" }] }), a, AHORA + 4000);
    expect((await a.ordenes(p.id))[0].estado).toBe("hecha");
  });
  it("una orden que nadie recoge a tiempo caduca y ya no se entrega; el historial se filtra por fechas", async () => {
    const { a, token, p } = await montar();
    const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
    await a.guardar(p.id, { ...datos, escritura: { activa: true, variables: [{ n: "Datos_C6_1_REAL.TT9", sino: false, min: -25, max: 5 }] } });
    await a.ponerOrden(p.id, nuevaOrden("Datos_C6_1_REAL.TT9", -20, null, AHORA, "Panel interno"));
    await a.ponerOrden(p.id, nuevaOrden("Datos_C6_1_REAL.TT9", -21, null, AHORA + 10, "Panel interno"));
    expect((await darOrdenes(peticion("/api/pasarela/ordenes", token), a, AHORA + CADUCA_MS + 100)).cuerpo).toMatchObject({ ordenes: [] });
    expect((await a.ordenes(p.id)).map((o) => o.estado)).toEqual(["caducada", "caducada"]);
    expect((await a.ordenes(p.id, { desde: AHORA + 5 })).map((o) => o.valor)).toEqual([-21]);
  });
});

describe("programa publicado", () => {
  it("anuncia la versión y la entrega por partes solo a quien tiene token", async () => {
    const { a, token } = await montar();
    const carpeta = await mkdtemp(path.join(tmpdir(), "gradiox-pub-"));
    const bytes = new Uint8Array(PARTE + 10).map((_, i) => i % 251);
    await writeFile(path.join(carpeta, "prog.gz"), bytes);
    await writeFile(path.join(carpeta, "publicado.json"), JSON.stringify({ "windows-amd64": { version: "0.2.0", tamano: 999, sha256: "ab", firma: "cd", archivo: "prog.gz", comprimido: bytes.length } }));
    const base = "/api/pasarela/programa?plataforma=windows-amd64";
    expect((await darPrograma(peticion(base, nuevoToken()), a, carpeta, AHORA)).estado).toBe(401);
    expect((await darPrograma(peticion(base, token), a, carpeta, AHORA)).cuerpo).toEqual({ version: "0.2.0", tamano: 999, sha256: "ab", firma: "cd", partes: 2 });
    const p0 = await darPrograma(peticion(`${base}&version=0.2.0&parte=0`, token), a, carpeta, AHORA);
    const p1 = await darPrograma(peticion(`${base}&version=0.2.0&parte=1`, token), a, carpeta, AHORA);
    expect(p0.bytes).toHaveLength(PARTE);
    expect([...(p1.bytes ?? [])]).toEqual([...bytes.slice(PARTE)]);
    expect((await darPrograma(peticion(`${base}&version=0.1.0&parte=0`, token), a, carpeta, AHORA)).estado).toBe(404);
    expect((await darPrograma(peticion("/api/pasarela/programa?plataforma=otra", token), a, carpeta, AHORA)).estado).toBe(404);
  });
});

// El registro de órdenes, igual en memoria y en base de datos. La base solo se
// prueba si GRADIOX_PRUEBA_BASE_URL apunta a un Postgres de pruebas: nunca a uno real.
function contratoOrdenes(nombre: string, crear: () => Promise<AlmacenPasarelas>) {
  describe(`registro de órdenes (${nombre})`, () => {
    it("apunta, cambia solo desde el estado esperado, caduca y lista por fechas", async () => {
      const a = await crear();
      const id = randomUUID();
      await a.crear(id, randomUUID(), pasarelaVacia("Prueba órdenes", nuevoToken(), AHORA, 30));
      const o1 = nuevaOrden("Datos_C6_1_REAL.TT9", -20, -18.4, AHORA, "Panel interno");
      const o2 = nuevaOrden("Datos_C6_1_BOOL.Marcha", true, null, AHORA + 10, "Panel interno");
      await a.ponerOrden(id, o1);
      await a.ponerOrden(id, o2);
      expect((await a.ordenesAbiertas(id)).map((o) => o.id)).toEqual([o1.id, o2.id]);
      expect(await a.cambiarOrden(id, o1.id, { estado: "hecha", cambio: AHORA + 1 }, ["enviada"])).toBeNull();
      expect(await a.cambiarOrden(id, o1.id, { estado: "enviada", cambio: AHORA + 1 }, ["pendiente"])).toMatchObject({ estado: "enviada" });
      expect(await a.cambiarOrden(id, o1.id, { estado: "hecha", leido: -20, cambio: AHORA + 2, simulada: true }, ["enviada"])).toMatchObject({ estado: "hecha", antes: -18.4, leido: -20, simulada: true });
      await a.caducarOrdenes(id, AHORA + CADUCA_MS + 100);
      const todas = await a.ordenes(id);
      expect(todas.map((o) => [o.n, o.estado])).toEqual([["Datos_C6_1_BOOL.Marcha", "caducada"], ["Datos_C6_1_REAL.TT9", "hecha"]]);
      expect(todas[0]).toMatchObject({ valor: true, por: "Panel interno" });
      expect(todas[0]).not.toHaveProperty("antes");
      expect((await a.ordenes(id, { hasta: AHORA + 5 })).map((o) => o.id)).toEqual([o1.id]);
      expect(await a.ordenesAbiertas(id)).toEqual([]);
      await a.borrar(id);
      expect(await a.ordenes(id)).toEqual([]);
    });
  });
}
contratoOrdenes("memoria", async () => pasarelasEnMemoria());
const urlPruebaBase = process.env.GRADIOX_PRUEBA_BASE_URL;
if (urlPruebaBase) {
  const abiertos: { cerrar(): Promise<void> }[] = [];
  contratoOrdenes("base de datos", async () => {
    const a = pasarelasPostgres(urlPruebaBase);
    abiertos.push(a);
    return a;
  });
  afterAll(async () => {
    for (const a of abiertos) await a.cerrar();
  });
}
