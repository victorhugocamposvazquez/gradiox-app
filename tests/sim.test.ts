import { describe, expect, it } from "vitest";
import { ahorroEstimado, planDelDia, preciosDelDia } from "../src/lib/luz";
import { PERIODOS, consumoHoy, historia, marchaCompresor, minutosAlLimite, registroCsv, registroDiario, type Periodo } from "../src/lib/analisis";
import { FALLOS_INICIALES, fallosAhora, historico } from "../src/lib/fallos";
import { DURA_SESION_S, crearSesion, destinoSeguro, sesionValida } from "../src/lib/sesion";
import { FUENTE_SIMULADA, leer as leerDatos, usarFuente } from "../src/lib/datos";
import { GUARDIAS_INICIALES, escalado } from "../src/lib/guardias";
import { esPrecioReal, usarPreciosReales } from "../src/lib/luz";
import { NAVES, estadoNave } from "../src/lib/naves";
import { tiempoConectado } from "../src/lib/conexiones";
import { citasDelMes, registroInicial, semanasDelMes, type OrdenTrabajo } from "../src/lib/equipos";
import { comprobaciones, resumen, type Entrada } from "../src/lib/sistema";
import { MAXIMO, PREFERENCIAS_INICIALES, apilar, enSilencio, foto, interrumpe, novedades, type Noti } from "../src/lib/notificaciones";
import { AJUSTES_INICIALES, AUTOMATAS, CAMARAS, PASARELA, consignaEn, eventos, leer, serie, sinDatosDesde, type Ajustes } from "../src/lib/sim";

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

describe("cuentas sobre las lecturas", () => {
  const c = CAMARAS[0];

  it("sin averías no anuncia llegada al límite", () => {
    for (const x of CAMARAS) for (let m = 0; m < 24 * 60; m += 7) expect(minutosAlLimite(x, T + m * 60_000, AJUSTES_INICIALES)).toBeNull();
  });

  it("con el compresor parado dice cuánto queda y acierta", () => {
    const aj = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "compresor" as const, desde: T } } };
    const queda = minutosAlLimite(c, T + 20 * 60_000, aj);
    expect(queda).not.toBeNull();
    const llegada = T + (20 + (queda as number)) * 60_000;
    expect(leer(c, llegada - 3 * 60_000, aj).temp).toBeLessThan(c.limite);
    expect(leer(c, llegada + 3 * 60_000, aj).temp).toBeGreaterThanOrEqual(c.limite);
    expect(minutosAlLimite(c, T + 300 * 60_000, aj)).toBeNull();
  });

  it("el registro diario da siete días y marca el tiempo sobre el límite", () => {
    const limpio = registroDiario(c, T, AJUSTES_INICIALES);
    expect(limpio).toHaveLength(7);
    expect(limpio.every((d) => d.minutosFuera === 0 && d.min !== null && d.media !== null && d.max !== null && d.min <= d.media && d.media <= d.max)).toBe(true);
    const aj = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "compresor" as const, desde: T - 180 * 60_000 } } };
    expect(registroDiario(c, T, aj)[0].minutosFuera).toBeGreaterThan(0);
  });

  it("el CSV trae cabecera y una fila por lectura", () => {
    const filas = registroCsv(c, T, AJUSTES_INICIALES, 1).split("\r\n");
    expect(filas[0]).toContain("Temperatura");
    expect(filas).toHaveLength(1 + 15);
    expect(filas[1].split(";")).toHaveLength(8);
  });

  it("el consumo crece con las horas y la marcha ronda lo esperado", () => {
    const pronto = consumoHoy(c, T, AJUSTES_INICIALES);
    const tarde = consumoHoy(c, T + 6 * 3_600_000, AJUSTES_INICIALES);
    expect(pronto.kwh).toBeGreaterThan(0);
    expect(tarde.kwh).toBeGreaterThan(pronto.kwh);
    expect(tarde.euros).toBeGreaterThan(pronto.euros);
    const m = marchaCompresor(c, T, AJUSTES_INICIALES);
    expect(m.porcentaje).toBeGreaterThan(40);
    expect(m.porcentaje).toBeLessThan(75);
    expect(m.arranquesHora).toBeGreaterThan(1);
  });
});

