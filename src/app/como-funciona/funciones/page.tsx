import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FUNCIONES } from "@/lib/seguridad";

export const metadata = { title: "Qué hace Gradiox · Gradiox" };

export default function Funciones() {
  const reales = FUNCIONES.filter((f) => f.estado === "real");
  const ejemplo = FUNCIONES.filter((f) => f.estado === "ejemplo");
  const lista = (fs: typeof FUNCIONES) => (
    <dl className="gx-medidas">
      {fs.map((f) => (
        <div key={f.titulo}>
          <dt>{f.donde ? <Link href={f.donde}>{f.titulo}</Link> : f.titulo}</dt>
          <dd>{f.texto}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <>
      <Link href="/como-funciona" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Cómo funciona
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Qué hace Gradiox</h1>
          <p className="gx-sub">Cada función de la app, y si ya trabaja con tu instalación o todavía se enseña con datos de ejemplo.</p>
        </div>
      </header>
      <div className="gx-pila">
        <section className="gx-tarjeta" aria-labelledby="fun-real">
          <h2 id="fun-real" className="gx-titulo-seccion">Ya funciona con tu instalación <span className="gx-chip correcto">{reales.length}</span></h2>
          <p className="gx-sub">Lo que ves en estas pantallas sale de lo que lee tu pasarela.</p>
          {lista(reales)}
        </section>
        <section className="gx-tarjeta" aria-labelledby="fun-ejemplo">
          <h2 id="fun-ejemplo" className="gx-titulo-seccion">Todavía con datos de ejemplo <span className="gx-chip aviso">{ejemplo.length}</span></h2>
          <p className="gx-sub">Están hechas y se pueden probar, pero aún no usan tu instalación. Cada una lo avisa arriba cuando la abres.</p>
          {lista(ejemplo)}
        </section>
      </div>
    </>
  );
}
