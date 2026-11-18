import { afterAll, describe, expect, it } from "vitest";
import { ErrorConsulta, instalaciones, periodo, resumen, serie } from "../src/historicos/consulta";
import { DIA, HORA, cambios, csvEjecutado, csvLecturas, resumir, tramoPara, tramos, type Muestra, type ResumenVariable } from "../src/historicos/modelo";
import { pasarelasEnMemoria, pasarelasPostgres, type AlmacenPasarelas } from "../src/pasarelas/almacen";
import { huellaToken, nuevoToken, pasarelaVacia, type LecturaOpc } from "../src/pasarelas/modelo";

// Las pruebas con base de datos solo corren si GRADIOX_PRUEBA_BASE_URL apunta a un Postgres de pruebas: nunca a uno real.
const urlPrueba = process.env.GRADIOX_PRUEBA_BASE_URL;
const T0 = Math.floor(1_800_000_000_000 / DIA) * DIA;
const ID = "22222222-2222-4222-8222-222222222222";

describe("cuentas de los históricos", () => {
  const muestras: Muestra[] = [
    { t: T0, x: -20 },
    { t: T0 + 10 * 60_000, x: -18 },
    { t: T0 + HORA, x: -16 },
    { t: T0 + 3 * HORA, x: -10 },
  ];
  it("reparte en ratos y deja fuera los que no tienen lecturas", () => {
    const r = tramos(muestras, T0, T0 + DIA, HORA);
    expect(r.map((x) => x.t)).toEqual([T0, T0 + HORA, T0 + 3 * HORA]);
    expect(r[0]).toMatchObject({ n: 2, min: -20, max: -18, media: -19, activa: null });
  });
  it("en los sí/no cuenta la parte del rato en sí y las veces que pasó a sí", () => {
    const sn: Muestra[] = [false, true, true, false, true].map((x, i) => ({ t: T0 + i * 60_000, x }));
    expect(tramos(sn, T0, T0 + HORA, HORA)[0]).toMatchObject({ n: 5, activa: 0.6, arranques: 2, media: null });
  });
  it("no cuenta como arranque la primera lectura si ya venía en sí", () => {
    const sn: Muestra[] = [{ t: T0 - 60_000, x: true }, { t: T0, x: true }, { t: T0 + 60_000, x: false }];
    expect(tramos(sn, T0, T0 + HORA, HORA)[0].arranques).toBe(0);
  });
  it("resume el periodo con su tendencia por día", () => {
    const r = resumir("a", muestras, T0, T0 + DIA) as ResumenVariable;
    expect(r).toMatchObject({ clase: "numero", n: 4, min: -20, max: -10 });
    expect(r.media).toBeCloseTo(-16);
    expect(r.pendiente).toBeGreaterThan(0);
    expect(resumir("a", muestras, T0 + DIA, T0 + 2 * DIA)).toBeNull();
  });
  it("elige ratos que no pasen de unos doscientos puntos", () => {
    expect(tramoPara(T0, T0 + DIA)).toBe(15 * 60_000);
    expect(tramoPara(T0, T0 + 7 * DIA)).toBe(HORA);
    expect(tramoPara(T0, T0 + 30 * DIA)).toBe(6 * HORA);
  });
  it("saca primero lo que más ha cambiado y calla lo que sigue igual", () => {
    const n = (v: string, media: number, min: number, max: number): ResumenVariable => ({ v, clase: "numero", n: 100, min, max, media, activa: null, arranques: 0, pendiente: 0 });
    const s = (v: string, activa: number, arranques: number): ResumenVariable => ({ v, clase: "sino", n: 100, min: null, max: null, media: null, activa, arranques, pendiente: null });
    const r = cambios([n("igual", -20, -21, -19), n("sube", -17, -19, -15), s("compresor", 0.8, 40), s("puerta", 0.1, 3)], [n("igual", -20.1, -21, -19), n("sube", -20, -21, -19), s("compresor", 0.5, 12), s("puerta", 0.1, 3)], 1);
    expect(r.map((c) => c.v)).toEqual(["compresor", "sube"]);
    expect(r[0]).toMatchObject({ tipo: "arranques", ahora: 40, antes: 12 });
    expect(r[1]).toMatchObject({ tipo: "media", ahora: -17, antes: -20 });
  });
  it("sin periodo anterior no inventa cambios", () => {
    expect(cambios([{ v: "a", clase: "numero", n: 50, min: 1, max: 2, media: 1.5, activa: null, arranques: 0, pendiente: 0 }], [], 1)).toEqual([]);
  });
  it("la descarga se abre en una hoja de cálculo en español", () => {
    const csv = csvLecturas({ v: "a", nombre: "Temperatura", grupo: "Cámara 6", unidad: "°C", clase: "numero" }, tramos(muestras, T0, T0 + DIA, HORA));
    expect(csv.split("\r\n")[1]).toBe("Fecha y hora;Mínima;Media;Máxima;Lecturas");
    expect(csv).toContain(";-20;-19;-18;2");
    expect(csvEjecutado([{ id: "o1", t: T0, que: "Cámara 6 · Consigna", v: "c6.consigna", antes: -20, valor: -22.5, estado: "hecha", quien: "Hugo" }])).toContain(";-20;-22,5;;Hecha;;Hugo");
  });
  it("el periodo se ajusta a horas en punto y no pasa de un año", () => {
    expect(periodo(T0 + 5, T0 + HORA + 5)).toEqual({ desde: T0, hasta: T0 + 2 * HORA });
    expect(() => periodo(T0, T0 + 400 * DIA)).toThrow(ErrorConsulta);
    expect(() => periodo("x", null)).toThrow(ErrorConsulta);
  });
});