describe("fallos típicos", () => {
  it("cuenta las repeticiones de siete días y reparte por días", () => {
    const h = historico(FALLOS_INICIALES, T, AJUSTES_INICIALES);
    const hielo = h.find((r) => r.fallo.id === "f-hielo" && r.camaraId === "c2");
    expect(hielo?.veces).toBeGreaterThanOrEqual(27);
    expect(hielo?.porDia).toHaveLength(7);
    expect(hielo?.porDia.reduce((a, b) => a + b, 0)).toBe(hielo?.veces);
    expect(h.some((r) => r.fallo.id === "f-hielo" && r.camaraId === "c1")).toBe(false);
    expect(h.some((r) => r.fallo.id === "f-compresor")).toBe(false);
  });

  it("reconoce el fallo que está pasando y uno añadido a mano", () => {
    const c = CAMARAS[0];
    const aj = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "compresor" as const, desde: T } } };
    const ahora = fallosAhora(FALLOS_INICIALES, c, leer(c, T + 30 * 60_000, aj));
    expect(ahora.map((f) => f.id)).toEqual(["f-compresor"]);
    const mio = { id: "x", nombre: "Puerta del muelle", senal: "puerta" as const, umbral: 2, revisar: "Mirar la cortina.", orden: "avisador" as const };
    const fresco = CAMARAS[3];
    const abierta = { ...AJUSTES_INICIALES, averias: { [fresco.id]: { tipo: "puerta" as const, desde: T } } };
    expect(fallosAhora([mio], fresco, leer(fresco, T + 3 * 60_000, abierta))).toHaveLength(1);
    expect(historico([mio], T + 3 * 60_000, abierta, 1).find((r) => r.camaraId === fresco.id)?.activo).toBe(true);
  });
});

describe("acceso", () => {
  const c = { usuario: "nave", clave: "una-clave-larga" };

  it("la sesión vale hasta que caduca y no admite retoques", async () => {
    const s = await crearSesion(c, T);
    expect(await sesionValida(s, c, T + 1000)).toBe(true);
    expect(await sesionValida(s, c, T + (DURA_SESION_S + 1) * 1000)).toBe(false);
    expect(await sesionValida(s, { ...c, clave: "otra" }, T + 1000)).toBe(false);
    const [caduca, firma] = s.split(".");
    expect(await sesionValida(`${Number(caduca) + 86_400_000}.${firma}`, c, T + 1000)).toBe(false);
    expect(await sesionValida(undefined, c, T)).toBe(false);
    expect(await sesionValida("basura", c, T)).toBe(false);
  });

  it("solo vuelve a rutas de la propia app", () => {
    expect(destinoSeguro("/servicios/c1")).toBe("/servicios/c1");
    expect(destinoSeguro("//fuera.example")).toBe("/");
    expect(destinoSeguro("https://fuera.example")).toBe("/");
    expect(destinoSeguro("/\\fuera.example")).toBe("/");
    expect(destinoSeguro("/login")).toBe("/");
    expect(destinoSeguro(null)).toBe("/");
  });
});

describe("conexiones", () => {
  const c = CAMARAS[0];
  const fresco = CAMARAS[3];

  it("sin conexión enseña la última lectura y la marca como sin datos", () => {
    const aj = { ...AJUSTES_INICIALES, cortes: { a1: T } };
    const antes = leer(c, T, AJUSTES_INICIALES);
    const luego = leer(c, T + 12 * 60_000, aj);
    expect(luego.estado).toBe("sindatos");
    expect(luego.temp).toBe(antes.temp);
    expect(luego.ultima).toBe(T);
    expect(luego.motivo).toBe("Sin datos hace 12 min");
    expect(leer(c, T - 60_000, aj).estado).not.toBe("sindatos");
    expect(leer(fresco, T + 12 * 60_000, aj).estado).not.toBe("sindatos");
  });

  it("si cae la pasarela no llega nada de ningún servicio", () => {
    const aj = { ...AJUSTES_INICIALES, cortes: { pasarela: T } };
    for (const x of CAMARAS) expect(sinDatosDesde(x.id, T + 60_000, aj)).toBe(T);
    expect(sinDatosDesde(c.id, T + 60_000, AJUSTES_INICIALES)).toBeNull();
  });

  it("sin datos no hay cuenta atrás, ni fallos, y el registro lo apunta", () => {
    const aj = { averias: { [c.id]: { tipo: "compresor" as const, desde: T - 30 * 60_000 } }, consignas: {}, planActivo: false, cortes: { a1: T - 10 * 60_000 } };
    expect(minutosAlLimite(c, T, aj)).toBeNull();
    expect(fallosAhora(FALLOS_INICIALES, c, leer(c, T, aj))).toHaveLength(0);
    const hoy = registroDiario(c, T, { ...AJUSTES_INICIALES, cortes: { a1: T - 60 * 60_000 } })[0];
    expect(hoy.minutosSinDatos).toBe(60);
    expect(registroCsv(c, T, { ...AJUSTES_INICIALES, cortes: { a1: T - 60 * 60_000 } }, 1)).toContain("Sin datos");
    expect(eventos(T, aj, 1).some((e) => e.camaraId === c.id && e.estado === "sindatos")).toBe(true);
  });
});

