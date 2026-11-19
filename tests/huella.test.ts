import { describe, expect, it } from "vitest";
import { CAMARAS } from "../src/lib/sim";
import { deriva, medirCiclos, pendiente, ritmoDe, type Muestra } from "../src/huella/ciclos";
import { FICHAS, huellaDeCiclos, muestrasDe, precisionDe, ritmoReal } from "../src/huella/demo";
import { calorDeEnfriar, comparar, cop, esperado, marchaDe, minutosDeBajada, minutosDeSubida, ritmoEsperado, superficie, type FichaFisica, type Ritmo } from "../src/huella/fisica";
import { PERFILES, ajusteDe, aporteDe, conAjuste, fichaDePerfil, perfilPara } from "../src/huella/perfiles";
import { MINUTOS_TOTAL, avanzar, comprobaciones, empezar, parar, pasoPlanta, planDePrueba, plantaNueva, type EstadoPrueba, type Lectura, type Planta } from "../src/huella/prueba";

const T = new Date(2026, 10, 13, 12, 0).getTime();
const MIN = 60_000;
const camara = (id: string) => CAMARAS.find((c) => c.id === id)!;
const FICHA: FichaFisica = FICHAS.c1;

describe("modelo físico", () => {
  it("una cámara más grande tiene más pared, pero menos por cada m³", () => {
    expect(superficie(2000)).toBeGreaterThan(superficie(500));
    expect(superficie(2000) / 2000).toBeLessThan(superficie(500) / 500);
  });

  it("el equipo rinde menos cuanto más frío se le pide y más calor hace fuera", () => {
    expect(cop(-25, 20)).toBeLessThan(cop(2, 20));
    expect(cop(-25, 35)).toBeLessThan(cop(-25, 20));
    expect(cop(-25, 20)).toBeGreaterThan(1);
    expect(cop(-25, 20)).toBeLessThan(2.5);
  });

  it("congelar un kilo cuesta mucho más que enfriarlo", () => {
    expect(calorDeEnfriar("carne", 4, 0)).toBeCloseTo(4 * 3.2, 5);
    expect(calorDeEnfriar("carne", 4, -20)).toBeGreaterThan(230);
    expect(calorDeEnfriar("carne", -20, -18)).toBe(0);
  });

  it("más panel pierde menos, más puertas pierden más, y la marcha lo refleja", () => {
    const base = esperado(FICHA, -25);
    expect(esperado({ ...FICHA, panelMm: 150 }, -25).marcha).toBeLessThan(base.marcha);
    expect(esperado({ ...FICHA, aperturasHora: 12 }, -25).marcha).toBeGreaterThan(base.marcha);
    expect(esperado({ ...FICHA, exteriorC: 32 }, -25).marcha).toBeGreaterThan(base.marcha);
    expect(base.cargas.total).toBeCloseTo(base.cargas.paredes + base.cargas.puertas + base.cargas.genero + base.cargas.interna, 6);
    expect(base.kwhDia).toBeCloseTo(FICHA.potenciaKw * base.marcha * 24, 6);
  });

  it("la marcha sale de lo que sube parada y lo que baja en marcha", () => {
    const e = esperado(FICHA, -25);
    expect(marchaDe(ritmoEsperado(FICHA, -25))).toBeCloseTo(e.marcha, 6);
  });

  it("un servicio sin compresor propio usa el frío de la central y no gasta luz propia", () => {
    const e = esperado(FICHAS.c7, 8);
    expect(e.frioKw).toBe(22);
    expect(e.kwhDia).toBe(0);
    expect(e.marcha).toBeGreaterThan(0);
  });

  it("calcula el tiempo hasta el límite y el de enfriado, y sabe cuándo no se llega", () => {
    const r: Ritmo = { subidaCh: 8, bajadaCh: 7, consigna: -25, exteriorC: 20 };
    const sube = minutosDeSubida(r, -25, -18)!;
    // Sin corrección serían 52,5 min; como se acerca al exterior, tarda un poco más.
    expect(sube).toBeGreaterThan(52.5);
    expect(sube).toBeLessThan(60);
    expect(minutosDeSubida(r, -25, 25)).toBeNull();
    const baja = minutosDeBajada(r, -18, -25)!;
    expect(baja).toBeGreaterThan(40);
    expect(baja).toBeLessThan(60);
    // Con ese tirón el equipo no baja de unos −64 °C por mucho que trabaje.
    expect(minutosDeBajada(r, -18, -80)).toBeNull();
  });

  it("avisa con reglas fijas cuando lo medido se aparta de lo esperado", () => {
    const esp: Ritmo = { subidaCh: 8, bajadaCh: 8, consigna: -25, exteriorC: 20 };
    expect(comparar(esp, esp, 22, -18).avisos).toEqual([]);
    const pierde = comparar(esp, { ...esp, subidaCh: 11, bajadaCh: 5 }, 22, -18);
    expect(pierde.avisos.map((a) => a.clave)).toEqual(["pierde"]);
    expect(pierde.sobraKwhDia).toBeCloseTo(22 * (11 / 16 - 0.5) * 24, 6);
    const enfria = comparar(esp, { ...esp, subidaCh: 8, bajadaCh: 4 }, 22, -18);
    expect(enfria.avisos.map((a) => a.clave)).toEqual(["enfria"]);
    const justo = comparar(esp, { ...esp, subidaCh: 14, bajadaCh: 2 }, 22, -18);
    expect(justo.avisos.map((a) => a.clave)).toContain("limite");
    expect(comparar(esp, { ...esp, subidaCh: 20, bajadaCh: 20 }, 22, -18).avisos.map((a) => a.clave)).toContain("margen");
  });
});

