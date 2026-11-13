"use client";

import Link from "next/link";
import { Activity, ArrowRight, BellRing, Building2, CalendarCheck, Check, ClipboardList, Factory, Gauge, MonitorSmartphone, ShieldCheck, Timer, Truck, Wrench, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Marca } from "@/components/marca";
import "./web.css";

const FRASE = "Una cámara que falla de madrugada cuesta género, horas y clientes. Gradiox lo ve antes, dice qué hacer y deja constancia de todo.".split(" ");

const CAPITULOS = [
  {
    id: "ahorro",
    Icono: Zap,
    rotulo: "Ahorra costes",
    titulo: "Enfría cuando la luz es barata.",
    texto: "Gradiox lee el precio de la luz hora a hora, adelanta frío en las horas baratas y afloja en las caras. Siempre con un margen de seguridad: nunca se acerca al límite del género.",
    puntos: ["Precio por horas de hoy y de mañana, de Red Eléctrica", "Consumo estimado de cada servicio, cada día", "Puertas abiertas y desescarches largos, a la vista"],
    imagen: "luz-light",
    alt: "Pantalla Luz de Gradiox: precio por horas, plan del día y gasto de cada servicio",
  },
  {
    id: "rendimiento",
    Icono: Gauge,
    rotulo: "Mejora el rendimiento",
    titulo: "Cada equipo, rindiendo como debe.",
    texto: "Tiempo de marcha y arranques del compresor, tendencia de la temperatura y distancia al límite, en una sola ficha. Los fallos típicos se reconocen solos y llegan con lo que hay que revisar.",
    puntos: ["Gráficas de una hora a treinta días, con puertas y desescarches", "Comparación de varios servicios en la misma gráfica", "Histórico de fallos para ver cuál se repite"],
    imagen: "ficha-light",
    alt: "Ficha de una cámara en Gradiox: temperatura, compresor, consumo y gráfica de 24 horas",
  },
  {
    id: "tiempos",
    Icono: Timer,
    rotulo: "Optimiza tiempos",
    titulo: "El turno sabe qué toca.",
    texto: "Lo urgente sale primero. El relevo cuenta en una pantalla lo que se encuentra quien entra, la ronda se marca desde el móvil y cada alarma tiene quién la lleva y cómo se cerró.",
    puntos: ["Relevo de turno y ronda diaria", "Órdenes de trabajo con calendario y libro de cada equipo", "Informe del día y del mes, listos para imprimir"],
    imagen: "turno-light",
    alt: "Pantalla Turno de Gradiox: relevo, ronda del día y entradas de mercancía",
  },
];

const VENTAJAS = [
  { Icono: ShieldCheck, titulo: "Protege el género", texto: "Cada aviso dice cuánto tiempo queda hasta el límite y qué hay que hacer ahora." },
  { Icono: ClipboardList, titulo: "Inspecciones sin carreras", texto: "Registro de temperaturas por días, con mínimas, máximas y ratos fuera de límite, para descargar." },
  { Icono: Wrench, titulo: "Mantenimiento que no se olvida", texto: "Revisiones con su fecha, órdenes de trabajo y la ficha de cada compresor y evaporador." },
  { Icono: BellRing, titulo: "Avisa a quien toca", texto: "Notificaciones con guardias, escalado y horario de silencio para lo que no es urgente." },
  { Icono: Truck, titulo: "Recepción de mercancía", texto: "La temperatura a la que llega cada camión, comparada con el límite de la cámara donde entra." },
  { Icono: Activity, titulo: "Toda la cadena, comprobada", texto: "De la sonda al teléfono de guardia: una pantalla dice qué eslabón falla." },
  { Icono: Building2, titulo: "Varias naves", texto: "Todas las instalaciones en una lista, con las que tienen algo abierto arriba." },
  { Icono: MonitorSmartphone, titulo: "En el móvil y en la pared", texto: "La misma información en el bolsillo, en la oficina y en un televisor del muelle." },
];

const PUBLICO = [
  { Icono: Wrench, titulo: "Instaladores y mantenedores", texto: "Ver la instalación antes de salir hacia ella, llegar con el diagnóstico hecho y entregar al cliente un informe cada mes." },
  { Icono: Factory, titulo: "Naves y plataformas de frío", texto: "Saber en cada turno cómo está el género, quién lleva cada aviso y cuánto cuesta enfriar." },
  { Icono: CalendarCheck, titulo: "Calidad y seguridad alimentaria", texto: "Temperaturas, incidencias y recepciones guardadas y ordenadas para el autocontrol." },
];

const limitar = (n: number) => Math.min(1, Math.max(0, n));