describe("notificaciones", () => {
  const sacar = (antes: Ajustes, despues: Ajustes, t0: number, t1: number) => novedades(foto(t0, antes, FALLOS_INICIALES), foto(t1, despues, FALLOS_INICIALES), t1, FALLOS_INICIALES);

  it("no avisa de lo que no ha cambiado", () => {
    expect(sacar(AJUSTES_INICIALES, AJUSTES_INICIALES, T, T)).toEqual([]);
  });

  it("una avería de compresor da una alarma del servicio", () => {
    const c = CAMARAS[0];
    const aj = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "compresor" as const, desde: T } } };
    const n = sacar(AJUSTES_INICIALES, aj, T, T + 90 * 60_000);
    expect(n.some((x) => x.tipo === "alarma" && x.href === `/servicios/${c.id}`)).toBe(true);
    // Si ya estaba en alarma, no se repite.
    expect(sacar(aj, aj, T + 90 * 60_000, T + 92 * 60_000).filter((x) => x.tipo === "alarma")).toEqual([]);
  });

  it("un corte de conexión avisa una vez por equipo y al volver lo dice", () => {
    const a = AUTOMATAS[0];
    const cortado = { ...AJUSTES_INICIALES, cortes: { [a.id]: T } };
    const corte = sacar(AJUSTES_INICIALES, cortado, T, T + 2000);
    expect(corte.map((x) => x.tipo)).toEqual(["conexion"]);
    expect(corte[0].titulo).toContain(a.nombre);
    const vuelta = sacar(cortado, AJUSTES_INICIALES, T + 2000, T + 4000);
    expect(vuelta.some((x) => x.tipo === "recuperado" && x.href === "/conexiones")).toBe(true);
    expect(vuelta.some((x) => x.tipo === "conexion")).toBe(false);
  });

  it("apila sin duplicar y con un máximo", () => {
    const una = sacar(AJUSTES_INICIALES, { ...AJUSTES_INICIALES, cortes: { [PASARELA.id]: T } }, T, T + 2000);
    expect(apilar(apilar([], una), una)).toHaveLength(una.length);
    const muchas = Array.from({ length: MAXIMO + 10 }, (_, i) => ({ ...una[0], id: `x${i}` }));
    expect(apilar([], muchas)).toHaveLength(MAXIMO);
  });
});

