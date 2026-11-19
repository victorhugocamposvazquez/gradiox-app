import Link from "next/link";
import { ArrowLeft, Building2, Factory, type LucideIcon, ShieldCheck, UserRound } from "lucide-react";
import { VisitasSoporte } from "@/components/visitas-soporte";
import { EN_PREPARACION, SEGURIDAD } from "@/lib/seguridad";

export const metadata = { title: "Seguridad · Gradiox" };

const ICONOS: Record<string, LucideIcon> = { planta: Factory, cuenta: UserRound, gradiox: Building2 };

export default function Seguridad() {
  return (
    <>
      <Link href="/como-funciona" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Cómo funciona
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Seguridad</h1>
          <p className="gx-sub">Cómo protege Gradiox tu instalación y tus datos. Aquí solo está lo que ya funciona; lo que falta va al final, dicho como tal.</p>
        </div>
      </header>

      <div className="gx-pila">
        <section className="gx-tarjeta realce gx-resumen" aria-label="En una frase">
          <span className="gx-chip"><ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" /> En una frase</span>
          <p>Gradiox mira tu instalación sin abrir ninguna puerta en tu red, no puede tocar nada sin tu llave, y tu frío sigue funcionando igual aunque Gradiox o internet se caigan.</p>
        </section>

        {SEGURIDAD.map((b) => {
          const Icono = ICONOS[b.id];
          return (
            <section key={b.id} className="gx-tarjeta" aria-labelledby={`seg-${b.id}`}>
              <h2 id={`seg-${b.id}`} className="gx-titulo-seccion"><Icono size={18} strokeWidth={1.6} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 8 }} />{b.titulo}</h2>
              <p className="gx-sub">{b.resumen}</p>
              <dl className="gx-medidas">
                {b.medidas.map((m) => (
                  <div key={m.titulo}>
                    <dt>{m.titulo}</dt>
                    <dd>{m.texto}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}

        <section className="gx-tarjeta" aria-labelledby="seg-visitas">
          <h2 id="seg-visitas" className="gx-titulo-seccion">Visitas de soporte a tu app</h2>
          <p className="gx-sub">Cada vez que alguien de Gradiox ha entrado a ver tu app, con su motivo.</p>
          <VisitasSoporte />
        </section>

        <section className="gx-tarjeta" aria-labelledby="seg-falta">
          <h2 id="seg-falta" className="gx-titulo-seccion">En preparación</h2>
          <p className="gx-sub">Todavía no está hecho. Lo decimos para que sepas qué hay y qué no.</p>
          <dl className="gx-medidas pendiente">
            {EN_PREPARACION.map((m) => (
              <div key={m.titulo}>
                <dt>{m.titulo}</dt>
                <dd>{m.texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="gx-nota">¿Ves algo raro en tu cuenta o tienes una duda de seguridad? Dínoslo cuanto antes: cambiamos tu contraseña y cerramos tus sesiones al momento.</p>
      </div>
    </>
  );
}