/** Diente de sierra limpio: sube `a` °C/h hasta +0,7 y baja `b` °C/h hasta −0,7. */
function sierra(a: number, b: number, minutos: number, ruido = 0): Muestra[] {
  const out: Muestra[] = [];
  let temp = 0, sube = true;
  for (let i = 0; i <= minutos; i++) {
    out.push({ t: T + i * MIN, temp: temp + ruido * Math.sin(i * 12.9898) , vale: true });
    temp += (sube ? a : -b) / 60;
    if (temp >= 0.7) sube = false;
    else if (temp <= -0.7) sube = true;
  }
  return out;
}

describe("huella sacada de los ciclos", () => {
  it("mide la pendiente de una recta", () => {
    expect(pendiente([0, 1, 2, 3].map((i) => ({ t: T + i * 30 * MIN, temp: i })))).toBeCloseTo(2, 6);
  });

  it("recupera lo que sube y lo que baja de un diente de sierra, también con temblor de sonda", () => {
    for (const ruido of [0, 0.08]) {
      const m = medirCiclos(sierra(8, 6, 240, ruido))!;
      expect(m.subidaCh).toBeGreaterThan(8 * 0.9);
      expect(m.subidaCh).toBeLessThan(8 * 1.1);
      expect(m.bajadaCh).toBeGreaterThan(6 * 0.9);
      expect(m.bajadaCh).toBeLessThan(6 * 1.1);
      expect(m.ciclos).toBeGreaterThanOrEqual(8);
    }
  });

  it("no da huella sin ciclos suficientes ni con una temperatura plana", () => {
    expect(medirCiclos(sierra(8, 6, 20))).toBeNull();
    expect(medirCiclos(Array.from({ length: 300 }, (_, i) => ({ t: T + i * MIN, temp: -25, vale: true })))).toBeNull();
    expect(medirCiclos([])).toBeNull();
  });

  it("no usa las lecturas que no valen", () => {
    const serie = sierra(8, 6, 240).map((p, i) => (i > 100 && i < 130 ? { ...p, temp: p.temp + 6, vale: false } : p));
    const m = medirCiclos(serie)!;
    expect(m.subidaCh).toBeLessThan(8 * 1.1);
  });

  it("en la demostración mide cada servicio cerca de la forma real de su ciclo, con seis horas", () => {
    for (const c of CAMARAS) {
      const m = huellaDeCiclos(c, T, 6);
      expect(m, c.nombre).not.toBeNull();
      const real = ritmoReal(c, 20);
      expect(Math.abs(m!.subidaCh / real.subidaCh - 1), `subida de ${c.nombre}`).toBeLessThan(0.2);
      expect(Math.abs(m!.bajadaCh / real.bajadaCh - 1), `bajada de ${c.nombre}`).toBeLessThan(0.2);
    }
  });

  it("deja fuera las puertas y los desescarches", () => {
    const m = muestrasDe(camara("c1"), T - 12 * 60 * MIN, T);
    expect(m.some((p) => !p.vale)).toBe(true);
    expect(m.filter((p) => p.vale).length).toBeGreaterThan(m.length / 2);
  });

  it("dice cuánto ha cambiado una huella", () => {
    const d = deriva({ subidaCh: 8, bajadaCh: 8 }, { subidaCh: 10, bajadaCh: 6 });
    expect(d.perdida).toBeCloseTo(0.25, 6);
    expect(d.tiron).toBeCloseTo(0, 6);
  });
});

