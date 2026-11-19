import { describe, expect, it } from "vitest";
import { pasarelasEnMemoria } from "../src/pasarelas/almacen";
import { huellaToken, nuevoToken, pasarelaVacia, type LecturaOpc, type Pasarela } from "../src/pasarelas/modelo";
import { instalacionesVivas } from "../src/vivo/consulta";
import { CALLADA_MS, VIEJA_MS, montarInstalacion, muestrear, resumenDe } from "../src/vivo/modelo";

const AHORA = Date.UTC(2026, 10, 19, 9, 0, 0);
const variables = [
  ...["REAL.TT9", "REAL.P_consigna_ac", "REAL.T_muy_alta_ac", "REAL.T_muy_baja_ac", "BOOL.Refrigeracion", "BOOL.Desescarche", "BOOL.Averia", "BOOL.marcha", "REAL.HUMEDAD"].map((f) => ({ n: `Datos_C10_1_${f}`, g: "Cámara 10" })),
  ...["REAL.TT4", "REAL.P_consigna_ac", "REAL.T_muy_alta_ac", "BOOL.Refrigeracion", "BOOL.Averia"].map((f) => ({ n: `Datos_C12_1_${f}`, g: "Cámara 12 · evaporador 1" })),
  ...["BOOL.Refrigeracion", "BOOL.Averia"].map((f) => ({ n: `Datos_C12_2_${f}`, g: "Cámara 12 · evaporador 2" })),
  ...["REAL.TT1", "BOOL.Refrigeracion", "BOOL.marcha"].map((f) => ({ n: `Datos_TUNEL1_1_${f}`, g: "Túnel 1" })),
  ...["BOOL.Marcha", "BOOL.Bloq_comp"].map((f) => ({ n: `Compresor1_BOOL.${f.split(".")[1]}`, g: "Compresor 1" })),
  { n: "ALARMAS_CAM10_1", g: "Alarmas" },
];

const pasarela = (contacto: number | null = AHORA - 10_000): Pasarela => ({
  ...pasarelaVacia("Demo simulada RGV", nuevoToken(), AHORA - 86_400_000, 30),
  id: "p1",
  creada: AHORA - 86_400_000,
  actualizada: AHORA,
  propuesta: { t: AHORA, origen: "archivo", variables },
  contacto: contacto === null ? null : { t: contacto, programa: "0.4.1", plataforma: "darwin-arm64", estado: { plc: "conectado", detalle: "", leidas: 1, total: 1, ultima: contacto, simulado: true, pendientes: 0, ordenes: false } },
});

const ult = (t: number, x: Record<string, LecturaOpc["x"]>): LecturaOpc[] => Object.entries(x).map(([v, val]) => ({ v, t, x: val }));

