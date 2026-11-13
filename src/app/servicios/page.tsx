"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ClipboardList, LayoutGrid, List, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { BarrasPrecio, ChipEstado, Chispa, Medidor, Senales, Temp } from "@/components/piezas";
import { minutosAlLimite, tendencia, ultimaHora, type Tendencia } from "@/lib/analisis";
import { duracion, gradosC, hora } from "@/lib/formato";
import { planDelDia, preciosDelDia } from "@/lib/luz";
import { CAMARAS, leer, type Estado } from "@/lib/sim";
import { useDemo } from "@/lib/store";

type Vista = "cuadricula" | "lista";
type Filtro = "todas" | Estado;
const CLAVE_VISTA = "gradiox-vista";
const GRAVEDAD: Record<Estado, number> = { error: 0, sindatos: 1, aviso: 2, correcto: 3 };
const FILTROS: { id: Filtro; texto: string }[] = [
  { id: "todas", texto: "Todos" },
  { id: "correcto", texto: "Bien" },
  { id: "aviso", texto: "Con aviso" },
  { id: "error", texto: "En alarma" },
  { id: "sindatos", texto: "Sin datos" },
];
const reloj = (t: number) => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Rumbo({ t, alerta }: { t: Tendencia; alerta: boolean }) {
  const Icono = t === "sube" ? ArrowUpRight : t === "baja" ? ArrowDownRight : Minus;
  return (
    <span className={`gx-tendencia${t === "sube" && alerta ? " sube" : ""}`}>
      <Icono size={16} strokeWidth={1.8} aria-hidden="true" />
      {t === "sube" ? "Subiendo" : t === "baja" ? "Bajando" : "Estable"}
    </span>
  );
}

