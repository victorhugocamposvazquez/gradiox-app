import Link from "next/link";
import { ArrowRight, Bell, Cloud, Eye, FileText, Hand, type LucideIcon, Router, Server, Smartphone, Snowflake, Sparkles, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

export const metadata = { title: "Cómo funciona · Gradiox" };

type Paso = { Icono: LucideIcon; titulo: string; detalle: string; tono?: "marca" | "apagado" };

/** Un diagrama de cajas unidas por flechas. En pantallas estrechas se pone en vertical. */
function Flujo({ pasos, rotulo, cortado }: { pasos: Paso[]; rotulo: string; cortado?: number }) {
  return (
    <ol className="gx-flujo" aria-label={rotulo}>
      {pasos.map(({ Icono, titulo, detalle, tono }, i) => (
        <li key={titulo} className={`${tono ?? ""}${cortado === i ? " cortado" : ""}`}>
          <span className="icono"><Icono size={20} strokeWidth={1.6} aria-hidden="true" /></span>
          <strong>{titulo}</strong>
          <small>{detalle}</small>
        </li>
      ))}
    </ol>
  );
}

function Capitulo({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section className="gx-tarjeta gx-capitulo" id={id} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`}>{titulo}</h2>
      {children}
    </section>
  );
}

const INDICE = [
  ["que-es", "Qué es Gradiox"],
  ["conexion", "Cómo se conecta"],
  ["sin-internet", "Si se cae internet"],
  ["marcas", "Con cualquier marca"],
  ["actuar", "Mirar y actuar"],
  ["palabras", "Palabras que verás"],
] as const;

const PALABRAS: [string, string][] = [
  ["Servicio", "Cada punto de frío que se vigila: una cámara, un obrador, un muelle."],
  ["Controlador", "El aparato con pantalla que ya tiene cada cámara. Decide cuándo arranca el frío."],
  ["Consigna", "La temperatura que se le pide a la cámara. Por ejemplo, 20 bajo cero."],
  ["Desescarche", "El rato en que la cámara se quita el hielo. La temperatura sube un poco y es normal."],
  ["Pasarela", "La cajita de Gradiox. Escucha a los controladores y manda lo que dicen por internet."],
  ["Ficha de equipo", "La chuleta de un modelo de controlador: dónde tiene la temperatura, la puerta y lo demás."],
  ["Modbus", "El idioma en el que hablan casi todos los controladores de frío."],
];

export default function ComoFunciona() {
  return (
    <>
      <header className="gx-cabecera">
        <div>
          <h1>Cómo funciona</h1>
          <p className="gx-sub">Gradiox explicado sin tecnicismos, para cualquier persona</p>
        </div>
        <Link href="/sistema/plan" className="gx-boton secundario">
          Ver el plan <ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" />
        </Link>
      </header>

      <div className="gx-pila">
        <nav className="gx-indice" aria-label="Capítulos">
          {INDICE.map(([id, texto]) => (
            <a key={id} href={`#${id}`}>{texto}</a>
          ))}
        </nav>

        <Capitulo id="que-es" titulo="Qué es Gradiox">
          <p>Gradiox vigila el frío de una empresa las 24 horas. Si algo va mal, avisa antes de que se estropee el género. Y ayuda a que el frío gaste menos luz.</p>
          <Flujo
            rotulo="Qué hace Gradiox"
            pasos={[
              { Icono: Snowflake, titulo: "Tus cámaras", detalle: "Las que ya tienes, sin cambiarlas" },
              { Icono: Eye, titulo: "Gradiox mira", detalle: "Temperatura, puertas y máquinas, todo el rato", tono: "marca" },
              { Icono: Bell, titulo: "Te avisa", detalle: "Al móvil, en cuanto algo se sale de lo normal" },
              { Icono: FileText, titulo: "Lo deja escrito", detalle: "Registros e informes sin apuntar nada a mano" },
            ]}
          />
        </Capitulo>

        <Capitulo id="conexion" titulo="Cómo se conecta">
          <p>Cada cámara ya tiene un aparato que la controla. Gradiox pone a su lado una cajita, la pasarela, que escucha a esos aparatos y manda lo que dicen por internet. No hay que cambiar las cámaras ni tocar la red de la empresa.</p>
          <Flujo
            rotulo="El camino de una lectura"
            pasos={[
              { Icono: Server, titulo: "Controlador", detalle: "El aparato de la cámara. Sabe la temperatura" },
              { Icono: Router, titulo: "Pasarela", detalle: "La cajita de Gradiox. Pregunta cada pocos segundos", tono: "marca" },
              { Icono: Cloud, titulo: "Gradiox", detalle: "Guarda todo y decide si hay que avisar" },
              { Icono: Smartphone, titulo: "Tú", detalle: "Lo ves en el móvil o en el ordenador" },
            ]}
          />
          <p className="gx-nota">La pasarela siempre llama hacia fuera, como cuando tú abres una página web. Nadie de fuera puede entrar por ella a la red de la empresa.</p>
        </Capitulo>

        <Capitulo id="sin-internet" titulo="Si se cae internet">
          <p>No se pierde nada. La pasarela sigue leyendo las cámaras y se lo guarda. Cuando vuelve internet, lo entrega todo en orden y el histórico queda sin huecos.</p>
          <div className="gx-tres-pasos">
            <div>
              <span className="gx-chip correcto">1 · Todo normal</span>
              <Flujo rotulo="Con internet" pasos={[{ Icono: Router, titulo: "Pasarela", detalle: "Lee y entrega", tono: "marca" }, { Icono: Cloud, titulo: "Gradiox", detalle: "Recibe al momento" }]} />
            </div>
            <div>
              <span className="gx-chip aviso">2 · Se cae internet</span>
              <Flujo rotulo="Sin internet" cortado={1} pasos={[{ Icono: Router, titulo: "Pasarela", detalle: "Lee y guarda", tono: "marca" }, { Icono: WifiOff, titulo: "Gradiox", detalle: "No le llega nada y lo avisa", tono: "apagado" }]} />
            </div>
            <div>
              <span className="gx-chip correcto">3 · Vuelve</span>
              <Flujo rotulo="Al volver internet" pasos={[{ Icono: Router, titulo: "Pasarela", detalle: "Entrega lo guardado", tono: "marca" }, { Icono: Cloud, titulo: "Gradiox", detalle: "Rellena el hueco" }]} />
            </div>
          </div>
        </Capitulo>

        <Capitulo id="marcas" titulo="Con cualquier marca">
          <p>Cada fabricante guarda los datos a su manera. Para entenderlos, Gradiox tiene una ficha por modelo de controlador, como una chuleta que dice dónde está cada dato. Se escribe una vez y sirve para todos los clientes que tengan ese modelo.</p>
          <div className="gx-embudo" role="img" aria-label="Controladores de distintas marcas pasan por su ficha y Gradiox entiende lo mismo de todos">
            <ul>
              <li>Controlador de la marca A</li>
              <li>Controlador de la marca B</li>
              <li>Controlador de la marca C</li>
            </ul>
            <span className="flecha" aria-hidden="true" />
            <div className="ficha">
              <strong>Ficha de cada modelo</strong>
              <small>Traduce el idioma de cada marca</small>
            </div>
            <span className="flecha" aria-hidden="true" />
            <ul className="salida">
              <li>Temperatura</li>
              <li>Puerta</li>
              <li>Compresor</li>
              <li>Alarma</li>
            </ul>
          </div>
          <p className="gx-nota">Si llega una marca nueva, se escribe su ficha a partir del manual. El programa no cambia.</p>
        </Capitulo>

        <Capitulo id="actuar" titulo="Mirar y actuar">
          <p>Gradiox empieza solo mirando. Más adelante podrá también actuar, por ejemplo enfriar un poco más en las horas en que la luz cuesta menos. Siempre por pasos y dentro de los límites que ponga el cliente.</p>
          <ol className="gx-escalera">
            <li className="hecho">
              <span className="icono"><Eye size={20} strokeWidth={1.6} aria-hidden="true" /></span>
              <strong>Solo mira</strong>
              <small>Lee, avisa y deja registro. No puede cambiar nada en la instalación.</small>
              <span className="gx-chip azul">Por aquí se empieza</span>
            </li>
            <li>
              <span className="icono"><Hand size={20} strokeWidth={1.6} aria-hidden="true" /></span>
              <strong>Actúa si tú dices que sí</strong>
              <small>Propone un cambio y espera a que una persona lo confirme.</small>
              <span className="gx-chip neutro">Más adelante</span>
            </li>
            <li>
              <span className="icono"><Sparkles size={20} strokeWidth={1.6} aria-hidden="true" /></span>
              <strong>Actúa solo, con límites</strong>
              <small>Hace los cambios por su cuenta, sin salirse nunca de lo que tú le has permitido.</small>
              <span className="gx-chip neutro">Más adelante</span>
            </li>
          </ol>
        </Capitulo>

        <Capitulo id="palabras" titulo="Palabras que verás">
          <dl className="gx-palabras">
            {PALABRAS.map(([palabra, significado]) => (
              <div key={palabra}>
                <dt>{palabra}</dt>
                <dd>{significado}</dd>
              </div>
            ))}
          </dl>
        </Capitulo>

        <p className="gx-nota">
          Hoy la app funciona con datos simulados, para enseñar cómo será. La conexión con equipos reales ya está probada con un controlador simulado; lo que falta para la primera instalación está en <Link href="/sistema/plan" style={{ color: "var(--gx-azul)", fontWeight: 500 }}>el plan</Link>.
        </p>
      </div>
    </>
  );
}
