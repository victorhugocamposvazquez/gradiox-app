import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pasarelasEnMemoria } from "../src/pasarelas/almacen";
import { PARTE, darConfiguracion, darPrograma, recibirLecturas } from "../src/pasarelas/entrada";
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
