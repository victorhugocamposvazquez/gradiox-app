"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PruebaArranque, type PruebaHecha } from "@/components/prueba-arranque";
import { ritmoDe, type Medida } from "@/huella/ciclos";
import { DIAS_COMPROBACION, FICHAS, HORAS_PRIMERA_HUELLA, ROTULO_CONOCIMIENTO, ajusteDelPerfil, esperadoCon, huellaDeCiclos, perfilDe, precisionDe, type Conocimiento, type Precision } from "@/huella/demo";
import { PRODUCTOS, UMBRAL_ENFRIA, UMBRAL_PIERDE, comparar, esperado, marchaDe, minutosDeBajada, type ClaseProducto, type Comparacion, type FichaFisica, type Ritmo } from "@/huella/fisica";
import { APORTE_VALIDO, PERFILES, PESO_TEORIA, type Ajuste } from "@/huella/perfiles";
import { MINUTOS_TOTAL } from "@/huella/prueba";
import { preciosDelDia } from "@/lib/luz";
import { CAMARAS, rotulo, type Camara } from "@/lib/sim";

const CLAVE = "gradiox-arranque";
type Guardado = { fichas: Record<string, Partial<FichaFisica>>; pruebas: Record<string, PruebaHecha> };
const VACIO: Guardado = { fichas: {}, pruebas: {} };

const num = (n: number, decimales = 1) => n.toLocaleString("es-ES", { maximumFractionDigits: decimales });
const pct = (x: number) => `${Math.round(x * 100)} %`;
const signo = (x: number) => `${x >= 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)} %`;
const minutos = (m: number | null) => (m === null ? "No llega" : m >= 120 ? `${num(m / 60)} h` : `${Math.round(m)} min`);

type Fila = {
  camara: Camara;
  ficha: FichaFisica;
  ajuste: Ajuste;
  esperadoR: Ritmo;
  ciclos: Medida | null;
  medido: Ritmo | null;
  origen: Conocimiento;
  cmp: Comparacion | null;
  precision: Precision | null;
};

/** Un campo numérico de la ficha. */
function Campo({ texto, unidad, valor, cambia, paso = 1, min = 0 }: { texto: string; unidad: string; valor: number; cambia: (n: number) => void; paso?: number; min?: number }) {
  return (
    <label className="gx-campo">
      {texto} ({unidad})
      <input type="number" inputMode="decimal" value={Number.isFinite(valor) ? valor : ""} step={paso} min={min} onChange={(ev) => { const n = ev.target.valueAsNumber; if (Number.isFinite(n) && n >= min) cambia(n); }} />
    </label>
  );
}