describe("mejoras de producto", () => {
  it("un desescarche extra para el compresor veinte minutos y luego se acaba", () => {
    const c = CAMARAS[3];
    const aj = { ...AJUSTES_INICIALES, desescarches: { [c.id]: T } };
    expect(leer(c, T + 5 * 60_000, aj)).toMatchObject({ desescarche: true, compresor: false });
    expect(leer(c, T + 25 * 60_000, aj).desescarche).toBe(false);
  });

  it("el escalado avisa al primero y va pasando al siguiente", () => {
    const g = GUARDIAS_INICIALES;
    expect(escalado(T, T + 60_000, g, 10)).toMatchObject({ avisados: [g[0]], siguiente: g[1], faltanMin: 9 });
    expect(escalado(T, T + 12 * 60_000, g, 10).avisados).toEqual([g[0], g[1]]);
    expect(escalado(T, T + 300 * 60_000, g, 10)).toMatchObject({ avisados: g, siguiente: null });
  });

  it("la nave de demostración refleja sus alarmas y sus cortes", () => {
    expect(estadoNave(NAVES[0], 0, T, AJUSTES_INICIALES).alarmas).toBe(0);
    const averia = { ...AJUSTES_INICIALES, averias: { [CAMARAS[0].id]: { tipo: "compresor" as const, desde: T - 60_000 } } };
    expect(estadoNave(NAVES[0], 0, T, averia)).toMatchObject({ estado: "error", alarmas: 1 });
    expect(estadoNave(NAVES[0], 0, T, { ...AJUSTES_INICIALES, cortes: { [PASARELA.id]: T - 1000 } }).estado).toBe("sindatos");
  });

  it("el precio real sustituye al simulado solo en su día", () => {
    const hoy = new Date(2026, 10, 13);
    const reales = Array.from({ length: 24 }, (_, h) => 100 + h);
    usarPreciosReales("2026-11-13", reales);
    expect(esPrecioReal(hoy)).toBe(true);
    expect(preciosDelDia(hoy)).toEqual(reales);
    expect(esPrecioReal(new Date(2026, 10, 14))).toBe(false);
    usarPreciosReales("2026-11-13", []);
    expect(esPrecioReal(hoy)).toBe(false);
  });

  it("los cálculos leen de la fuente que se les dé", () => {
    const c = CAMARAS[0];
    usarFuente({ ...FUENTE_SIMULADA, nombre: "Prueba", leer: (cam, t) => ({ ...leer(cam, t), temp: 99, estado: "error", motivo: "De prueba" }) });
    expect(leerDatos(c, T).temp).toBe(99);
    expect(foto(T, AJUSTES_INICIALES, []).camaras[c.id].estado).toBe("error");
    usarFuente(FUENTE_SIMULADA);
    expect(leerDatos(c, T)).toEqual(leer(c, T));
  });
});

describe("gráfica por periodos", () => {
  const c = CAMARAS[0];
  it("cada periodo cubre sus horas y no pasa de unos cientos de puntos", () => {
    for (const p of Object.keys(PERIODOS) as Periodo[]) {
      const h = historia(c, T, AJUSTES_INICIALES, p);
      expect(h.hasta - h.desde).toBe(PERIODOS[p].horas * 3_600_000);
      expect(h.puntos.length).toBeGreaterThan(50);
      expect(h.puntos.length).toBeLessThan(800);
    }
  });

  it("marca los desescarches en 24 horas y no en 30 días", () => {
    expect(historia(c, T, AJUSTES_INICIALES, "24h").marcas.filter((m) => m.tipo === "desescarche").length).toBeGreaterThanOrEqual(3);
    expect(historia(c, T, AJUSTES_INICIALES, "30d").marcas.filter((m) => m.tipo === "desescarche")).toEqual([]);
  });

  it("marca la alarma de una avería y corta la línea cuando no hay datos", () => {
    const averia = { ...AJUSTES_INICIALES, averias: { [c.id]: { tipo: "compresor" as const, desde: T - 30 * 60_000 } } };
    const alarma = historia(c, T, averia, "1h").marcas.find((m) => m.tipo === "alarma");
    expect(alarma?.desde).toBe(T - 30 * 60_000);
    const mudo = historia(c, T, { ...AJUSTES_INICIALES, cortes: { [PASARELA.id]: T - 20 * 60_000 } }, "1h");
    expect(mudo.puntos[mudo.puntos.length - 1].temp).toBeNull();
    expect(mudo.marcas.some((m) => m.tipo === "sindatos")).toBe(true);
  });

  it("en periodos largos cada punto lleva su mínima y su máxima", () => {
    const p = historia(c, T, AJUSTES_INICIALES, "7d").puntos[10];
    expect(p.min).toBeLessThanOrEqual(p.temp as number);
    expect(p.max).toBeGreaterThanOrEqual(p.temp as number);
  });
});

