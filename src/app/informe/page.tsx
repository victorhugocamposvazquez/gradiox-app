"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useMemo } from "react";
import { Marca } from "@/components/marca";
import { consumoHoy, registroDiario } from "@/lib/analisis";
import { EQUIPOS } from "@/lib/equipos";
import { ORDENES } from "@/lib/fallos";
import { duracion, euros, grados, hora } from "@/lib/formato";
import { NAVES } from "@/lib/naves";
import { AUTOMATAS, CAMARAS, PASARELA, eventos } from "@/lib/datos";
import { useDemo } from "@/lib/store";

const nombre = (id: string) => CAMARAS.find((c) => c.id === id)?.nombre ?? id;
const fechaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Informe() {
  const { ahora, ajustes, atendidas, seguimientos, registro, ordenes, precioReal } = useDemo();
  const cuarto = ahora === null ? null : Math.floor(ahora / 60_000);
  const datos = useMemo(() => {
    if (cuarto === null) return null;
    const t = cuarto * 60_000;
    const inicio = new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime();
    return {
      t,
      inicio,
      filas: CAMARAS.map((c) => ({ c, d: registroDiario(c, t, ajustes, 1)[0] ?? null, consumo: consumoHoy(c, t, ajustes) })),
      sucesos: eventos(t, ajustes).filter((e) => e.hasta >= inicio),
    };
  }, [cuarto, ajustes]);
  if (ahora === null || !datos) return <p className="gx-sub">Preparando el informe…</p>;

  const hoy = fechaLocal(new Date(ahora));
  const fechaLarga = new Date(ahora).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fuera = datos.filas.reduce((a, f) => a + (f.d?.minutosFuera ?? 0), 0);
  const sinDatos = datos.filas.reduce((a, f) => a + (f.d?.minutosSinDatos ?? 0), 0);
  const alarmas = datos.sucesos.filter((e) => e.estado === "error");
  const gasto = datos.filas.reduce((a, f) => a + f.consumo.euros, 0);
  const kwh = datos.filas.reduce((a, f) => a + f.consumo.kwh, 0);
  const intervenciones = registro.filter((r) => r.fecha === hoy);
  const ordenesHoy = ordenes.filter((o) => o.cuando >= datos.inicio);
  const cortes = ajustes.cortes ?? {};
  const caidos = [PASARELA, ...AUTOMATAS].filter((e) => cortes[e.id] !== undefined);

  return (
    <>
      <Link href="/" className="gx-volver gx-no-imprimir">
        <ArrowLeft size={18} aria-hidden="true" /> Hoy
      </Link>
      <header className="gx-cabecera">
        <div>
          <div className="gx-solo-papel"><Marca size={24} /></div>
          <h1>Informe del día</h1>
          <p className="gx-sub">{NAVES[0].nombre} · {fechaLarga} · sacado a las {hora(ahora)}</p>
        </div>
        <span className="gx-acciones gx-no-imprimir" style={{ marginTop: 0 }}>
        <Link href="/informe/mes" className="gx-boton secundario">Informe mensual</Link>
        <button type="button" className="gx-boton" onClick={() => window.print()}>
          <Printer size={18} strokeWidth={1.7} aria-hidden="true" /> Imprimir o guardar en PDF
        </button>
        </span>
      </header>

      <div className="gx-pila">
        <div className="gx-cifras">
          <div className={alarmas.length ? "mal" : undefined}><span>Alarmas de hoy</span><strong>{alarmas.length}</strong></div>
          <div className={fuera ? "mal" : undefined}><span>Tiempo sobre el límite</span><strong>{fuera ? duracion(fuera * 60_000) : "Nada"}</strong></div>
          <div className={sinDatos ? "mal" : undefined}><span>Tiempo sin datos</span><strong>{sinDatos ? duracion(sinDatos * 60_000) : "Nada"}</strong></div>
          <div><span>Luz gastada · {Math.round(kwh)} kWh</span><strong>{euros(gasto)} <small>estimado</small></strong></div>
        </div>

        <section className="gx-tarjeta gx-pila" style={{ gap: 12 }}>
          <h2>Temperaturas de hoy</h2>
          <div className="gx-desliza">
            <table className="gx-tabla">
              <thead>
                <tr>
                  <th scope="col">Servicio</th>
                  <th scope="col">Mínima</th>
                  <th scope="col">Máxima</th>
                  <th scope="col">Media</th>
                  <th scope="col">Límite</th>
                  <th scope="col">Sobre el límite</th>
                  <th scope="col">Sin datos</th>
                </tr>
              </thead>
              <tbody>
                {datos.filas.map(({ c, d }) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td>{d?.min == null ? "Sin datos" : grados(d.min)}</td>
                    <td>{d?.max == null ? "Sin datos" : grados(d.max)}</td>
                    <td>{d?.media == null ? "Sin datos" : grados(d.media)}</td>
                    <td>{grados(c.limite)}</td>
                    <td className={d?.minutosFuera ? "fuera" : undefined}>{d?.minutosFuera ? duracion(d.minutosFuera * 60_000) : "Nada"}</td>
                    <td>{d?.minutosSinDatos ? duracion(d.minutosSinDatos * 60_000) : "Nada"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gx-nota">Una lectura cada 15 minutos, desde las 00:00.</p>
        </section>

        <section className="gx-tarjeta">
          <h2>Avisos de hoy</h2>
          {datos.sucesos.length === 0 ? (
            <p className="gx-vacio">Ningún aviso. Todos los servicios han estado en su sitio.</p>
          ) : (
            <ul className="gx-lista">
              {datos.sucesos.slice(0, 30).map((e) => {
                const atendida = atendidas[`${e.camaraId}-${e.desde}`];
                return (
                  <li key={`${e.camaraId}-${e.desde}`}>
                    <span>
                      <strong style={{ fontWeight: 500 }}>{nombre(e.camaraId)}</strong> · {e.motivo}
                      <small>A las {hora(e.desde)} · {duracion(e.hasta - e.desde)}{e.estado === "error" ? (seguimientos[`${e.camaraId}-${e.desde}`]?.resuelta ? ` · resuelta: ${seguimientos[`${e.camaraId}-${e.desde}`].causa}` : atendida ? ` · vista a las ${hora(atendida)}` : " · sin mirar") : ""}</small>
                    </span>
                    <span className={`gx-chip ${e.estado}`}>{e.estado === "error" ? "Alarma" : e.estado === "sindatos" ? "Sin datos" : "Aviso"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="gx-dos igual">
          <section className="gx-tarjeta">
            <h2>Intervenciones y órdenes</h2>
            {intervenciones.length + ordenesHoy.length === 0 ? (
              <p className="gx-vacio">Hoy no se ha apuntado ninguna intervención ni se ha dado ninguna orden.</p>
            ) : (
              <ul className="gx-lista">
                {intervenciones.map((r) => (
                  <li key={r.id}><span>{r.tipo} · {EQUIPOS.find((e) => e.id === r.equipoId)?.nombre ?? r.equipoId}<small>{r.tecnico}. {r.nota}</small></span></li>
                ))}
                {ordenesHoy.map((o) => (
                  <li key={o.id}><span>{ORDENES[o.orden]} · {nombre(o.camaraId)}<small>A las {hora(o.cuando)}, {o.auto ? "sola" : "a mano"}. {o.resultado}</small></span></li>
                ))}
              </ul>
            )}
          </section>
          <section className="gx-tarjeta">
            <h2>Conexiones y luz</h2>
            <ul className="gx-lista">
              <li><span>Conexiones<small>{caidos.length ? `Sin conexión ahora: ${caidos.map((e) => e.nombre).join(", ")}.` : "Todos los equipos conectados ahora."}</small></span></li>
              <li><span>Plan de luz<small>{ajustes.planActivo ? "En marcha." : "Parado."} {precioReal ? "Precio real de Red Eléctrica." : "Precio simulado."}</small></span></li>
            </ul>
          </section>
        </div>

        <p className="gx-nota">Informe de una demostración con datos simulados. No sustituye al registro oficial de temperaturas.</p>
      </div>
    </>
  );
}
