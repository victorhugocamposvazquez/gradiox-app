import Link from "next/link";
import { Building2, Globe, type LucideIcon, Plug, Router, Server } from "lucide-react";
import { GuiaConexion } from "@/components/guia-conexion";
import { ListaVisita } from "@/components/lista-visita";
import { MasInfo } from "@/components/mas-info";
import { CABLES, COSTES, PASOS_VISITA, RESPUESTAS, ROTULOS_VISITA } from "@/lib/visita";

export const metadata = { title: "Guía de visita · Gradiox" };

const ICONO_CABLE: Record<string, LucideIcon> = { controladores: Server, internet: Globe, corriente: Plug };

export default function GuiaDeVisita() {
  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Guía de visita</h1>
          <p className="gx-sub">Para ir a ver a un cliente sin ser técnico: qué es el aparato, qué mirar, qué fotografiar y qué preguntar.</p>
        </div>
        <div className="gx-acciones-cabecera">
          <Link href="/ops" className="gx-boton secundario">
            <Building2 size={18} strokeWidth={1.6} aria-hidden="true" /> Dar de alta al cliente
          </Link>
        </div>
      </header>

      <div className="gx-pila">
        <section className="gx-tarjeta" aria-labelledby="aparato">
          <h2 id="aparato" className="gx-titulo-seccion">El aparato, en un minuto</h2>
          <p className="gx-sub">La pasarela puede ir de dos maneras y se elige con cada cliente. Como aparato de Gradiox: una caja pequeña, del tamaño de un router, sin pantalla. O como programa en un ordenador del cliente que ya esté siempre encendido junto al autómata. En los dos casos está en medio: escucha a los controladores y lleva lo que dicen a internet.</p>
          <div className="gx-aparato" role="img" aria-label="El aparato de Gradiox en el centro, con un cable a los controladores, otro a internet y otro a la corriente">
            <div className="centro">
              <Router size={26} strokeWidth={1.5} aria-hidden="true" />
              <strong>Aparato de Gradiox</strong>
              <small>En el cuadro eléctrico o al lado</small>
            </div>
            <ul>
              {CABLES.map((c) => {
                const Icono = ICONO_CABLE[c.id];
                return (
                  <li key={c.id}>
                    <span className="icono"><Icono size={18} strokeWidth={1.6} aria-hidden="true" /></span>
                    <span>
                      <strong>{c.titulo}</strong>
                      <small>{c.detalle}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="gx-nota">No se conecta a la cámara en sí, sino al controlador que la gobierna. Si una cámara es antigua y su controlador no tiene por dónde conectarse, se le pone una sonda de Gradiox. Si las cámaras están muy lejos unas de otras, puede hacer falta más de un aparato.</p>
        </section>

        <section className="gx-tarjeta" aria-labelledby="costes">
          <div className="gx-fila">
            <h2 id="costes" className="gx-titulo-seccion">Cuánto cuesta</h2>
            <span className="gx-chip aviso">Estimado</span>
          </div>
          <p className="gx-sub">Horquillas orientativas, sin presupuesto de ningún proveedor todavía. No las des al cliente.</p>
          <table className="gx-tabla" style={{ marginTop: 8 }}>
            <thead>
              <tr><th scope="col">Concepto</th><th scope="col">Estimación</th><th scope="col">Detalle</th></tr>
            </thead>
            <tbody>
              {COSTES.map((c) => (
                <tr key={c.concepto}>
                  <td>{c.concepto}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{c.importe}</td>
                  <td className="gx-sub">{c.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="gx-tarjeta" aria-labelledby="pasos">
          <h2 id="pasos" className="gx-titulo-seccion">La primera visita, paso a paso</h2>
          <p className="gx-sub">En el orden en que conviene hacerlo. Nunca abras un cuadro eléctrico ni toques cables: pide al técnico que lo haga.</p>
          <ol className="gx-recorrido">
            {PASOS_VISITA.map((p, i) => (
              <li key={p.id} id={`paso-${p.id}`}>
                <span className="numero" aria-hidden="true">{i + 1}</span>
                <div className="contenido">
                  <h3>{p.titulo}</h3>
                  <p>{p.corto}</p>
                  <MasInfo tema={p} rotulos={ROTULOS_VISITA} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="gx-tarjeta" aria-labelledby="conexion">
          <h2 id="conexion" className="gx-titulo-seccion">La visita de conexión</h2>
          <p className="gx-sub">Cuando el cliente tiene autómata y se va a la planta a que la pasarela lo lea. Es el paso «Programa instalado en la planta y leyendo el autómata» de la hoja de ruta de cada cliente. Ese día solo se lee: no se cambia nada en el autómata.</p>
          <GuiaConexion />
        </section>

        <div className="gx-dos igual">
          <section className="gx-tarjeta" aria-labelledby="lista">
            <h2 id="lista" className="gx-titulo-seccion">Lista para marcar</h2>
            <ListaVisita />
          </section>
          <section className="gx-tarjeta" aria-labelledby="respuestas">
            <h2 id="respuestas" className="gx-titulo-seccion">Lo que te van a preguntar</h2>
            <dl className="gx-respuestas">
              {RESPUESTAS.map((r) => (
                <div key={r.pregunta}>
                  <dt>{r.pregunta}</dt>
                  <dd>{r.respuesta}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