describe("avisos del primer día en la demostración", () => {
  const veredicto = (id: string) => {
    const c = camara(id);
    const m = huellaDeCiclos(c, T, 6)!;
    return comparar(ritmoEsperado(FICHAS[id], c.consigna), ritmoDe(m, c.consigna, FICHAS[id].exteriorC), c.potenciaKw, c.limite);
  };

  it("la Cámara 1 se porta como se espera", () => {
    expect(veredicto("c1").avisos.filter((a) => a.clave === "pierde" || a.clave === "enfria")).toEqual([]);
  });
  it("la Cámara 2 enfría más despacio de lo esperado", () => {
    expect(veredicto("c2").avisos.map((a) => a.clave)).toContain("enfria");
  });
  it("la Cámara 3 pierde frío más rápido de lo esperado", () => {
    expect(veredicto("c3").avisos.map((a) => a.clave)).toContain("pierde");
  });
});

describe("perfiles compartidos", () => {
  it("cada clase de servicio tiene su perfil", () => {
    expect(perfilPara("camara", "congelado").id).toBe("camara-congelado");
    expect(perfilPara("camara", "fresco").id).toBe("camara-fresco");
    expect(perfilPara("tunel", "congelado").id).toBe("tunel");
    expect(perfilPara("mueble", "fresco").id).toBe("mueble");
  });

  it("con el volumen y la potencia da una ficha completa y creíble", () => {
    for (const p of PERFILES) {
      const f = fichaDePerfil(p, p.clase === "mueble" ? 12 : p.clase === "tunel" ? 400 : 1500, p.clase === "muelle" ? 0 : p.clase === "tunel" ? 30 : p.clase === "mueble" ? 3 : 15, p.clase === "muelle" ? 20 : undefined);
      const e = esperado(f, p.tipo === "congelado" ? -22 : 4);
      expect(e.marcha, p.nombre).toBeGreaterThan(0.1);
      expect(e.marcha, p.nombre).toBeLessThan(1.5);
      expect(e.subidaCh, p.nombre).toBeGreaterThan(0);
    }
  });

  it("sin cámaras medidas manda la teoría; con muchas, lo medido", () => {
    expect(ajusteDe([])).toMatchObject({ perdida: 1, tiron: 1, usados: 0 });
    const una = ajusteDe([{ perdida: 1.2, tiron: 1 }]);
    expect(una.perdida).toBeCloseTo(1.05, 6);
    const muchas = ajusteDe(Array.from({ length: 27 }, () => ({ perdida: 1.2, tiron: 0.9 })));
    expect(muchas.perdida).toBeCloseTo(1.18, 6);
    expect(muchas.tiron).toBeCloseTo(0.91, 6);
  });

  it("una cámara con un problema no contagia a las demás", () => {
    const a = ajusteDe([{ perdida: 1, tiron: 1 }, { perdida: 1.05, tiron: 1 }, { perdida: 1.9, tiron: 0.5 }]);
    expect(a.usados).toBe(2);
    expect(a.perdida).toBeLessThan(1.02);
  });

  it("aplicar a la teoría el aporte de una cámara devuelve lo que se midió en ella", () => {
    const teoria: Ritmo = { subidaCh: 8, bajadaCh: 7, consigna: -25, exteriorC: 20 };
    const medido: Ritmo = { ...teoria, subidaCh: 9, bajadaCh: 5 };
    const r = conAjuste(teoria, aporteDe(teoria, medido));
    expect(r.subidaCh).toBeCloseTo(9, 6);
    expect(r.bajadaCh).toBeCloseTo(5, 6);
  });
});