describe("clases de servicio", () => {
  it("el muelle no tiene compresor y el mueble no tiene puerta", () => {
    const muelle = CAMARAS.find((x) => x.clase === "muelle")!;
    const mueble = CAMARAS.find((x) => x.clase === "mueble")!;
    for (const l of serie(muelle, T, AJUSTES_INICIALES, 24, 5)) expect(l.compresor).toBe(false);
    for (const l of serie(mueble, T + 9 * 3_600_000, AJUSTES_INICIALES, 24, 1)) expect(l.puerta).toBe(false);
  });

  it("el plan de la luz no toca el túnel", () => {
    const tunel = CAMARAS.find((x) => x.clase === "tunel")!;
    for (let h = 0; h < 24; h++) expect(consignaEn(tunel, T + h * 3_600_000, { ...AJUSTES_INICIALES, planActivo: true })).toBe(tunel.consigna);
  });

  it("todo servicio cuelga de un autómata", () => {
    for (const x of CAMARAS) expect(AUTOMATAS.filter((a) => a.camaras.includes(x.id)).length).toBe(1);
  });
});

describe("comprobaciones del sistema", () => {
  const base: Entrada = {
    fuente: { nombre: "Simulación", simulada: true }, pasarelaCaida: false, automatas: 2, automatasCaidos: 0, servicios: 8, serviciosMudos: 0, ultimaLecturaS: 4, sondeoS: 10,
    precio: { real: true, leido: T }, servidor: { ms: 80, desfaseS: 0 }, enLinea: true, guardado: true, permiso: "granted", trabajador: true, tiposActivos: 4, tiposTotales: 6,
    guardias: 3, esperaMin: 10, alarmas: 0, alarmasNuevas: 0, revisionesVencidas: 0, ordenesAbiertas: 0, ordenesAtrasadas: 0, fallos: 4, fallosAuto: 0, horaTexto: () => "03:30",
  };
  const nivel = (e: Entrada, id: string) => comprobaciones(e).find((c) => c.id === id)?.nivel;

  it("lo simulado no cuenta ni como bien ni como mal", () => {
    const lista = comprobaciones(base);
    expect(nivel(base, "fuente")).toBe("simulado");
    expect(resumen(lista).cuentan).toBe(lista.length - lista.filter((c) => c.nivel === "simulado").length);
    expect(resumen(lista).mal).toBe(0);
  });

  it("sin pasarela fallan también los autómatas", () => {
    const e = { ...base, pasarelaCaida: true, serviciosMudos: 8 };
    expect(nivel(e, "pasarela")).toBe("mal");
    expect(nivel(e, "automatas")).toBe("mal");
    expect(nivel(e, "ritmo")).toBe("mal");
    expect(resumen(comprobaciones(e)).nivel).toBe("mal");
  });

  it("un reloj muy movido o un servidor callado se ven", () => {
    expect(nivel({ ...base, servidor: { ms: 90, desfaseS: 300 } }, "reloj")).toBe("mal");
    expect(nivel({ ...base, servidor: { ms: null, desfaseS: null } }, "servidor")).toBe("mal");
    expect(nivel({ ...base, precio: { real: false, leido: null } }, "precio")).toBe("mirar");
  });
});

describe("horario de silencio", () => {
  const noche = { ...PREFERENCIAS_INICIALES, silencio: true, silencioDesde: "22:00", silencioHasta: "07:00" };
  const a = (h: number, m = 0) => new Date(2026, 10, 13, h, m).getTime();
  const noti = (tipo: Noti["tipo"]): Noti => ({ id: tipo, cuando: T, tipo, titulo: "", texto: "", href: "/", leida: false });

  it("cruza la medianoche", () => {
    expect(enSilencio(noche, a(23, 30))).toBe(true);
    expect(enSilencio(noche, a(3))).toBe(true);
    expect(enSilencio(noche, a(7))).toBe(false);
    expect(enSilencio(noche, a(12))).toBe(false);
    expect(enSilencio({ ...noche, silencio: false }, a(3))).toBe(false);
  });

  it("en silencio solo interrumpen alarmas y cortes", () => {
    expect(interrumpe(noche, noti("alarma"), a(3))).toBe(true);
    expect(interrumpe(noche, noti("conexion"), a(3))).toBe(true);
    expect(interrumpe(noche, noti("fallo"), a(3))).toBe(false);
    expect(interrumpe(noche, noti("fallo"), a(12))).toBe(true);
  });
});