/** Arranque sin espera: qué se espera de cada servicio desde el primer día, su huella medida y cuánto acierta. */
export default function Arranque() {
  const [ahora, setAhora] = useState<number | null>(null);
  const [guardado, setGuardado] = useState<Guardado>(VACIO);
  const [elegido, setElegido] = useState(CAMARAS[0].id);

  useEffect(() => {
    try {
      const g = JSON.parse(window.localStorage.getItem(CLAVE) ?? "null") as Partial<Guardado> | null;
      if (g) setGuardado({ fichas: g.fichas ?? {}, pruebas: g.pruebas ?? {} });
    } catch {
      // Sin almacenamiento se trabaja con los valores de la demostración.
    }
    const marcar = () => setAhora(Math.floor(Date.now() / 60_000) * 60_000);
    marcar();
    const id = window.setInterval(marcar, 20_000);
    return () => window.clearInterval(id);
  }, []);

  const guardar = useCallback((cambia: (g: Guardado) => Guardado) => {
    setGuardado((g) => {
      const nuevo = cambia(g);
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
      } catch {
        // Vale solo para esta visita.
      }
      return nuevo;
    });
  }, []);

  // Las huellas de los ciclos solo cambian con el reloj; se rehacen cada diez minutos.
  const tramo = ahora === null ? null : Math.floor(ahora / 600_000) * 600_000;
  const deCiclos = useMemo(() => (tramo === null ? null : Object.fromEntries(CAMARAS.map((c) => [c.id, huellaDeCiclos(c, tramo, 24)]))), [tramo]);
  const dia = ahora === null ? null : new Date(ahora).toDateString();

  const filas: Fila[] | null = useMemo(() => {
    if (!deCiclos || tramo === null) return null;
    const fichas = Object.fromEntries(CAMARAS.map((c) => [c.id, { ...FICHAS[c.id], ...guardado.fichas[c.id] }]));
    const medidos: Record<string, Ritmo | null> = {};
    for (const c of CAMARAS) {
      const p = guardado.pruebas[c.id], m = deCiclos[c.id];
      medidos[c.id] = p ? ritmoDe(p, c.consigna, fichas[c.id].exteriorC) : m ? ritmoDe(m, c.consigna, fichas[c.id].exteriorC) : null;
    }
    return CAMARAS.map((camara) => {
      const ficha = fichas[camara.id];
      const ajuste = ajusteDelPerfil(perfilDe(camara), medidos, camara.id, fichas);
      const esperadoR = esperadoCon(camara, ficha, ajuste);
      const medido = medidos[camara.id];
      return {
        camara,
        ficha,
        ajuste,
        esperadoR,
        ciclos: deCiclos[camara.id],
        medido,
        origen: guardado.pruebas[camara.id] ? "prueba" : medido ? "ciclos" : "ficha",
        cmp: medido ? comparar(esperadoR, medido, camara.potenciaKw, camara.limite) : null,
        precision: precisionDe(camara, tramo, undefined, ficha),
      };
    });
  }, [deCiclos, guardado, tramo]);

  const precioKwh = useMemo(() => (dia === null ? 0 : preciosDelDia(new Date(dia)).reduce((a, b) => a + b, 0) / 24 / 1000), [dia]);

  const cabecera = (
    <header className="gx-cabecera">
      <div>
        <h1>Arranque sin espera</h1>
        <p className="gx-sub">Qué se espera de cada servicio desde el primer día, cómo se mide su huella y cuánto acierta lo previsto.</p>
      </div>
      <span className="gx-chip neutro">Nave de demostración · datos simulados</span>
    </header>
  );

  if (!filas || ahora === null) return <>{cabecera}<p className="gx-vacio">Haciendo las cuentas de la nave…</p></>;

  const fila = filas.find((f) => f.camara.id === elegido) ?? filas[0];
  const { camara, ficha, cmp, medido, esperadoR } = fila;
  const teoria = esperado(ficha, camara.consigna);
  const cambiarFicha = (cambio: Partial<FichaFisica>) => guardar((g) => ({ ...g, fichas: { ...g.fichas, [camara.id]: { ...g.fichas[camara.id], ...cambio } } }));
  const fichaTocada = Object.keys(guardado.fichas[camara.id] ?? {}).length > 0;

  // Cuánto acierta, en conjunto.
  const conDato = filas.filter((f) => f.precision);
  const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const errorFicha = media(conDato.map((f) => f.precision!.ficha.error));
  const errorCiclos = media(conDato.filter((f) => f.precision!.ciclos).map((f) => f.precision!.ciclos!.error));
  const dePrueba = (f: Fila) => {
    const p = guardado.pruebas[f.camara.id];
    if (!p || !f.precision) return null;
    const marcha = marchaDe(ritmoDe(p, f.camara.consigna, f.ficha.exteriorC));
    return { marcha, error: Math.abs(marcha - f.precision.observada) / f.precision.observada };
  };
  const erroresPrueba = conDato.map(dePrueba).filter((x) => x !== null);
  const errorPrueba = media(erroresPrueba.map((x) => x.error));

  const estadoDe = (f: Fila): { tono: string; texto: string } => {
    if (!f.cmp) return { tono: "neutro", texto: "Aún sin medir" };
    const a = f.cmp.avisos.find((x) => x.clave !== "margen");
    if (!a) return { tono: "correcto", texto: "Como se espera" };
    return { tono: a.tono === "error" ? "error" : "aviso", texto: a.clave === "pierde" ? `Pierde frío ${signo(f.cmp.perdida)}` : a.clave === "enfria" ? `Enfría ${signo(f.cmp.tiron)}` : "Va al límite" };
  };

  const kwh = (r: Ritmo) => camara.potenciaKw * Math.min(1, marchaDe(r)) * 24;
  const caliente = Math.min(camara.limite, camara.consigna + 5);
  const enfriado = (r: Ritmo) => minutosDeBajada(r, caliente, camara.consigna + 0.5);
  const cargas: [string, number][] = [["Paredes, techo y suelo", teoria.cargas.paredes], ["Puertas", teoria.cargas.puertas], ["Género que entra", teoria.cargas.genero], ["Ventiladores, luces y lo demás", teoria.cargas.interna]];

  return (
    <>
      {cabecera}
      <div className="gx-pila">
        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Por qué no hace falta estudiar semanas a cada cliente</h2>
            <p className="gx-sub">Una cámara obedece a la física. Lo que pierde, lo que enfría y lo que gasta se puede calcular y medir en horas. Gradiox lo hace en tres pasos, cada uno más fino que el anterior.</p>
          </div>
          <ol className="gx-datos-pasos">
            <li>
              <strong>Antes de la primera lectura: la ficha</strong>
              <p>Con el volumen y la potencia, y un perfil que rellena lo demás, se calcula lo que debería pasar: cuánto calor entra, qué parte del tiempo trabaja el compresor y cuánto gasta.</p>
            </li>
            <li>
              <strong>En las primeras horas: sus ciclos</strong>
              <p>Cada vez que el compresor para y arranca es un experimento. Parado se ve cuánto pierde; en marcha, cuánto enfría. Con {HORAS_PRIMERA_HUELLA} horas de lecturas ya hay huella.</p>
            </li>
            <li>
              <strong>En una hora, si se quiere: la prueba</strong>
              <p>Con permiso del técnico se sube la consigna unos grados y se devuelve. Da una medida limpia, con la puerta cerrada, sin esperar a que los ciclos la enseñen.</p>
            </li>
          </ol>
          <p className="gx-nota">Lo que solo enseña el tiempo son las costumbres de cada cliente (a qué horas carga, cuánto abre), el verano y las averías raras. Eso sigue mejorando con las semanas, pero ya no hace falta para empezar a avisar.</p>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Cuánto acierta</h2>
            <p className="gx-sub">Se guarda lo que se previó el primer día y se compara con lo que el servicio ha hecho de verdad en los {DIAS_COMPROBACION} días siguientes. La cifra es la parte del tiempo que el compresor está en marcha, que es de donde sale el consumo.</p>
          </div>
          <dl className="gx-datos-cifras">
            <div><dt>Solo con la ficha</dt><dd>{errorFicha === null ? "Sin dato" : `${pct(errorFicha)} de error`}</dd><small>Antes de la primera lectura</small></div>
            <div><dt>Con {HORAS_PRIMERA_HUELLA} horas de ciclos</dt><dd>{errorCiclos === null ? "Sin dato" : `${pct(errorCiclos)} de error`}</dd><small>El primer día</small></div>
            <div><dt>Con la prueba de arranque</dt><dd>{errorPrueba === null ? "Sin pruebas hechas" : `${pct(errorPrueba)} de error`}</dd><small>{erroresPrueba.length ? `${erroresPrueba.length} de ${filas.length} servicios` : "Se hace más abajo, en cada servicio"}</small></div>
          </dl>
          <ul className="gx-arr-acierto">
            {filas.map((f) => {
              const p = f.precision, pr = dePrueba(f);
              return (
                <li key={f.camara.id}>
                  <strong>{f.camara.nombre}</strong>
                  {p ? (
                    <>
                      <span><small>Solo ficha</small>{pct(p.ficha.marcha)} <i>error {pct(p.ficha.error)}</i></span>
                      <span><small>Con ciclos</small>{p.ciclos ? <>{pct(p.ciclos.marcha)} <i>error {pct(p.ciclos.error)}</i></> : "Sin ciclos"}</span>
                      <span><small>Con prueba</small>{pr ? <>{pct(pr.marcha)} <i>error {pct(pr.error)}</i></> : "Sin hacer"}</span>
                      <span><small>Visto en {DIAS_COMPROBACION} días</small>{pct(p.observada)}</span>
                    </>
                  ) : <span><small>Sin lecturas suficientes</small></span>}
                </li>
              );
            })}
          </ul>
          <p className="gx-nota">Cuando la ficha sola falla mucho en un servicio, no siempre es que la cuenta esté mal: puede ser que la cámara tenga un problema. Por eso ese desvío sale como aviso el primer día y lo decide el técnico. En esta nave simulada los servicios se portan todos los días igual, así que los ciclos aciertan casi siempre: la cifra que cuenta será la de la primera instalación real, que se medirá aquí de la misma forma. Una prueba hecha hoy se compara con las dos semanas anteriores; en una instalación real, con las siguientes.</p>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Servicios</h2>
            <p className="gx-sub">Elige uno para ver su ficha, su huella y su prueba.</p>
          </div>
          <ul className="gx-arr-servicios">
            {filas.map((f) => {
              const e = estadoDe(f);
              return (
                <li key={f.camara.id}>
                  <button type="button" aria-pressed={f.camara.id === camara.id} onClick={() => setElegido(f.camara.id)}>
                    <span className="nombre"><strong>{f.camara.nombre}</strong><small>{rotulo(f.camara)} · {ROTULO_CONOCIMIENTO[f.origen].toLowerCase()}</small></span>
                    <span className={`gx-chip ${e.tono}`}>{e.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }} aria-live="polite">
          <div className="gx-fila">
            <div>
              <h2>{camara.nombre}: lo esperado frente a lo medido</h2>
              <p className="gx-sub">
                {fila.origen === "prueba" ? `Medido con la prueba de arranque del ${new Date(guardado.pruebas[camara.id].t).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}.` : fila.ciclos ? `Medido en ${fila.ciclos.ciclos} ciclos limpios de las últimas 24 horas, sin puertas ni desescarches.` : "Todavía no hay ciclos limpios suficientes para medir: de momento vale la ficha."}
              </p>
            </div>
            <span className={`gx-chip ${fila.origen === "ficha" ? "neutro" : "azul"}`}>{ROTULO_CONOCIMIENTO[fila.origen]}</span>
          </div>
          <table className="gx-tabla gx-arr-tabla">
            <thead>
              <tr><th scope="col">Qué</th><th scope="col">Esperado</th><th scope="col">Medido</th><th scope="col">Diferencia</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Parada, sube<small>Lo que pierde</small></th><td>{num(esperadoR.subidaCh)} °C/h</td><td>{medido ? `${num(medido.subidaCh)} °C/h` : "Sin medir"}</td><td className={cmp && cmp.perdida >= UMBRAL_PIERDE ? "fuera" : ""}>{cmp ? signo(cmp.perdida) : ""}</td></tr>
              <tr><th scope="row">En marcha, baja<small>Lo que enfría</small></th><td>{num(esperadoR.bajadaCh)} °C/h</td><td>{medido ? `${num(medido.bajadaCh)} °C/h` : "Sin medir"}</td><td className={cmp && cmp.tiron <= UMBRAL_ENFRIA ? "fuera" : ""}>{cmp ? signo(cmp.tiron) : ""}<small>en fuerza de frío</small></td></tr>
              <tr><th scope="row">Tiempo en marcha<small>Para mantenerse</small></th><td>{pct(marchaDe(esperadoR))}</td><td>{medido ? pct(marchaDe(medido)) : "Sin medir"}</td><td>{cmp ? `${cmp.marchaMedida >= cmp.marchaEsperada ? "+" : "−"}${Math.abs(Math.round((cmp.marchaMedida - cmp.marchaEsperada) * 100))} puntos` : ""}</td></tr>
              <tr><th scope="row">Consumo al día<small>{camara.sinCompresor ? "Frío de la central" : `Compresor de ${num(camara.potenciaKw)} kW`}</small></th><td>{camara.sinCompresor ? "No se cuenta" : `${Math.round(kwh(esperadoR))} kWh`}</td><td>{camara.sinCompresor ? "No se cuenta" : medido ? `${Math.round(kwh(medido))} kWh` : "Sin medir"}</td><td>{cmp && !camara.sinCompresor ? `${cmp.sobraKwhDia >= 0 ? "+" : "−"}${Math.abs(Math.round(cmp.sobraKwhDia))} kWh` : ""}</td></tr>
              <tr><th scope="row">Si se para el frío<small>Hasta el límite del género</small></th><td>{minutos(comparar(esperadoR, esperadoR, 0, camara.limite).autonomiaMin)}</td><td>{cmp ? minutos(cmp.autonomiaMin) : "Sin medir"}</td><td /></tr>
              <tr><th scope="row">Tiempo de enfriado<small>De {num(caliente)} °C a la consigna</small></th><td>{minutos(enfriado(esperadoR))}</td><td>{medido ? minutos(enfriado(medido)) : "Sin medir"}</td><td /></tr>
            </tbody>
          </table>
          {cmp && cmp.avisos.length > 0 && (
            <ul className="gx-lista gx-arr-avisos">
              {cmp.avisos.map((a) => (
                <li key={a.clave}>
                  <span>
                    <strong style={{ fontWeight: 500 }}><span className={`gx-chip ${a.tono}`}>{a.clave === "margen" ? "A saber" : "Aviso"}</span> {a.titulo}</strong>
                    <small>{a.detalle}</small>
                    {(a.clave === "pierde" || a.clave === "enfria") && !camara.sinCompresor && cmp.sobraKwhDia > 1 && <small>Le cuesta unos {Math.round(cmp.sobraKwhDia)} kWh al día de más: unos {num(cmp.sobraKwhDia * precioKwh, 0)} € al día con el precio medio de hoy. Cifra de la simulación.</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cmp && cmp.avisos.length === 0 && <p className="gx-nota">Se porta como se espera de una cámara con esta ficha. A partir de aquí, esta huella es su referencia: si un día cambia, Gradiox avisa de que ya no se porta como cuando se midió.</p>}
          {cmp && cmp.avisos.some((a) => a.clave === "pierde" || a.clave === "enfria") && <p className="gx-nota">El primer día este desvío puede ser una avería o un dato de la ficha mal puesto. El técnico lo mira una vez: si la ficha estaba mal, se corrige abajo; si la cámara está bien así, su huella medida queda como referencia y el aviso desaparece.</p>}
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <div>
              <h2>Ficha de {camara.nombre}</h2>
              <p className="gx-sub">Lo que entra en la cuenta. Al cambiar un dato, lo esperado de arriba se rehace al momento. Perfil de partida: {perfilDe(camara).nombre.toLowerCase()}.</p>
            </div>
            {fichaTocada && <button type="button" className="gx-boton secundario" onClick={() => guardar((g) => ({ ...g, fichas: { ...g.fichas, [camara.id]: {} } }))}><RotateCcw size={15} strokeWidth={1.7} aria-hidden="true" /> Volver a los datos de partida</button>}
          </div>
          <div className="gx-arr-ficha">
            <Campo texto="Volumen" unidad="m³" valor={ficha.volumenM3} min={1} cambia={(volumenM3) => cambiarFicha({ volumenM3 })} />
            <Campo texto="Espesor del panel" unidad="mm" valor={ficha.panelMm} min={20} paso={10} cambia={(panelMm) => cambiarFicha({ panelMm })} />
            <label className="gx-campo">
              Género
              <select value={ficha.producto} onChange={(ev) => cambiarFicha({ producto: ev.target.value as ClaseProducto })}>
                {Object.entries(PRODUCTOS).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
              </select>
            </label>
            <Campo texto="Género dentro" unidad="kg" valor={ficha.productoKg} paso={500} cambia={(productoKg) => cambiarFicha({ productoKg })} />
            <Campo texto="Temperatura alrededor" unidad="°C" valor={ficha.exteriorC} min={-10} cambia={(exteriorC) => cambiarFicha({ exteriorC })} />
            <Campo texto="Aperturas de puerta" unidad="por hora" valor={ficha.aperturasHora} cambia={(aperturasHora) => cambiarFicha({ aperturasHora })} />
            <Campo texto="Género que entra" unidad="kg al día" valor={ficha.entradaKgDia} paso={100} cambia={(entradaKgDia) => cambiarFicha({ entradaKgDia })} />
            <Campo texto="Entra a" unidad="°C" valor={ficha.entradaC} min={-40} cambia={(entradaC) => cambiarFicha({ entradaC })} />
          </div>
          <div>
            <h3 className="gx-arr-h3">De dónde viene el calor que hay que sacar</h3>
            <ul className="gx-arr-cargas">
              {cargas.map(([texto, kw]) => (
                <li key={texto}>
                  <span>{texto}</span>
                  <span className="barra"><i style={{ width: `${teoria.cargas.total > 0 ? (kw / teoria.cargas.total) * 100 : 0}%` }} /></span>
                  <span className="kw">{num(kw)} kW</span>
                </li>
              ))}
            </ul>
            <p className="gx-nota">En total entran {num(teoria.cargas.total)} kW de calor y el equipo saca {num(teoria.frioKw)} kW cuando está en marcha{camara.sinCompresor ? " (frío que le llega de la central)" : ` (${num(camara.potenciaKw)} kW eléctricos por ${num(teoria.cop, 2)} de rendimiento)`}. Por eso tiene que trabajar el {pct(teoria.marcha)} del tiempo.{fila.ajuste.usados > 0 ? ` Sobre esta teoría se aplica lo aprendido de ${fila.ajuste.usados === 1 ? "otra cámara parecida ya medida" : `otras ${fila.ajuste.usados} cámaras parecidas ya medidas`}.` : ""}</p>
          </div>
        </section>

        <PruebaArranque
          camara={camara}
          exteriorC={ficha.exteriorC}
          ahora={ahora}
          hecha={guardado.pruebas[camara.id]}
          alTerminar={(p) => guardar((g) => ({ ...g, pruebas: { ...g.pruebas, [camara.id]: p } }))}
        />
        {guardado.pruebas[camara.id] && (
          <p className="gx-nota" style={{ marginTop: -6 }}>
            <button type="button" className="gx-boton-enlace" onClick={() => guardar((g) => { const pruebas = { ...g.pruebas }; delete pruebas[camara.id]; return { ...g, pruebas }; })}>Olvidar la prueba de {camara.nombre} y volver a la huella de sus ciclos</button>
          </p>
        )}

        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Perfiles compartidos</h2>
            <p className="gx-sub">Una cámara nueva no empieza de cero: empieza con lo que ya se sabe de las que se le parecen. Del técnico solo hacen falta el volumen y la potencia; el perfil pone el resto y se corrige con cada cámara medida.</p>
          </div>
          <ul className="gx-arr-perfiles">
            {PERFILES.map((p) => {
              const suyas = filas.filter((f) => perfilDe(f.camara).id === p.id);
              const medidos = Object.fromEntries(suyas.map((f) => [f.camara.id, f.medido]));
              const a = ajusteDelPerfil(p, medidos, undefined, Object.fromEntries(filas.map((f) => [f.camara.id, f.ficha])));
              return (
                <li key={p.id}>
                  <div>
                    <strong>{p.nombre}</strong>
                    <small>{p.para}</small>
                  </div>
                  <span><small>De partida</small>Panel de {p.panelMm} mm · {p.kgPorM3} kg por m³ · {p.aperturasHora ? `${p.aperturasHora} aperturas por hora` : "sin puerta"}</span>
                  <span><small>Cámaras medidas</small>{a.aportes === 0 ? "Ninguna todavía" : `${a.usados} de ${a.aportes} cuentan`}{a.aportes > a.usados ? ` · ${a.aportes - a.usados} con aviso, fuera` : ""}</span>
                  <span><small>Corrección aprendida</small>{a.usados === 0 ? "Ninguna: vale la teoría" : `Pierde ×${num(a.perdida, 2)} · enfría ×${num(a.tiron, 2)}`}</span>
                </li>
              );
            })}
          </ul>
          <p className="gx-nota">De una instalación a otra no viaja ningún dato del cliente. Solo dos números por cámara: cuánto más o menos pierde que la teoría y cuánto más o menos enfría. Una cámara que se aparta tanto como para dar aviso (fuera de entre ×{num(APORTE_VALIDO[0], 2)} y ×{num(APORTE_VALIDO[1], 2)}) no cuenta: un problema de una no se le pega a las demás. Con pocas cámaras manda la teoría; hacen falta {PESO_TEORIA} medidas para pesar lo mismo que ella. Hoy los perfiles solo se alimentan de esta nave de demostración.</p>
        </section>

        <section className="gx-tarjeta gx-pila" style={{ gap: 10 }}>
          <div>
            <h2>Las cuentas, explicadas</h2>
            <p className="gx-sub">Sin inteligencia artificial: calor que entra, calor que sale y unas pocas reglas fijas.</p>
          </div>
          <details className="gx-arr-detalle">
            <summary>Cómo se calcula lo esperado con la ficha</summary>
            <ul>
              <li><b>Calor por las paredes.</b> Con el volumen se estima la superficie de paredes, techo y suelo. Cada metro de panel deja pasar más calor cuanto más fino es y cuanta más diferencia hay entre dentro y fuera.</li>
              <li><b>Calor por las puertas.</b> Cada apertura cambia unos 15 m³ de aire frío por aire de fuera, que además trae humedad que se hiela.</li>
              <li><b>Calor del género.</b> Los kilos que entran al día por lo que cuesta bajarlos a la consigna. Si cruzan el punto de congelación, congelarlos es la parte grande.</li>
              <li><b>Calor de dentro.</b> Ventiladores, luces y desescarches: una parte fija de la potencia.</li>
              <li><b>Frío del equipo.</b> La potencia eléctrica por su rendimiento, que baja cuanto más frío se pide y más calor hace fuera.</li>
              <li><b>Resultado.</b> El compresor tiene que estar en marcha el calor que entra dividido entre el frío que da. Por la potencia y por 24 horas sale el consumo del día.</li>
            </ul>
          </details>
          <details className="gx-arr-detalle">
            <summary>Cómo se mide la huella en los ciclos</summary>
            <ul>
              <li>Se cogen las lecturas de temperatura minuto a minuto y se quitan las que no valen: puerta abierta y los 10 minutos siguientes, desescarche y los 35 siguientes, alarmas y ratos sin datos.</li>
              <li>Se buscan los puntos donde la temperatura da la vuelta, sin hacer caso al temblor de la sonda. Entre dos vueltas hay un tramo: o sube (compresor parado) o baja (en marcha).</li>
              <li>De cada tramo se mide la pendiente en grados por hora y se toma el valor central de todos, que no se deja arrastrar por un tramo raro.</li>
              <li>No hace falta saber si el compresor está en marcha: basta una sonda de temperatura. Hacen falta al menos 3 subidas y 3 bajadas limpias.</li>
              <li>Tiempo en marcha necesario = lo que sube parada dividido entre lo que sube parada más lo que baja en marcha.</li>
            </ul>
          </details>
          <details className="gx-arr-detalle">
            <summary>Cómo es la prueba de arranque y por qué es segura</summary>
            <ul>
              <li>Gradiox no para ni arranca el compresor. Solo cambia la consigna: la sube como mucho 2,5 °C y la devuelve. Quien para y arranca es el regulador de la cámara, con todas sus protecciones.</li>
              <li>Nunca sube a menos de 2 °C del límite del género. Si no hay ese sitio, la prueba no se ofrece.</li>
              <li>Solo empieza con las seis comprobaciones cumplidas, el nombre de quien da el permiso y su casilla marcada. Dura {MINUTOS_TOTAL} minutos como mucho.</li>
              <li>Se para sola, devolviendo la consigna, si se abre la puerta más de un minuto, empieza un desescarche, salta una alarma, faltan lecturas un minuto o la temperatura pasa del tope.</li>
              <li>Cada cambio de consigna queda apuntado con su hora y con quién dio el permiso.</li>
              <li>Sirve sobre todo donde los ciclos no enseñan nada: equipos que regulan la potencia sin parar del todo, o cámaras con tanto trasiego que no hay ciclos limpios.</li>
            </ul>
          </details>
          <details className="gx-arr-detalle">
            <summary>Cuándo salta un aviso</summary>
            <ul>
              <li><b>Pierde frío más rápido de lo esperado:</b> parada sube un {pct(UMBRAL_PIERDE)} más deprisa o más.</li>
              <li><b>Enfría más despacio de lo esperado:</b> su fuerza de frío queda un {pct(-UMBRAL_ENFRIA)} por debajo o más.</li>
              <li><b>Va casi al límite:</b> necesita estar en marcha el 85 % del tiempo o más.</li>
              <li><b>Poco margen:</b> si se para el frío, llega al límite del género en menos de 30 minutos. Se calcula con el aire de la cámara, que es lo primero que se calienta; el género tarda más, así que la cifra queda del lado seguro.</li>
            </ul>
          </details>
          <details className="gx-arr-detalle">
            <summary>Qué es simulado hoy y qué falta para una instalación real</summary>
            <ul>
              <li>Todo esto trabaja sobre la nave de demostración. Las fichas de sus servicios son inventadas, de tamaño creíble. La prueba se hace contra una cámara simulada: no se manda ninguna orden a ningún equipo.</li>
              <li>Lo que se cambia aquí (fichas y pruebas) se guarda solo en este navegador.</li>
              <li>Para una instalación real falta: guardar ficha, huella y predicciones en la base de datos; leer las lecturas de la pasarela en vez de la simulación; y dar los dos cambios de consigna por el camino de órdenes con doble llave que ya existe. La pasarela además debe devolver la consigna ella sola si pierde la conexión a mitad de prueba.</li>
              <li>Las cifras de la cuenta (calor por apertura, parte del género que acompaña al aire, rendimiento) son valores de partida razonables, no medidos. Los perfiles están para corregirlos con las primeras cámaras reales.</li>
            </ul>
          </details>
        </section>
      </div>
    </>
  );
}