/** Hace la prueba entera contra una cámara simulada. `cambia` permite estropear una lectura. */
function hacerPrueba(planta: Planta, limite: number, cambia: (l: Lectura, e: EstadoPrueba) => Lectura = (l) => l) {
  const plan = planDePrueba(planta.ritmo.consigna, limite);
  let e = empezar(plan, "Técnica de pruebas", planta.ritmo.exteriorC, T);
  let p = planta;
  let maxima = -Infinity;
  for (let s = 10; s <= 90 * 60 && !e.fin; s += 10) {
    p = pasoPlanta(p, e.consignaPedida, 10);
    maxima = Math.max(maxima, p.temp);
    e = avanzar(e, cambia({ t: T + s * 1000, temp: p.temp, puerta: false, desescarche: false, alarma: false }, e));
  }
  return { e, plan, maxima, planta: p };
}

describe("prueba de arranque", () => {
  const real: Ritmo = { subidaCh: 8.5, bajadaCh: 6.9, consigna: -25, exteriorC: 20 };

  it("nunca planea subir a menos de dos grados del límite del género", () => {
    for (const c of CAMARAS) {
      const plan = planDePrueba(c.consigna, c.limite);
      expect(plan.tope, c.nombre).toBeLessThanOrEqual(c.limite - 2);
      expect(plan.corte, c.nombre).toBeLessThan(c.limite);
      expect(plan.posible, c.nombre).toBe(true);
    }
    expect(planDePrueba(4, 6).posible).toBe(false);
    expect(planDePrueba(4, 6).motivo).toContain("poco sitio");
  });

  it("no arranca si alguna comprobación falla", () => {
    const plan = planDePrueba(-25, -18);
    const bien: Lectura = { t: T, temp: -25.2, puerta: false, desescarche: false, alarma: false };
    expect(comprobaciones(plan, bien, T).every((c) => c.bien)).toBe(true);
    expect(comprobaciones(plan, { ...bien, puerta: true }, T).every((c) => c.bien)).toBe(false);
    expect(comprobaciones(plan, { ...bien, temp: -21 }, T).every((c) => c.bien)).toBe(false);
    expect(comprobaciones(plan, bien, T + 5 * MIN).every((c) => c.bien)).toBe(false);
    expect(comprobaciones(plan, null, T).every((c) => c.bien)).toBe(false);
  });

  it("completa la prueba en una hora y saca la huella de la cámara", () => {
    const { e, plan, maxima } = hacerPrueba(plantaNueva(real), -18);
    expect(e.fin?.bien).toBe(true);
    expect((e.fin!.t - e.inicio) / MIN).toBeLessThanOrEqual(MINUTOS_TOTAL + 1);
    expect(e.resultado!.subidaCh).toBeGreaterThan(real.subidaCh * 0.92);
    expect(e.resultado!.subidaCh).toBeLessThan(real.subidaCh * 1.08);
    expect(e.resultado!.bajadaCh).toBeGreaterThan(real.bajadaCh * 0.92);
    expect(e.resultado!.bajadaCh).toBeLessThan(real.bajadaCh * 1.08);
    // Solo dos órdenes: subir y devolver. Y la consigna queda donde estaba.
    expect(e.ordenes.map((o) => o.consigna)).toEqual([plan.tope, -25]);
    expect(e.consignaPedida).toBe(-25);
    expect(maxima).toBeLessThan(plan.corte);
    expect(maxima).toBeLessThanOrEqual(-18 - 2);
  });

  it("acierta también en cámaras lentas y rápidas", () => {
    for (const r of [{ ...real, subidaCh: 3, bajadaCh: 4 }, { ...real, subidaCh: 14, bajadaCh: 12 }]) {
      const { e } = hacerPrueba(plantaNueva(r), -18);
      expect(e.fin?.bien).toBe(true);
      expect(Math.abs(e.resultado!.subidaCh / r.subidaCh - 1)).toBeLessThan(0.1);
      expect(Math.abs(e.resultado!.bajadaCh / r.bajadaCh - 1)).toBeLessThan(0.1);
    }
  });

  it("si la temperatura apenas se mueve, lo dice en vez de inventar una huella", () => {
    const { e } = hacerPrueba(plantaNueva({ ...real, subidaCh: 0.5, bajadaCh: 0.5 }), -18);
    expect(e.fin?.bien).toBe(false);
    expect(e.resultado).toBeUndefined();
    expect(e.consignaPedida).toBe(-25);
  });

  for (const [motivo, estropea] of [
    ["Se ha abierto la puerta", (l: Lectura) => ({ ...l, puerta: true })],
    ["Ha empezado un desescarche", (l: Lectura) => ({ ...l, desescarche: true })],
    ["Ha saltado una alarma en el servicio", (l: Lectura) => ({ ...l, alarma: true })],
    ["La temperatura ha subido más de lo previsto", (l: Lectura) => ({ ...l, temp: -21.5 })],
    ["Se han dejado de recibir lecturas", (l: Lectura) => ({ ...l, t: l.t + 5 * MIN })],
  ] as const) {
    it(`se para sola y devuelve la consigna: ${motivo.toLowerCase()}`, () => {
      const { e } = hacerPrueba(plantaNueva(real), -18, (l, est) => (est.fase === "subida" && l.t - est.faseDesde > 5 * MIN ? estropea(l) : l));
      expect(e.fin).toMatchObject({ bien: false, motivo });
      expect(e.consignaPedida).toBe(-25);
      expect(e.ordenes[e.ordenes.length - 1].consigna).toBe(-25);
      expect(e.resultado).toBeUndefined();
    });
  }

  it("una puerta que se abre un momento no la para", () => {
    let veces = 0;
    const { e } = hacerPrueba(plantaNueva(real), -18, (l, est) => (est.fase === "subida" && veces++ < 3 ? { ...l, puerta: true } : l));
    expect(e.fin?.bien).toBe(true);
  });

  it("parar a mano devuelve la consigna y no se puede parar dos veces", () => {
    let e = empezar(planDePrueba(-25, -18), "Técnica", 20, T);
    let p = plantaNueva(real);
    for (let s = 10; s <= 15 * 60; s += 10) {
      p = pasoPlanta(p, e.consignaPedida, 10);
      e = avanzar(e, { t: T + s * 1000, temp: p.temp, puerta: false, desescarche: false, alarma: false });
    }
    expect(e.fase).toBe("subida");
    expect(e.consignaPedida).toBe(-22.5);
    const parada = parar(e, T + 16 * MIN, "Parada por el técnico");
    expect(parada.consignaPedida).toBe(-25);
    expect(parada.ordenes).toHaveLength(2);
    expect(parar(parada, T + 17 * MIN, "Otra vez")).toBe(parada);
    expect(avanzar(parada, { t: T + 18 * MIN, temp: -24, puerta: false, desescarche: false, alarma: false })).toBe(parada);
  });

  it("la cámara simulada regula sola alrededor de su consigna", () => {
    let p = plantaNueva(real);
    let min = Infinity, max = -Infinity, enMarcha = 0;
    for (let i = 0; i < 6 * 360; i++) {
      p = pasoPlanta(p, -25, 10);
      if (i > 360) {
        min = Math.min(min, p.temp);
        max = Math.max(max, p.temp);
        if (p.compresor) enMarcha++;
      }
    }
    expect(min).toBeGreaterThan(-26);
    expect(max).toBeLessThan(-24);
    expect(enMarcha / (5 * 360)).toBeCloseTo(8.5 / (8.5 + 6.9), 1);
  });
});

describe("cuánto acierta lo previsto el primer día", () => {
  it("con seis horas de ciclos, la marcha prevista se queda a menos de un 10 % de la que se ve en dos semanas", () => {
    for (const c of CAMARAS) {
      const p = precisionDe(c, T);
      expect(p, c.nombre).not.toBeNull();
      expect(p!.ciclos, c.nombre).not.toBeNull();
      expect(p!.ciclos!.error, c.nombre).toBeLessThan(0.1);
      expect(p!.observada).toBeGreaterThan(0.3);
      expect(p!.observada).toBeLessThan(0.8);
    }
  });

  it("solo con la ficha el error es mayor en las cámaras que no se portan como deberían", () => {
    const bien = precisionDe(camara("c1"), T)!;
    const mal = precisionDe(camara("c3"), T)!;
    expect(bien.ficha.error).toBeLessThan(0.1);
    expect(mal.ficha.error).toBeGreaterThan(bien.ficha.error);
  });
});