/** Dos días de una temperatura que el segundo día va dos grados más alta y de un compresor que el segundo día arranca el doble. */
function lecturasDePrueba(): LecturaOpc[] {
  const out: LecturaOpc[] = [];
  for (let m = 0; m < 2 * 24 * 60; m += 5) {
    const t = T0 + m * 60_000;
    const segundo = m >= 24 * 60;
    out.push({ v: "Datos_C6_1_REAL.TT9", t, x: -20 + (segundo ? 2 : 0) + Math.sin(m / 40) * 0.5 });
    out.push({ v: "Datos_C6_1_BOOL.Marcha", t, x: Math.floor(m / (segundo ? 10 : 20)) % 2 === 0 });
    out.push({ v: "Datos_C6_1_TXT.Estado", t, x: "ok" });
  }
  return out;
}

function contrato(nombre: string, crear: () => Promise<AlmacenPasarelas>) {
  describe(`históricos ${nombre}`, () => {
    async function montar() {
      const a = await crear();
      const token = nuevoToken();
      const datos = { ...pasarelaVacia("Nave de pruebas", token, T0, 30), variables: [{ n: "Datos_C6_1_REAL.TT9", g: "Cámara 6", d: "Temperatura", u: "°C" }] };
      await a.crear(ID, huellaToken(token), datos);
      const todas = lecturasDePrueba();
      for (let i = 0; i < todas.length; i += 500) await a.anotar(ID, todas.slice(i, i + 500), false);
      return a;
    }
    it("dice qué variables tienen lecturas y cómo se llaman", async () => {
      const a = await montar();
      const [i] = await instalaciones(a);
      expect(i.nombre).toBe("Nave de pruebas");
      expect(i.variables).toEqual([
        { v: "Datos_C6_1_BOOL.Marcha", nombre: "Marcha", grupo: "Datos_C6_1_BOOL", clase: "sino" },
        { v: "Datos_C6_1_REAL.TT9", nombre: "Temperatura", grupo: "Cámara 6", unidad: "°C", clase: "numero" },
      ]);
      expect(i.primera).toBe(T0);
    });
    it("resume el periodo y el anterior, y de ahí sale lo que ha cambiado", async () => {
      const a = await montar();
      const r = await resumen(a, ID, T0 + DIA, T0 + 2 * DIA, T0 + 2 * DIA);
      const temp = r.actual.find((x) => x.v === "Datos_C6_1_REAL.TT9") as ResumenVariable;
      const antes = r.anterior.find((x) => x.v === "Datos_C6_1_REAL.TT9") as ResumenVariable;
      expect(temp.n).toBe(288);
      expect((temp.media as number) - (antes.media as number)).toBeCloseTo(2, 1);
      const marcha = r.actual.find((x) => x.v === "Datos_C6_1_BOOL.Marcha") as ResumenVariable;
      expect(marcha).toMatchObject({ clase: "sino", n: 288 });
      expect(marcha.activa).toBeCloseTo(0.5, 2);
      expect(marcha.arranques).toBeGreaterThan(60);
      const c = cambios(r.actual, r.anterior, 1);
      expect(c.map((x) => [x.v, x.tipo])).toEqual([["Datos_C6_1_REAL.TT9", "media"], ["Datos_C6_1_BOOL.Marcha", "arranques"]]);
      expect(r.ejecutado).toEqual([]);
    });
    it("da la serie de una variable y la del periodo anterior", async () => {
      const a = await montar();
      const r = await serie(a, ID, "Datos_C6_1_REAL.TT9", T0 + DIA, T0 + 2 * DIA);
      expect(r.tramoMs).toBe(15 * 60_000);
      expect(r.actual).toHaveLength(96);
      expect(r.anterior).toHaveLength(96);
      expect(r.actual[0]).toMatchObject({ t: T0 + DIA, n: 3, activa: null });
      const b = await serie(a, ID, "Datos_C6_1_BOOL.Marcha", T0, T0 + DIA);
      expect(b.actual[0].media).toBeNull();
      expect(b.actual.reduce((s, x) => s + x.arranques, 0)).toBeGreaterThan(30);
    });
    it("una instalación que no existe no se consulta", async () => {
      const a = await montar();
      await expect(resumen(a, "no-es", T0, T0 + DIA, T0)).rejects.toThrow(ErrorConsulta);
    });
    it("enseña las órdenes que guarde la instalación, con lo no recogido a tiempo como no hecho", async () => {
      const a = await montar();
      const p = await a.leer(ID);
      if (!p) throw new Error("falta");
      const { id: _, creada: __, actualizada: ___, contacto: ____, ...datos } = p;
      const ordenes = [
        { id: "o1", n: "Datos_C6_1_REAL.TT9", valor: -22, antes: -20, leido: -22, estado: "hecha", pedida: T0 + DIA + HORA, cambio: T0 + DIA + HORA + 5000 },
        { id: "o2", n: "Otra.Cosa", valor: true, estado: "pendiente", pedida: T0 + DIA + 2 * HORA, cambio: T0 + DIA + 2 * HORA },
      ];
      await a.guardar(ID, { ...datos, escritura: { activa: true, variables: [], ordenes } } as typeof datos);
      const r = await resumen(a, ID, T0 + DIA, T0 + 2 * DIA, T0 + 2 * DIA);
      expect(r.ejecutado.map((e) => [e.id, e.estado, e.que])).toEqual([["o2", "caducada", "Otra.Cosa"], ["o1", "hecha", "Cámara 6 · Temperatura"]]);
      expect(r.ejecutado[1]).toMatchObject({ antes: -20, valor: -22, leido: -22 });
    });
  });
}

