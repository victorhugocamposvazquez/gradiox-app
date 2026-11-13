import { describe, expect, it } from "vitest";
import { ahorroEstimado, planDelDia, preciosDelDia } from "../src/lib/luz";
import { AJUSTES_INICIALES, CAMARAS, consignaEn, eventos, leer, serie } from "../src/lib/sim";

const T = new Date(2026, 10, 13, 3, 30).getTime();

describe("simulación de cámaras", () => {
  it("da la misma lectura para el mismo instante", () => {
    for (const c of CAMARAS) expect(leer(c, T)).toEqual(leer(c, T));
  });

  it("mantiene las cámaras por debajo de su límite sin averías", () => {
    for (const c of CAMARAS) for (const l of serie(c, T, AJUSTES_INICIALES, 48, 3)) expect(l.temp).toBeLessThan(c.limite);
  });

  it("una avería de compresor acaba en alarma y sube la temperatura", () => {
    const c = CAMARAS[0];
    const aj = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "compresor" as const, desde: T } } };
    const luego = leer(c, T + 90 * 60_000, aj);
    expect(luego.estado).toBe("error");
    expect(luego.compresor).toBe(false);
    expect(luego.temp).toBeGreaterThan(c.limite);
    expect(eventos(T + 90 * 60_000, aj, 2).some((e) => e.camaraId === c.id && e.estado === "error")).toBe(true);
  });

  it("una puerta abierta avisa a los cuatro minutos", () => {
    const c = CAMARAS[3];
    const aj = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "puerta" as const, desde: T } } };
    expect(leer(c, T + 2 * 60_000, aj).estado).toBe("correcto");
    expect(leer(c, T + 5 * 60_000, aj).estado).toBe("aviso");
  });
});

describe("plan de la luz", () => {
  const precios = preciosDelDia(new Date(T));
  const plan = planDelDia(precios);

  it("elige 6 horas baratas y 4 caras sin repetir", () => {
    expect(precios).toHaveLength(24);
    expect(plan.baratas).toHaveLength(6);
    expect(plan.caras).toHaveLength(4);
    expect(plan.baratas.some((h) => plan.caras.includes(h))).toBe(false);
    expect(Math.max(...plan.baratas.map((h) => precios[h]))).toBeLessThanOrEqual(Math.min(...plan.caras.map((h) => precios[h])));
  });

  it("mueve la consigna solo en congelado y nunca cerca del límite", () => {
    const aj = { ...AJUSTES_INICIALES, planActivo: true };
    const en = (h: number) => new Date(2026, 10, 13, h, 10).getTime();
    const [cong, , , fresco] = CAMARAS;
    expect(consignaEn(cong, en(plan.baratas[0]), aj)).toBe(cong.consigna - 2);
    expect(consignaEn(cong, en(plan.caras[0]), aj)).toBe(cong.consigna + 2);
    expect(consignaEn(fresco, en(plan.caras[0]), aj)).toBe(fresco.consigna);
    const justa = { ...aj, consignas: { [cong.id]: cong.limite - 3 } };
    expect(consignaEn(cong, en(plan.caras[0]), justa)).toBe(cong.limite - 3);
  });

  it("estima un ahorro positivo", () => {
    expect(ahorroEstimado(precios, plan, [22, 22, 18]).euros).toBeGreaterThan(0);
  });
});