describe("histórico de avisos", () => {
  it("siete días traen al menos lo de las últimas 24 horas", () => {
    const dia = eventos(T, AJUSTES_INICIALES, 24);
    const semana = eventos(T, AJUSTES_INICIALES, 168);
    expect(semana.length).toBeGreaterThanOrEqual(dia.length);
    for (const e of semana) expect(T - e.desde).toBeLessThanOrEqual(168 * 3_600_000);
  });
});

describe("precio de hoy y de mañana", () => {
  it("guarda los dos días sin pisarse", () => {
    usarPreciosReales("2031-03-04", Array<number>(24).fill(50));
    usarPreciosReales("2031-03-05", Array<number>(24).fill(70));
    expect(preciosDelDia(new Date(2031, 2, 4))[0]).toBe(50);
    expect(preciosDelDia(new Date(2031, 2, 5))[0]).toBe(70);
    expect(esPrecioReal(new Date(2031, 2, 6))).toBe(false);
  });
});

describe("calendario de mantenimiento", () => {
  it("noviembre de 2026 empieza en domingo y tiene 30 días", () => {
    const semanas = semanasDelMes(2026, 10);
    expect(semanas[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(semanas.flat().filter(Boolean).length).toBe(30);
    for (const s of semanas) expect(s.length).toBe(7);
  });

  it("junta revisiones, órdenes abiertas y lo hecho, solo del mes", () => {
    const orden: OrdenTrabajo = { id: "t1", equipoId: "c1-comp", tipo: "Avería", tarea: "Cambiar el térmico", tecnico: "Técnico de zona", fecha: "2026-11-20", creada: T };
    const cerrada: OrdenTrabajo = { ...orden, id: "t2", fecha: "2026-11-21", cerrada: { cuando: T, nota: "" } };
    const citas = citasDelMes(2026, 10, registroInicial(T), [orden, cerrada], T);
    expect(citas.filter((c) => c.tipo === "orden").map((c) => c.fecha)).toEqual(["2026-11-20"]);
    expect(citas.some((c) => c.tipo === "hecho")).toBe(true);
    expect(citas.some((c) => c.tipo === "revision")).toBe(true);
    for (const c of citas) expect(c.fecha.startsWith("2026-11")).toBe(true);
  });
});

describe("tiempo conectado", () => {
  it("descuenta los cortes cerrados y el que sigue abierto", () => {
    const hora = 3_600_000;
    expect(tiempoConectado([], "a1", T, undefined)).toBe(100);
    expect(tiempoConectado([{ id: "k", equipoId: "a1", desde: T - 6 * hora, hasta: T - 3 * hora }], "a1", T, undefined)).toBe(87.5);
    expect(tiempoConectado([{ id: "k", equipoId: "a2", desde: T - 6 * hora, hasta: T - 3 * hora }], "a1", T, undefined)).toBe(100);
    expect(tiempoConectado([], "a1", T, T - 12 * hora)).toBe(50);
    expect(tiempoConectado([{ id: "k", equipoId: "a1", desde: T - 30 * hora, hasta: T - 18 * hora }], "a1", T, undefined)).toBe(75);
  });
});

describe("turno, ronda y buscador", () => {
  it("reparte el día en tres turnos y la noche cruza la medianoche", async () => {
    const { turnoDe } = await import("../src/lib/turno");
    const a = (h: number, m = 0) => new Date(2026, 10, 13, h, m).getTime();
    expect(turnoDe(a(6)).nombre).toBe("Turno de mañana");
    expect(turnoDe(a(13, 59)).nombre).toBe("Turno de mañana");
    expect(turnoDe(a(14)).nombre).toBe("Turno de tarde");
    expect(turnoDe(a(23)).nombre).toBe("Turno de noche");
    const noche = turnoDe(a(3, 30));
    expect(noche.nombre).toBe("Turno de noche");
    expect(noche.desde).toBe(new Date(2026, 10, 12, 22).getTime());
    expect(noche.hasta).toBe(a(6));
    expect(turnoDe(a(23)).hasta).toBe(new Date(2026, 10, 14, 6).getTime());
  });

  it("cuenta lo hecho y lo que queda por mirar en la ronda", async () => {
    const { avanceRonda, fechaLocal } = await import("../src/lib/turno");
    const puntos = ["Puertas", "Hielo", "Desagües"];
    expect(avanceRonda(puntos, undefined)).toEqual({ hechos: 0, total: 3, aMirar: 0 });
    const marcas = { Puertas: { ok: true, nota: "", cuando: T }, Hielo: { ok: false, nota: "mucho", cuando: T }, Quitado: { ok: false, nota: "", cuando: T } };
    expect(avanceRonda(puntos, marcas)).toEqual({ hechos: 2, total: 3, aMirar: 1 });
    expect(fechaLocal(T)).toBe("2026-11-13");
  });

  it("busca sin acentos ni mayúsculas y exige todas las palabras", async () => {
    const { buscar } = await import("../src/lib/turno");
    const todo = [
      { grupo: "Servicios", titulo: "Cámara 2", detalle: "Congelados", href: "/a" },
      { grupo: "Equipos", titulo: "Compresor de la cámara 1", detalle: "Compresor", href: "/b" },
      { grupo: "Pantallas", titulo: "Luz", detalle: "Precio por horas", href: "/c" },
    ];
    expect(buscar(todo, "CAMARA").map((h) => h.href)).toEqual(["/a", "/b"]);
    expect(buscar(todo, "camara compresor").map((h) => h.href)).toEqual(["/b"]);
    expect(buscar(todo, "  ")).toEqual([]);
    expect(buscar(todo, "tornillo")).toEqual([]);
  });
});

describe("recepción de mercancía", () => {
  it("lee temperaturas con coma, punto o signo menos tipográfico y rechaza lo demás", async () => {
    const { leerTemperatura } = await import("../src/lib/recepcion");
    expect(leerTemperatura("-18,5")).toBe(-18.5);
    expect(leerTemperatura(" −20 ")).toBe(-20);
    expect(leerTemperatura("3.2")).toBe(3.2);
    expect(leerTemperatura("")).toBeNull();
    expect(leerTemperatura("frío")).toBeNull();
    expect(leerTemperatura("180")).toBeNull();
  });

  it("compara con el límite del servicio y lo saca en la hoja de cálculo", async () => {
    const { llegaBien, recepcionesCsv } = await import("../src/lib/recepcion");
    expect(llegaBien(-18, -15)).toBe(true);
    expect(llegaBien(-15, -15)).toBe(true);
    expect(llegaBien(-12, -15)).toBe(false);
    const csv = recepcionesCsv(
      [{ id: "e1", cuando: T, camaraId: "c1", producto: 'Merluza "extra"', proveedor: "", temp: -12, nota: "" }],
      (id) => (id === "c1" ? { nombre: "Cámara 1", limite: -15 } : undefined),
    );
    const [cabecera, fila] = csv.split("\r\n");
    expect(cabecera.split(";")).toHaveLength(9);
    expect(fila).toContain('"Merluza ""extra"""');
    expect(fila).toContain("-12,0");
    expect(fila).toContain(";No;");
  });
});

describe("informe mensual", () => {
  it("junta los días en un resumen y pondera la media por lecturas", async () => {
    const { resumenPeriodo } = await import("../src/lib/analisis");
    const r = resumenPeriodo([
      { fecha: "2026-11-12", min: -25, max: -20, media: -22, minutosFuera: 0, minutosSinDatos: 0, lecturas: 96 },
      { fecha: "2026-11-13", min: -24, max: -10, media: -16, minutosFuera: 60, minutosSinDatos: 720, lecturas: 48 },
      { fecha: "2026-11-14", min: null, max: null, media: null, minutosFuera: 0, minutosSinDatos: 1440, lecturas: 0 },
    ]);
    expect(r.min).toBe(-25);
    expect(r.max).toBe(-10);
    expect(r.media).toBe(-20);
    expect(r.minutosFuera).toBe(60);
    expect(r.minutosSinDatos).toBe(2160);
    expect(r.minutosConDatos).toBe(144 * 15);
    expect(r.dentro).toBeCloseTo(1 - 60 / 2160, 6);
    expect(resumenPeriodo([]).dentro).toBeNull();
  });

  it("el registro da treinta días cuando se le piden", () => {
    const dias = registroDiario(CAMARAS[0], T, AJUSTES_INICIALES, 30);
    expect(dias).toHaveLength(30);
  });
});