export default function Inicio() {
  const { ahora, ajustes } = useDemo();
  const [vista, setVista] = useState<Vista>("cuadricula");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  useEffect(() => {
    try {
      if (window.localStorage.getItem(CLAVE_VISTA) === "lista") setVista("lista");
    } catch {
      // Sin almacenamiento se queda en cuadrícula.
    }
  }, []);
  if (ahora === null) return <p className="gx-sub">Leyendo los servicios…</p>;

  const elegir = (v: Vista) => {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Ver arriba.
    }
  };

  const todas = CAMARAS.map((c, orden) => ({
    c,
    orden,
    l: leer(c, ahora, ajustes),
    queda: minutosAlLimite(c, ahora, ajustes),
    rumbo: tendencia(c, ahora, ajustes),
    hora: ultimaHora(c, ahora, ajustes),
  })).sort((a, b) => GRAVEDAD[a.l.estado] - GRAVEDAD[b.l.estado] || a.orden - b.orden);
  const cuenta = (f: Filtro) => (f === "todas" ? todas.length : todas.filter((x) => x.l.estado === f).length);
  const visibles = filtro === "todas" ? todas : todas.filter((x) => x.l.estado === filtro);
  const alarmas = cuenta("error");
  const avisos = cuenta("aviso");
  const mudos = cuenta("sindatos");
  const titular = [alarmas ? `${alarmas} en alarma` : "", mudos ? `${mudos} sin datos` : ""].filter(Boolean).join(" · ") || (avisos ? `${avisos} con aviso` : "Todo en su sitio");

  const precios = preciosDelDia(new Date(ahora));
  const plan = planDelDia(precios);
  const h = new Date(ahora).getHours();
  const tramo = plan.baratas.includes(h) ? "Hora barata" : plan.caras.includes(h) ? "Hora cara" : "Hora normal";
  const debajo = (x: (typeof todas)[number]) =>
    x.l.estado === "sindatos" ? `Última lectura a las ${hora(x.l.ultima)}. No se sabe cómo está ahora.` : x.l.temp >= x.c.limite ? `Ha pasado el límite de ${gradosC(x.c.limite)}` : x.queda !== null ? `Llega al límite en ${duracion(x.queda * 60_000)}` : null;

  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Servicios</h1>
          <p className="gx-vivo" aria-live="off">
            <span className={`gx-punto vivo${alarmas ? " error" : mudos ? " sindatos" : avisos ? " aviso" : ""}`} />
            {titular} · en vivo, {reloj(ahora)}
          </p>
        </div>
        <Link href="/registro" className="gx-boton secundario">
          <ClipboardList size={18} strokeWidth={1.6} aria-hidden="true" /> Registro de temperaturas
        </Link>
      </header>

      <div className="gx-estado">
        {FILTROS.filter((f) => f.id !== "sindatos" || mudos > 0 || filtro === "sindatos").map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
            {f.id !== "todas" && <span className={`gx-punto ${f.id === "correcto" ? "" : f.id}`} />}
            {f.texto} <b>{cuenta(f.id)}</b>
          </button>
        ))}
        <div className="gx-vistas" role="group" aria-label="Cómo verlas">
          <button type="button" aria-pressed={vista === "cuadricula"} aria-label="Ver en cuadrícula" onClick={() => elegir("cuadricula")}>
            <LayoutGrid size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button type="button" aria-pressed={vista === "lista"} aria-label="Ver en lista" onClick={() => elegir("lista")}>
            <List size={18} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="gx-pila">
        {visibles.length === 0 ? (
          <p className="gx-tarjeta gx-vacio">{filtro === "error" ? "Ningún servicio en alarma." : filtro === "sindatos" ? "Llegan datos de todos los servicios." : filtro === "aviso" ? "Ningún servicio con aviso." : "Ningún servicio en este estado."}</p>
        ) : vista === "cuadricula" ? (
          <div className="gx-rejilla">
            {visibles.map((x) => (
              <Link key={x.c.id} href={`/servicios/${x.c.id}`} className={`gx-tarjeta gx-camara ${x.l.estado}`}>
                <div>
                  <h2>{x.c.nombre}</h2>
                  <p className="gx-sub">{x.c.tipo === "congelado" ? "Congelado" : "Fresco"} · consigna {gradosC(x.l.consigna)}</p>
                </div>
                <div className="gx-medida">
                  <div>
                    <Temp valor={x.l.temp} className={`gx-temp${x.l.estado === "error" ? " error" : ""}`} />
                    <Rumbo t={x.rumbo} alerta={x.l.estado === "aviso" || x.l.estado === "error"} />
                  </div>
                  <Chispa valores={x.hora} limite={x.c.limite} estado={x.l.estado} />
                </div>
                <Medidor temp={x.l.temp} consigna={x.l.consigna} limite={x.c.limite} estado={x.l.estado} />
                <Senales lectura={x.l} />
                <div>
                  <ChipEstado estado={x.l.estado} texto={x.l.motivo} />
                  {debajo(x) && <p className="gx-nota" style={{ marginTop: 6 }}>{debajo(x)}</p>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="gx-renglones">
            {visibles.map((x) => (
              <Link key={x.c.id} href={`/servicios/${x.c.id}`} className={`gx-renglon ${x.l.estado}`}>
                <span className="nombre">
                  {x.c.nombre}
                  <small>{x.c.tipo === "congelado" ? "Congelado" : "Fresco"} · consigna {gradosC(x.l.consigna)}</small>
                </span>
                <span className="cifra">
                  <Temp valor={x.l.temp} />
                  <Rumbo t={x.rumbo} alerta={x.l.estado === "aviso" || x.l.estado === "error"} />
                </span>
                <span className="medida"><Medidor temp={x.l.temp} consigna={x.l.consigna} limite={x.c.limite} estado={x.l.estado} /></span>
                <span className="solo-ancho"><Chispa valores={x.hora} limite={x.c.limite} estado={x.l.estado} /></span>
                <span className="solo-ancho"><Senales lectura={x.l} corto /></span>
                <span className="fin">
                  <ChipEstado estado={x.l.estado} texto={x.l.motivo} />
                  {debajo(x) && <small className="gx-nota" style={{ display: "block", marginTop: 4 }}>{debajo(x)}</small>}
                </span>
              </Link>
            ))}
          </div>
        )}

        <Link href="/luz" className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <div className="gx-fila">
            <div>
              <h2>Precio de la luz, hoy</h2>
              <p className="gx-sub">Ahora {precios[h]} €/MWh · precio simulado</p>
            </div>
            <span className={`gx-chip ${tramo === "Hora barata" ? "azul" : "neutro"}`}>{tramo}</span>
          </div>
          <BarrasPrecio precios={precios} baratas={plan.baratas} caras={plan.caras} horaActual={h} baja />
        </Link>
      </div>
    </>
  );
}