describe("instalación conectada", () => {
  const base = {
    "Datos_C10_1_REAL.TT9": -20.4,
    "Datos_C10_1_REAL.P_consigna_ac": -20,
    "Datos_C10_1_REAL.T_muy_alta_ac": -15,
    "Datos_C10_1_REAL.T_muy_baja_ac": -28,
    "Datos_C10_1_BOOL.Refrigeracion": true,
    "Datos_C10_1_BOOL.Desescarche": false,
    "Datos_C10_1_BOOL.Averia": false,
    "Datos_C10_1_BOOL.marcha": true,
    "Datos_C10_1_REAL.HUMEDAD": 56.7,
    "Datos_C12_1_REAL.TT4": -17.3,
    "Datos_C12_1_REAL.P_consigna_ac": -22,
    "Datos_C12_1_REAL.T_muy_alta_ac": -15,
    "Datos_C12_1_BOOL.Refrigeracion": true,
    "Datos_C12_1_BOOL.Averia": false,
    "Datos_C12_2_BOOL.Refrigeracion": false,
    "Datos_C12_2_BOOL.Averia": false,
    "Datos_TUNEL1_1_REAL.TT1": -11.5,
    "Datos_TUNEL1_1_BOOL.marcha": false,
    "Compresor1_BOOL.Marcha": true,
    "Compresor1_BOOL.Bloq_comp": false,
  };

  it("saca cámaras, túneles y compresores de los nombres y junta los evaporadores sin sonda", () => {
    const i = montarInstalacion(pasarela(), ult(AHORA - 30_000, base), [], AHORA);
    expect(i.servicios.map((s) => s.nombre)).toEqual(["Cámara 10", "Cámara 12", "Túnel 1"]);
    const c10 = i.servicios[0];
    expect(c10).toMatchObject({ temp: -20.4, consigna: -20, muyAlta: -15, enfriando: true, humedad: 56.7, estado: "correcto", motivo: "Enfriando", variable: "Datos_C10_1_REAL.TT9" });
    expect(i.servicios[1].evaporadores).toEqual([{ nombre: "Cámara 12 · evaporador 2", enfriando: false, averia: false }]);
    expect(i.servicios[2]).toMatchObject({ clase: "tunel", motivo: "Parado" });
    expect(i.compresores).toEqual([{ nombre: "Compresor 1", marcha: true, bloqueado: false }]);
    expect(i.simulada).toBe(true);
    expect(resumenDe(i).titular).toBe("Todo en orden");
  });

  it("usa las alarmas del propio autómata para avisar", () => {
    const alta = montarInstalacion(pasarela(), ult(AHORA - 30_000, { ...base, "Datos_C10_1_REAL.TT9": -14.8 }), [], AHORA).servicios[0];
    expect(alta.estado).toBe("error");
    const cerca = montarInstalacion(pasarela(), ult(AHORA - 30_000, { ...base, "Datos_C10_1_REAL.TT9": -15.6 }), [], AHORA).servicios[0];
    expect(cerca.estado).toBe("aviso");
    const averia = montarInstalacion(pasarela(), ult(AHORA - 30_000, { ...base, "Datos_C12_2_BOOL.Averia": true }), [], AHORA).servicios[1];
    expect(averia).toMatchObject({ estado: "error", motivo: "Avería en cámara 12 · evaporador 2" });
  });

  it("deja sin datos lo viejo y todo si la pasarela se calla", () => {
    const vieja = montarInstalacion(pasarela(), [...ult(AHORA - VIEJA_MS - 1000, { "Datos_C10_1_REAL.TT9": -20 }), ...ult(AHORA - 1000, { "Datos_C12_1_REAL.TT4": -18 })], [], AHORA);
    expect(vieja.servicios[0].estado).toBe("sindatos");
    const callada = montarInstalacion(pasarela(AHORA - CALLADA_MS - 1000), ult(AHORA - CALLADA_MS - 1000, base), [], AHORA);
    expect(callada.conectada).toBe(false);
    expect(callada.servicios.every((s) => s.estado === "sindatos")).toBe(true);
    expect(resumenDe(callada).titular).toBe("La pasarela no entrega");
  });

  it("dibuja la última hora con la última lectura de cada momento", () => {
    const curva = muestrear([{ t: 0, x: 1 }, { t: 50, x: 2 }, { t: 75, x: "nada" }], 0, 100, 5);
    expect(curva).toEqual([1, 1, 2, 2, 2]);
  });

  it("monta las instalaciones con lo guardado en el almacén", async () => {
    const a = pasarelasEnMemoria(() => AHORA);
    const token = nuevoToken();
    const p = pasarela();
    const creada = await a.crear("22222222-2222-4222-8222-222222222222", huellaToken(token), { ...p });
    await a.contactar(creada.id, p.contacto!);
    await a.anotar(creada.id, [{ v: "Datos_C10_1_REAL.TT9", t: AHORA - 40 * 60_000, x: -19 }], true);
    await a.anotar(creada.id, ult(AHORA - 20_000, base), true);
    expect((await a.ultimas(creada.id, AHORA - 60_000)).length).toBe(Object.keys(base).length);
    expect((await a.lecturasDesde(creada.id, ["Datos_C10_1_REAL.TT9"], AHORA - 3600_000)).map((l) => l.x)).toEqual([-19, -20.4]);
    const [i] = await instalacionesVivas(a, AHORA);
    expect(i.nombre).toBe("Demo simulada RGV");
    expect(i.servicios[0].curva.length).toBeGreaterThan(10);
    expect(i.servicios[0].curva.at(-1)).toBe(-20.4);
  });
});