contrato("en memoria", async () => pasarelasEnMemoria(() => T0 + 2 * DIA));

if (urlPrueba) {
  const abiertos: { cerrar(): Promise<void> }[] = [];
  afterAll(() => Promise.all(abiertos.map((a) => a.cerrar())));
  contrato("en Postgres", async () => {
    const a = pasarelasPostgres(urlPrueba, () => T0 + 2 * DIA);
    abiertos.push(a);
    for (const p of await a.listar()) await a.borrar(p.id);
    return a;
  });
  it("las lecturas que llegan atrasadas también entran en el resumen por horas", async () => {
    const a = pasarelasPostgres(urlPrueba, () => T0 + 2 * DIA);
    abiertos.push(a);
    for (const p of await a.listar()) await a.borrar(p.id);
    const token = nuevoToken();
    await a.crear(ID, huellaToken(token), pasarelaVacia("Atrasada", token, T0, 30));
    await a.anotar(ID, [{ v: "A.b", t: T0 + DIA + 60_000, x: 5 }], false);
    expect((await a.resumenLecturas(ID, T0, T0 + 2 * DIA))[0]).toMatchObject({ n: 1, media: 5 });
    await a.anotar(ID, [{ v: "A.b", t: T0 + HORA, x: 1 }, { v: "A.b", t: T0 + DIA + 120_000, x: 7 }], false);
    const otra = pasarelasPostgres(urlPrueba, () => T0 + 2 * DIA);
    abiertos.push(otra);
    expect((await otra.resumenLecturas(ID, T0, T0 + 2 * DIA))[0]).toMatchObject({ n: 3, min: 1, max: 7 });
  });
} else {
  describe.skip("históricos en Postgres (falta GRADIOX_PRUEBA_BASE_URL)", () => it("se salta", () => undefined));
}