export function Web({ contacto }: { contacto?: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [activo, setActivo] = useState(0);
  const [pegada, setPegada] = useState(false);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.classList.add("lista");

    // Lo que aparece al entrar en pantalla.
    const vistos = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add("visto");
            vistos.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    el.querySelectorAll("[data-r]").forEach((n) => vistos.observe(n));

    // El capítulo que pasa por el centro de la pantalla manda en la imagen fija.
    const capitulos = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setActivo(Number((e.target as HTMLElement).dataset.cap));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    el.querySelectorAll("[data-cap]").forEach((n) => capitulos.observe(n));

    const portada = el.querySelector<HTMLElement>(".gw-portada-captura");
    const frase = el.querySelector<HTMLElement>(".gw-frase");
    const palabras = frase ? Array.from(frase.querySelectorAll<HTMLElement>("span")) : [];
    const moviles = el.querySelector<HTMLElement>(".gw-moviles");
    let pendiente = 0;
    const pintar = () => {
      pendiente = 0;
      const alto = window.innerHeight;
      setPegada(window.scrollY > 24);
      if (quieto) return;
      if (portada) {
        const r = portada.getBoundingClientRect();
        portada.style.setProperty("--p", limitar((alto - r.top) / (alto * 0.75)).toFixed(3));
      }
      if (frase) {
        const r = frase.getBoundingClientRect();
        const p = limitar((alto * 0.85 - r.top) / (alto * 0.55 + r.height));
        palabras.forEach((s, i) => {
          s.style.opacity = (0.16 + 0.84 * limitar(p * (palabras.length + 3) - i)).toFixed(2);
        });
      }
      if (moviles) {
        const r = moviles.getBoundingClientRect();
        moviles.style.setProperty("--q", limitar((alto - r.top) / (alto + r.height)).toFixed(3));
      }
    };
    const alMover = () => {
      if (!pendiente) pendiente = window.requestAnimationFrame(pintar);
    };
    pintar();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      vistos.disconnect();
      capitulos.disconnect();
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
      if (pendiente) window.cancelAnimationFrame(pendiente);
    };
  }, []);

  return (
    <div className="gw" ref={raiz}>
      <header className={`gw-nav${pegada ? " pegada" : ""}`}>
        <div className="gw-ancho">
          <Link href="/presentacion" aria-label="Gradiox, inicio"><Marca size={26} oscuro /></Link>
          <nav aria-label="Secciones">
            <a href="#ahorro">Ahorro</a>
            <a href="#rendimiento">Rendimiento</a>
            <a href="#tiempos">Tiempos</a>
            <a href="#funciones">Funciones</a>
          </nav>
          <Link href="/login" className="gw-boton claro">Entrar</Link>
        </div>
      </header>

      <main>
        <section className="gw-portada">
          <span className="gw-halo" aria-hidden="true" />
          <div className="gw-ancho">
            <p className="gw-rotulo sube">Telegestión de frío industrial</p>
            <h1 className="sube">El sistema de optimización de refrigeración que necesitas.</h1>
            <p className="gw-entrada sube">Gradiox vigila cada cámara al momento, lleva el consumo a las horas baratas y avisa antes de que el género corra peligro. Menos gasto, menos averías y menos tiempo perdido.</p>
            <p className="gw-acciones sube">
              <Link href="/login" className="gw-boton">Ver la demostración <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" /></Link>
              <a href="#ahorro" className="gw-boton fantasma">Qué consigue</a>
            </p>
            <div className="gw-portada-captura">
              <div className="gw-marco">
                <span className="gw-marco-barra" aria-hidden="true"><i /><i /><i /></span>
                <img src="/web/servicios-dark.webp" width={2400} height={1500} alt="Pantalla Servicios de Gradiox: ocho servicios de frío con su temperatura en vivo, tendencia y estado" fetchPriority="high" />
              </div>
            </div>
          </div>
        </section>

        <section className="gw-manifiesto">
          <div className="gw-ancho">
            <p className="gw-frase" aria-label={FRASE.join(" ")}>
              {FRASE.map((p, i) => <span key={i} aria-hidden="true">{p} </span>)}
            </p>
          </div>
        </section>

        <section className="gw-relato" aria-label="Qué consigue">
          <div className="gw-ancho">
            <div className="gw-capitulos">
              {CAPITULOS.map(({ id, Icono, rotulo, titulo, texto, puntos, imagen, alt }, i) => (
                <article key={id} id={id} data-cap={i} className={activo === i ? "activo" : undefined}>
                  <p className="gw-rotulo"><Icono size={18} strokeWidth={1.8} aria-hidden="true" /> {rotulo}</p>
                  <h2>{titulo}</h2>
                  <p>{texto}</p>
                  <ul>
                    {puntos.map((x) => <li key={x}><Check size={18} strokeWidth={2} aria-hidden="true" /> {x}</li>)}
                  </ul>
                  <div className="gw-marco gw-en-linea" data-r>
                    <img src={`/web/${imagen}.webp`} width={2000} height={1250} alt={alt} loading="lazy" />
                  </div>
                </article>
              ))}
            </div>
            <div className="gw-fija" aria-hidden="true">
              <div className="gw-marco">
                <span className="gw-marco-barra"><i /><i /><i /></span>
                <div className="gw-pila">
                  {CAPITULOS.map(({ id, imagen }, i) => (
                    <img key={id} src={`/web/${imagen}.webp`} width={2000} height={1250} alt="" loading="lazy" className={activo === i ? "activa" : undefined} />
                  ))}
                </div>
              </div>
              <div className="gw-pasos">
                {CAPITULOS.map(({ id }, i) => <i key={id} className={activo === i ? "activo" : undefined} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="gw-ventajas" id="funciones">
          <div className="gw-ancho">
            <p className="gw-rotulo" data-r>Y además</p>
            <h2 data-r>Todo lo que pasa en el frío, en un solo sitio.</h2>
            <ul>
              {VENTAJAS.map(({ Icono, titulo, texto }, i) => (
                <li key={titulo} data-r style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
                  <Icono size={24} strokeWidth={1.6} aria-hidden="true" />
                  <strong>{titulo}</strong>
                  {texto}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="gw-vitrina">
          <div className="gw-ancho">
            <figure className="grande" data-r>
              <img src="/web/pared-dark.webp" width={1600} height={900} alt="Pantalla de pared de Gradiox: cada servicio en grande, para un televisor" loading="lazy" />
              <figcaption><strong>Pantalla de pared.</strong> El estado de la nave en un televisor, sin menús.</figcaption>
            </figure>
            <figure data-r>
              <img src="/web/sistema-light.webp" width={1600} height={1000} alt="Pantalla Sistema de Gradiox: comprobaciones de toda la cadena" loading="lazy" />
              <figcaption><strong>Sistema.</strong> Qué eslabón falla, de la sonda al aviso.</figcaption>
            </figure>
            <figure data-r>
              <img src="/web/mantenimiento-light.webp" width={1600} height={1000} alt="Pantalla Mantenimiento de Gradiox: órdenes de trabajo y revisiones" loading="lazy" />
              <figcaption><strong>Mantenimiento.</strong> Órdenes, revisiones y el libro de cada equipo.</figcaption>
            </figure>
          </div>
        </section>

        <section className="gw-bolsillo">
          <div className="gw-ancho">
            <div className="gw-bolsillo-texto">
              <p className="gw-rotulo" data-r>En el móvil</p>
              <h2 data-r>La nave entera, en el bolsillo.</h2>
              <p data-r>Pensado para usarse de pie, con una mano y con prisa: lo importante arriba, letra grande y una sola acción principal en cada pantalla. Se instala en el teléfono desde el navegador.</p>
            </div>
            <div className="gw-moviles" aria-hidden="true">
              <span className="gw-movil a"><img src="/web/m-servicios-dark.webp" width={780} height={1688} alt="" loading="lazy" /></span>
              <span className="gw-movil b"><img src="/web/m-hoy-light.webp" width={780} height={1688} alt="" loading="lazy" /></span>
              <span className="gw-movil c"><img src="/web/m-ficha-light.webp" width={780} height={1688} alt="" loading="lazy" /></span>
            </div>
          </div>
        </section>

        <section className="gw-publico">
          <div className="gw-ancho">
            <h2 data-r>Para quien instala, mantiene y usa el frío.</h2>
            <ul>
              {PUBLICO.map(({ Icono, titulo, texto }, i) => (
                <li key={titulo} data-r style={{ transitionDelay: `${i * 90}ms` }}>
                  <Icono size={26} strokeWidth={1.5} aria-hidden="true" />
                  <strong>{titulo}</strong>
                  {texto}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="gw-cierre">
          <span className="gw-halo" aria-hidden="true" />
          <div className="gw-ancho">
            <h2 data-r>Míralo funcionando.</h2>
            <p data-r>Lo que hay hoy en esta dirección es una demostración con datos simulados: no hay ninguna instalación conectada ni se manda ninguna orden a ningún equipo. Sirve para ver, pantalla a pantalla, cómo trabajaría Gradiox en tu instalación.</p>
            <p className="gw-acciones" data-r>
              <Link href="/login" className="gw-boton">Entrar a la demostración <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" /></Link>
              {contacto && <a href={`mailto:${contacto}`} className="gw-boton fantasma">Escribir a {contacto}</a>}
            </p>
            {!contacto && <p className="gw-menor" data-r>El acceso lo da quien te ha pasado esta dirección. Aquí no se pide ningún dato personal ni de pago.</p>}
          </div>
        </section>
      </main>

      <footer className="gw-pie">
        <div className="gw-ancho">
          <Marca size={22} oscuro />
          <span>gradiox.com · Demostración con datos simulados</span>
        </div>
      </footer>
    </div>
  );
}
