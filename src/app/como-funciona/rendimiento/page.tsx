import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EQUIPOS_MEDIDA, IDS_EQUIPO } from "@/cop/equipos";
import { CALIDAD, ESCALERA, INDICADORES, NIVELES, TRES_NUMEROS, type Calidad } from "@/cop/indicadores";

export const metadata = { title: "Rendimiento (COP) · Gradiox" };

const CHIP_CALIDAD: Record<Calidad, string> = { medido: "correcto", calculado: "", estimado: "aviso" };

export default function Rendimiento() {
  return (
    <>
      <Link href="/como-funciona" className="gx-volver">
        <ArrowLeft size={18} aria-hidden="true" /> Cómo funciona
      </Link>
      <header className="gx-cabecera">
        <div>
          <h1>Rendimiento (COP)</h1>
          <p className="gx-sub">Cuánto frío da tu instalación por cada kWh de luz, cómo lo medimos en cada equipo y de dónde sale cada número.</p>
        </div>
      </header>
      <div className="gx-pila">
        <section className="gx-tarjeta realce gx-resumen" aria-label="En una frase">
          <p>
            El <strong>COP</strong> es el frío que sale dividido por la electricidad que entra. Un COP de 3 quiere decir que por cada kWh de luz salen 3 kWh de frío. Cuanto más alto, menos pagas por el mismo frío.
          </p>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-niveles">
          <h2 id="rd-niveles" className="gx-titulo-seccion">Tres niveles, y manda el de la instalación</h2>
          <p className="gx-sub">El de la instalación entera es el que se mira para decidir y comprobar cada ajuste. Mejorar un compresor a costa de gastar más en ventiladores no es mejorar.</p>
          <Diagrama />
          <dl className="gx-medidas">
            {NIVELES.map((n) => (
              <div key={n.id}>
                <dt>{n.titulo}</dt>
                <dd>
                  {n.formula}. Entra: {n.electricidad.toLowerCase()}. Sirve para: {n.paraQue.toLowerCase()}. Precisión: {n.precision}.
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-tres">
          <h2 id="rd-tres" className="gx-titulo-seccion">Tres números en cada nivel</h2>
          <dl className="gx-medidas">
            {TRES_NUMEROS.map((t) => (
              <div key={t.titulo}>
                <dt>{t.titulo}</dt>
                <dd>{t.texto}</dd>
              </div>
            ))}
          </dl>
          <p className="gx-sub">
            La distancia entre el real y el esperado es lo que se pierde por el <strong>estado del equipo</strong> (suciedad, desgaste, aire en el circuito). La distancia entre el esperado y el alcanzable es lo que se pierde por las <strong>consignas</strong>, y eso es lo que Gradiox puede ajustar.
          </p>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-equipos">
          <h2 id="rd-equipos" className="gx-titulo-seccion">Un indicador por equipo</h2>
          <p className="gx-sub">
            Lo que produce frío tiene COP. Lo que no produce frío (condensador, bombas, ventiladores, desescarches) se mide en vatios por cada kW de frío: así todos se suman y se ve cuánto pesa cada uno en la factura.
          </p>
          <dl className="gx-medidas">
            {INDICADORES.map((i) => (
              <div key={i.equipo}>
                <dt>
                  {i.equipo} <span className="gx-chip">{i.unidad}</span>
                </dt>
                <dd>
                  {i.indicador}. Necesita: {i.senales.toLowerCase()}. Para: {i.paraQue.toLowerCase()}.
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-calidad">
          <h2 id="rd-calidad" className="gx-titulo-seccion">De dónde sale cada número</h2>
          <p className="gx-sub">Cada número de rendimiento lleva una de estas tres etiquetas y su margen. Si falta un dato, no se inventa: la pantalla dice qué falta y qué hace falta para verlo.</p>
          <dl className="gx-medidas">
            {(Object.keys(CALIDAD) as Calidad[]).map((c) => (
              <div key={c}>
                <dt>
                  <span className={`gx-chip ${CHIP_CALIDAD[c]}`}>{CALIDAD[c].titulo}</span>
                </dt>
                <dd>{CALIDAD[c].cuando}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-escalera">
          <h2 id="rd-escalera" className="gx-titulo-seccion">Qué dato desbloquea qué</h2>
          <p className="gx-sub">Gradiox empieza con lo que ya lee el autómata y gana precisión con cada dato que se añade, en este orden.</p>
          <ol className="gx-pila">
            {ESCALERA.map((e) => (
              <li key={e.dato}>
                <strong>{e.dato}</strong>
                <br />
                <span className="gx-sub">{e.desbloquea}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-medida">
          <h2 id="rd-medida" className="gx-titulo-seccion">Equipos de medida: para qué sirve cada uno</h2>
          <p className="gx-sub">Lo normal es que tu instalación ya los tenga. Primero miramos si existen y si el autómata los lee; solo lo que falte habría que ponerlo.</p>
          <dl className="gx-medidas">
            {IDS_EQUIPO.map((k) => (
              <div key={k}>
                <dt>{EQUIPOS_MEDIDA[k].nombre}</dt>
                <dd>{EQUIPOS_MEDIDA[k].paraQue} {EQUIPOS_MEDIDA[k].mejora}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="gx-tarjeta" aria-labelledby="rd-ahorro">
          <h2 id="rd-ahorro" className="gx-titulo-seccion">Cómo se demuestra un ahorro</h2>
          <p>
            Antes de tocar nada se mide cómo gasta la instalación según el frío que da y el tiempo que hace. Cada ajuste se estima antes, se aplica con límites de seguridad y se comprueba alternando días con y sin él. Si el ahorro medido no es claramente mayor que el error de la medida, no se da por bueno. El objetivo es el menor coste con el género seguro, no el COP más alto.
          </p>
          <p className="gx-nota">Todavía no hay ninguna instalación con estas cuentas en marcha: esta página explica cómo se hará.</p>
        </section>
      </div>
    </>
  );
}

// Electricidad que entra por cada equipo y frío que sale: el COP de la instalación las junta todas.
function Diagrama() {
  const partes = ["Compresores", "Condensador", "Bombas", "Ventiladores", "Desescarches"];
  return (
    <svg viewBox="0 0 320 170" role="img" aria-label="La electricidad de todos los equipos entra en la instalación y sale frío para los servicios" style={{ width: "100%", maxWidth: 480, height: "auto" }}>
      {partes.map((p, i) => (
        <g key={p}>
          <rect x="4" y={8 + i * 32} width="104" height="24" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.35" />
          <text x="56" y={24 + i * 32} textAnchor="middle" fontSize="12" fill="currentColor">{p}</text>
          <line x1="108" y1={20 + i * 32} x2="140" y2="85" stroke="currentColor" strokeOpacity="0.35" />
        </g>
      ))}
      <rect x="140" y="60" width="90" height="50" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="185" y="82" textAnchor="middle" fontSize="12" fill="currentColor">Instalación</text>
      <text x="185" y="98" textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity="0.7">COP</text>
      <line x1="230" y1="85" x2="262" y2="85" stroke="currentColor" strokeWidth="1.5" />
      <text x="290" y="82" textAnchor="middle" fontSize="12" fill="currentColor">Frío</text>
      <text x="290" y="98" textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity="0.7">servicios</text>
    </svg>
  );
}
