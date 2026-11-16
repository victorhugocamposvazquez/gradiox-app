import Link from "next/link";
import { ArrowRight, Bell, Cloud, Globe, type LucideIcon, Router, Server, Smartphone } from "lucide-react";
import { MasInfo } from "@/components/mas-info";
import { CHIP_CONEXION, CONEXIONES, PALABRAS, PASOS, PREGUNTAS, ROTULO_CONEXION } from "@/lib/ayuda";

export const metadata = { title: "Cómo funciona · Gradiox" };

const ICONOS: Record<string, LucideIcon> = { controlador: Server, pasarela: Router, internet: Globe, nube: Cloud, avisos: Bell, pantalla: Smartphone };

const MAPA: Record<string, string> = { controlador: "Controlador", pasarela: "Pasarela", internet: "Internet", nube: "Gradiox", avisos: "Avisos", pantalla: "Tu pantalla" };

export default function ComoFunciona() {
  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Cómo funciona</h1>
          <p className="gx-sub">Gradiox paso a paso. Cada paso tiene un botón con más detalle, para quien empieza y para quien ya sabe.</p>
        </div>
        <Link href="/sistema/plan" className="gx-boton secundario">
          Ver el plan <ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      </header>

      <div className="gx-pila">
        <section className="gx-tarjeta realce gx-resumen" aria-label="En una frase">
          <span className="gx-chip">En una frase</span>
          <p>Gradiox vigila el frío de una empresa las 24 horas, avisa antes de que se estropee el género y ayuda a gastar menos luz, usando los equipos que la empresa ya tiene.</p>
        </section>

        <section className="gx-tarjeta" aria-labelledby="recorrido">
          <h2 id="recorrido" className="gx-titulo-seccion">El recorrido, en seis pasos</h2>
          <p className="gx-sub">De la cámara a tu móvil, en el orden en que ocurre</p>
          <ol className="gx-mapa" aria-label="Los seis pasos de un vistazo">
            {PASOS.map((p, i) => (
              <li key={p.id}>
                <a href={`#paso-${p.id}`}>
                  <b aria-hidden="true">{i + 1}</b>
                  {MAPA[p.id]}
                </a>
              </li>
            ))}
          </ol>
          <ol className="gx-recorrido">
            {PASOS.map((p, i) => {
              const Icono = ICONOS[p.id];
              return (
                <li key={p.id} id={`paso-${p.id}`}>
                  <span className="numero" aria-hidden="true">{i + 1}</span>
                  <div className="contenido">
                    <h3>
                      <Icono size={18} strokeWidth={1.6} aria-hidden="true" />
                      {p.titulo}
                    </h3>
                    <p>{p.corto}</p>
                    <MasInfo tema={p} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="preguntas">
          <h2 id="preguntas" className="gx-titulo-seccion suelto">Lo que siempre se pregunta</h2>
          <div className="gx-rejilla">
            {PREGUNTAS.map((p) => (
              <article key={p.id} className="gx-tarjeta gx-pregunta">
                <h3>{p.titulo}</h3>
                <p>{p.corto}</p>
                <MasInfo tema={p} />
              </article>
            ))}
          </div>
        </section>

        <section className="gx-tarjeta" aria-labelledby="conexiones">
          <h2 id="conexiones" className="gx-titulo-seccion">Con qué equipos se entiende</h2>
          <p className="gx-sub">Gradiox se conecta a lo que el cliente ya tiene, sin cambiarle los equipos y sin atarle a una marca. Estas son las formas de conectar, de la más habitual a la menos.</p>
          <ul className="gx-conexiones">
            {CONEXIONES.map((c) => (
              <li key={c.id}>
                <div className="texto">
                  <h3>{c.titulo}</h3>
                  <p>{c.corto}</p>
                </div>
                <span className={`gx-chip ${CHIP_CONEXION[c.estado]}`}>{ROTULO_CONEXION[c.estado]}</span>
                <MasInfo tema={c} />
              </li>
            ))}
          </ul>
        </section>

        <section className="gx-tarjeta" aria-labelledby="palabras">
          <h2 id="palabras" className="gx-titulo-seccion">Palabras que verás</h2>
          <dl className="gx-palabras">
            {PALABRAS.map(([palabra, significado]) => (
              <div key={palabra}>
                <dt>{palabra}</dt>
                <dd>{significado}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="gx-nota">
          Hoy la app funciona con datos simulados, para enseñar cómo será. Lo que falta para la primera instalación real está en <Link href="/sistema/plan" style={{ color: "var(--gx-azul)", fontWeight: 500 }}>el plan</Link>.
        </p>
      </div>
    </>
  );
}
