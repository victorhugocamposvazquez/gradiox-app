import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ACTUALIZADO, CHIP_PLAN, DECISIONES, DOCUMENTO, FASES, ROTULO_PLAN, TAREAS, type Tarea } from "@/lib/plan";

export const metadata = { title: "Plan · Gradiox" };

function Tareas({ lista, conQuien }: { lista: Tarea[]; conQuien?: boolean }) {
  return (
    <ul className="gx-lista">
      {lista.map((t) => (
        <li key={t.texto}>
          <span>
            {t.texto}
            <small>
              Fase {t.fase}
              {conQuien ? ` · ${t.quien}` : ""}
              {t.nota ? ` · ${t.nota}` : ""}
            </small>
          </span>
          <span className={`gx-chip ${CHIP_PLAN[t.estado]}`}>{ROTULO_PLAN[t.estado]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Plan() {
  const hechas = TAREAS.filter((t) => t.estado === "hecho").length;
  const tuyas = TAREAS.filter((t) => t.quien === "Hugo" && t.estado !== "hecho");
  const abiertas = TAREAS.filter((t) => t.quien === "Gradiox" && t.estado !== "hecho");
  const cerradas = TAREAS.filter((t) => t.estado === "hecho");
  const fasesHechas = FASES.filter((f) => f.estado === "hecho").length;
  const fecha = new Date(`${ACTUALIZADO}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <Link href="/sistema" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Sistema
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Plan</h1>
          <p className="gx-sub">Cómo pasa Gradiox de la demostración a instalaciones reales · al día el {fecha}</p>
        </div>
        <div className="gx-acciones-cabecera">
          <Link href="/ops/tareas" className="gx-boton secundario">Tareas y notas</Link>
          <Link href="/ops/automatizacion" className="gx-boton secundario">Automatización</Link>
          <a href={DOCUMENTO} target="_blank" rel="noreferrer" className="gx-boton secundario">
          <ExternalLink size={18} strokeWidth={1.6} aria-hidden="true" /> Plan completo
          </a>
        </div>
      </header>

      <div className="gx-pila">
        <div className="gx-patron">
          <section className="gx-tarjeta realce gx-foco" aria-label="Dónde estamos">
            <span className="gx-chip">Dónde estamos</span>
            <p className="titular">El banco de pruebas funciona de punta a punta</p>
            <p className="detalle">Un equipo simulado, la pasarela, la nube y la pantalla ya trabajan juntos. Lo siguiente es la visita del miércoles: con los equipos reales delante se eligen la pasarela y los primeros modelos.</p>
          </section>
          <div className="gx-cifras sueltas tres">
            <div><span>Fases terminadas</span><strong>{fasesHechas} <small>de {FASES.length}</small></strong></div>
            <div><span>Tareas hechas</span><strong>{hechas} <small>de {TAREAS.length}</small></strong></div>
            <div className={tuyas.length ? "mirar" : undefined}><span>Esperan por ti</span><strong>{tuyas.length}</strong></div>
          </div>
        </div>

        <section className="gx-tarjeta" aria-label="Fases">
          <h2>Fases</h2>
          <p className="gx-sub">El camino completo, en orden</p>
          <ol className="gx-fases">
            {FASES.map((f) => (
              <li key={f.numero} className={f.estado}>
                <span className="numero" aria-hidden="true">{f.numero}</span>
                <span className="texto">
                  <strong>{f.nombre}</strong>
                  <small>{f.resumen}</small>
                </span>
                <span className={`gx-chip ${CHIP_PLAN[f.estado]}`}>{ROTULO_PLAN[f.estado]}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="gx-dos igual">
          <section className="gx-tarjeta">
            <h2>Esperan por ti · {tuyas.length}</h2>
            <p className="gx-sub">Lo que solo puedes hacer tú</p>
            {tuyas.length ? <Tareas lista={tuyas} /> : <p className="gx-vacio">Nada pendiente por tu parte.</p>}
          </section>
          <section className="gx-tarjeta">
            <h2>Lleva Gradiox · {abiertas.length}</h2>
            <p className="gx-sub">Lo que está abierto y de qué depende</p>
            {abiertas.length ? <Tareas lista={abiertas} /> : <p className="gx-vacio">Nada abierto.</p>}
          </section>
        </div>

        <div className="gx-dos igual">
          <section className="gx-tarjeta">
            <h2>Hecho · {cerradas.length}</h2>
            <Tareas lista={cerradas} conQuien />
          </section>
          <section className="gx-tarjeta">
            <h2>Decisiones tomadas</h2>
            <p className="gx-sub">Cómo se conecta Gradiox con cualquier instalación</p>
            <ul className="gx-lista">
              {DECISIONES.map((d) => (
                <li key={d.titulo}>
                  <span>
                    {d.titulo}
                    <small>{d.detalle}</small>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="gx-nota">El detalle (guía de la visita, protocolos, fabricantes y normativa) está en el plan completo. La tabla de fabricantes y la normativa están aún sin contrastar con sus fuentes.</p>
      </div>
    </>
  );
}
