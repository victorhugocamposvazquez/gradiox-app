import { describe, expect, it } from "vitest";
import { CALIDAD, ESCALERA, INDICADORES, NIVELES, repartoPorKwFrio } from "../src/cop/indicadores";
import { AHORRO, CAPAS, NIVELES_AUTO, NUNCA, PENDIENTE, TOPES } from "../src/cop/automatizacion";

describe("reparto por kW de frío", () => {
  it("la suma de W/kW de cada parte es 1000 / COP de la instalación", () => {
    const r = repartoPorKwFrio(400, { compresores: 110, condensador: 9, bombas: 6, evaporadores: 12, desescarches: 5 });
    expect(r).not.toBeNull();
    const suma = Object.values(r!.wPorKw).reduce((a, b) => a + b, 0);
    expect(r!.cop).toBeCloseTo(400 / 142, 10);
    expect(suma).toBeCloseTo(1000 / r!.cop, 8);
    expect(r!.wPorKw.compresores).toBeCloseTo(275, 8);
  });

  it("sin frío, sin consumos o con un consumo que falta no da número", () => {
    expect(repartoPorKwFrio(0, { compresores: 100 })).toBeNull();
    expect(repartoPorKwFrio(300, {})).toBeNull();
    expect(repartoPorKwFrio(300, { compresores: 100, bombas: Number.NaN })).toBeNull();
    expect(repartoPorKwFrio(300, { compresores: -1 })).toBeNull();
  });
});

describe("datos de la Ayuda de rendimiento", () => {
  it("tiene los tres niveles y manda el de la instalación", () => {
    expect(NIVELES.map((n) => n.id)).toEqual(["instalacion", "compresor", "servicio"]);
    expect(NIVELES[0].titulo).toMatch(/manda/);
  });

  it("cada equipo dice indicador, señales y para qué", () => {
    for (const i of INDICADORES) {
      expect(i.indicador && i.senales && i.paraQue).toBeTruthy();
    }
    expect(new Set(INDICADORES.map((i) => i.equipo)).size).toBe(INDICADORES.length);
  });

  it("las tres calidades y la escalera están completas", () => {
    expect(Object.keys(CALIDAD).sort()).toEqual(["calculado", "estimado", "medido"]);
    expect(ESCALERA.some((e) => /Analizadores/.test(e.dato))).toBe(true);
  });
});

describe("tipos de automatización", () => {
  it("son cinco niveles en orden, cada uno con todo lo que hay que explicar", () => {
    expect(NIVELES_AUTO.map((n) => n.numero)).toEqual([0, 1, 2, 3, 4]);
    for (const n of NIVELES_AUTO) {
      for (const lista of [n.hace, n.consigue, n.datos, n.equipos, n.automata, n.software, n.papeles, n.puerta, n.riesgos, n.hoy]) {
        expect(lista.length).toBeGreaterThan(0);
      }
      expect(n.ahorro && n.calidad && n.plazo && n.coste && n.noHace).toBeTruthy();
      expect(Object.values(n.quien).every((l) => l.length > 0)).toBe(true);
    }
  });

  it("los niveles 3 y 4 no están hechos: no se puede presentar como funcionando", () => {
    for (const n of NIVELES_AUTO.filter((n) => n.numero >= 3)) {
      expect(n.hoy.every((h) => h.estado === "pendiente")).toBe(true);
    }
  });

  it("el desescarche, la secuencia y la presión intermedia nunca pasan de proponer", () => {
    for (const t of TOPES.filter((t) => /J5|J3|J11|−32/.test(t.ajuste))) expect(t.tope).toBeLessThanOrEqual(2);
  });

  it("seguridad, ahorro y pendientes no están vacíos", () => {
    expect(CAPAS).toHaveLength(4);
    expect(NUNCA.length && AHORRO.length && PENDIENTE.length).toBeTruthy();
  });
});
