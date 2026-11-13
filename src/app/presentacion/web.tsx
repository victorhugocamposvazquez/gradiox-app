"use client";

import Link from "next/link";
import { Activity, ArrowRight, BellRing, BookCheck, Radar, Cpu, Building2, CalendarCheck, Check, ClipboardList, Factory, Gauge, MonitorSmartphone, ShieldCheck, Timer, Truck, Wrench, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Marca } from "@/components/marca";
import "./web.css";

const FRASE = "Una avería de madrugada cuesta producto, horas de trabajo y vida útil de los equipos. Gradiox la detecta antes, actúa sobre la instalación y lo deja todo registrado.".split(" ");

const CAPITULOS = [
  {
    id: "ahorro",
    Icono: Zap,
    rotulo: "Ahorra costes",
    titulo: "Produce el frío cuando menos cuesta.",
    texto: "Gradiox sigue el precio de la energía hora a hora y ajusta las consignas de forma automática: concentra la producción de frío en los tramos más favorables y la reduce en los más caros. Siempre con un margen de seguridad sobre los límites de cada servicio.",
    puntos: ["Precio horario de hoy y de mañana, de Red Eléctrica", "Consumo estimado por servicio y por día", "Aperturas de puerta y desescarches prolongados, identificados"],
    imagen: "luz-light",
    alt: "Pantalla Luz de Gradiox: precio por horas, plan del día y gasto de cada servicio",
  },
  {
    id: "rendimiento",
    Icono: Gauge,
    rotulo: "Mejora el rendimiento",
    titulo: "Cada equipo, en su punto de trabajo.",
    texto: "Horas de marcha y arranques del compresor, tendencia de temperatura y margen hasta el límite, en una sola ficha. Las averías típicas se identifican de forma automática y cada una lleva asociada su orden correctiva y las comprobaciones recomendadas.",
    puntos: ["Gráficas de una hora a treinta días, con puertas y desescarches", "Comparación de varios servicios en la misma gráfica", "Histórico de averías para detectar las que se repiten"],
    imagen: "ficha-light",
    alt: "Ficha de una cámara en Gradiox: temperatura, compresor, consumo y gráfica de 24 horas",
  },
  {
    id: "mantenimiento",
    Icono: Wrench,
    rotulo: "Cuida los equipos",
    titulo: "Mantenimiento antes que avería.",
    texto: "Compresores, evaporadores y condensadores con su ficha y su historial de intervenciones. Las revisiones se planifican con fecha y las desviaciones de funcionamiento se detectan antes de que terminen en una parada.",
    puntos: ["Plan de revisiones preventivas, con calendario", "Órdenes de trabajo asignadas y seguidas hasta su cierre", "Libro de cada equipo, con sus intervenciones y sus causas"],
    imagen: "mantenimiento-light",
    alt: "Pantalla Mantenimiento de Gradiox: órdenes de trabajo y revisiones",
  },
  {
    id: "tiempos",
    Icono: Timer,
    rotulo: "Optimiza tiempos",
    titulo: "Cada turno sabe qué tiene que hacer.",
    texto: "Lo prioritario aparece primero. El relevo resume el estado de la instalación para quien entra, la ronda se registra desde el móvil y cada alarma tiene responsable y causa de cierre.",
    puntos: ["Relevo de turno y ronda diaria", "Recepción de mercancía con control de temperatura", "Informe diario y mensual, listos para imprimir"],
    imagen: "turno-light",
    alt: "Pantalla Turno de Gradiox: relevo, ronda del día y entradas de mercancía",
  },
];

const VENTAJAS = [
  { Icono: ShieldCheck, titulo: "Actúa, no solo avisa", texto: "Ajustes de consigna, desescarches y rearmes ejecutados de forma automática o con confirmación, siempre dentro de los límites de cada servicio. Cada aviso indica además el margen de tiempo disponible." },
  { Icono: ClipboardList, titulo: "Trazabilidad para inspecciones", texto: "Registro de temperaturas por días, con mínimas, máximas y tiempo fuera de límite, descargable." },
  { Icono: Wrench, titulo: "Mantenimiento planificado", texto: "Revisiones con su fecha, órdenes de trabajo y la ficha de cada compresor y evaporador." },
  { Icono: BellRing, titulo: "Avisos a la persona adecuada", texto: "Notificaciones con guardias, escalado y horario de silencio para lo que no es urgente." },
  { Icono: Truck, titulo: "Recepción de mercancía", texto: "La temperatura de llegada de cada entrega, contrastada con el límite de la cámara de destino." },
  { Icono: Activity, titulo: "Toda la cadena, comprobada", texto: "De la sonda al teléfono de guardia: una pantalla indica qué eslabón falla." },
  { Icono: Building2, titulo: "Varias naves", texto: "Todas las instalaciones en una lista, con prioridad para las que tienen incidencias abiertas." },
  { Icono: MonitorSmartphone, titulo: "En el móvil y en la pared", texto: "La misma información en el bolsillo, en la oficina y en un televisor del muelle." },
];

const PUBLICO = [
  { Icono: Wrench, titulo: "Instaladores y mantenedores", texto: "Conocer el estado de la instalación antes de desplazarse, llegar con el diagnóstico avanzado y entregar al cliente un informe mensual." },
  { Icono: Factory, titulo: "Naves y plataformas de frío", texto: "Saber en cada turno el estado del producto y de los equipos, quién lleva cada aviso y cuánto cuesta producir el frío." },
  { Icono: CalendarCheck, titulo: "Calidad y seguridad alimentaria", texto: "Temperaturas, incidencias y recepciones guardadas y ordenadas para el autocontrol." },
];

const TIPOS = ["Cámaras de congelado", "Cámaras de fresco", "Túneles de congelación", "Antecámaras", "Muelles de carga", "Muebles frigoríficos", "Centrales frigoríficas", "Obradores"];

const PASOS = [
  { Icono: Radar, titulo: "Detecta", texto: "Registra la desviación de temperatura o de funcionamiento del equipo y calcula el margen de tiempo hasta el límite." },
  { Icono: BellRing, titulo: "Avisa", texto: "Envía la alarma a la persona de guardia. Si no se atiende, escala al siguiente responsable." },
  { Icono: Cpu, titulo: "Actúa", texto: "Ejecuta la orden correctiva sobre el autómata: rearme del compresor, desescarche adicional o refuerzo de consigna. De forma automática o con confirmación, según se configure, e indicando qué comprobar después." },
  { Icono: BookCheck, titulo: "Deja constancia", texto: "La alarma se cierra con su causa, la intervención queda en el libro del equipo y todo se recoge en el informe." },
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
    const avance = el.querySelector<HTMLElement>(".gw-avance");
    const linea = el.querySelector<HTMLElement>(".gw-pasos-lista");
    const pasos = linea ? Array.from(linea.querySelectorAll<HTMLElement>("li")) : [];
    let pendiente = 0;
    const pintar = () => {
      pendiente = 0;
      const alto = window.innerHeight;
      setPegada(window.scrollY > 24);
      if (avance) avance.style.transform = `scaleX(${limitar(window.scrollY / Math.max(1, document.documentElement.scrollHeight - alto)).toFixed(4)})`;
      if (linea) {
        const r = linea.getBoundingClientRect();
        const t = quieto ? 1 : limitar((alto * 0.62 - r.top) / r.height);
        linea.style.setProperty("--t", t.toFixed(3));
        pasos.forEach((li) => li.classList.toggle("hecho", quieto || (li.offsetTop + 28) / r.height <= t));
      }
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
    // El brillo de las tarjetas sigue al puntero.
    const foco = (ev: PointerEvent) => {
      const li = (ev.target as HTMLElement).closest<HTMLElement>(".gw-ventajas li");
      if (!li) return;
      const r = li.getBoundingClientRect();
      li.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      li.style.setProperty("--my", `${ev.clientY - r.top}px`);
    };
    el.addEventListener("pointermove", foco);
    pintar();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      vistos.disconnect();
      capitulos.disconnect();
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
      el.removeEventListener("pointermove", foco);
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
            <a href="#mantenimiento">Mantenimiento</a>
            <a href="#tiempos">Tiempos</a>
            <a href="#funciones">Funciones</a>
          </nav>
          <Link href="/login" className="gw-boton claro">Entrar</Link>
        </div>
        <i className="gw-avance" aria-hidden="true" />
      </header>

      <main>
        <section className="gw-portada">
          <span className="gw-halo" aria-hidden="true" />
          <span className="gw-malla" aria-hidden="true" />
          <div className="gw-ancho">
            <p className="gw-rotulo gw-pastilla sube"><i aria-hidden="true" /> Automatización de frío industrial</p>
            <h1 className="sube">El sistema de <em>optimización de refrigeración</em> que necesitas.</h1>
            <p className="gw-entrada sube">Gradiox controla el frío, optimiza el consumo energético y se anticipa a los problemas. Menos averías, menos pérdidas y más ahorro, sin que tengas que estar pendiente.</p>
            <p className="gw-acciones sube">
              <Link href="/login" className="gw-boton">Ver la demostración <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" /></Link>
              <a href="#ahorro" className="gw-boton fantasma">Qué consigue</a>
            </p>
            <div className="gw-portada-captura">
              <div className="gw-marco">
                <span className="gw-marco-barra" aria-hidden="true"><i /><i /><i /></span>
                <img src="/web/servicios-dark.webp" width={2400} height={1500} alt="Pantalla Servicios de Gradiox: ocho servicios de frío con su temperatura en vivo, tendencia y estado" fetchPriority="high" />
              </div>
              <div className="gw-flota a" aria-hidden="true">
                <span className="gw-flota-rotulo"><i className="ok" /> Cámara 2 · en consigna</span>
                <strong>−25,1<i className="grado" /></strong>
                <svg viewBox="0 0 200 44" preserveAspectRatio="none"><path d="M0,30 C14,22 22,34 36,28 S58,14 72,24 S96,36 110,26 S134,12 148,22 S176,34 200,20" /></svg>
              </div>
              <div className="gw-flota b" aria-hidden="true">
                <span className="gw-flota-rotulo"><Zap size={15} strokeWidth={2} /> Tramo de menor coste</span>
                <span className="gw-flota-texto">Producción de frío adelantada</span>
                <span className="gw-flota-barras">{[5, 3, 4, 7, 9, 6, 3, 2, 3, 8, 10, 7].map((h, i) => <i key={i} style={{ height: `${h * 10}%` }} className={h <= 3 ? "barata" : undefined} />)}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="gw-cinta" aria-hidden="true">
          <div>
            {[...TIPOS, ...TIPOS].map((t, i) => <span key={i}>{t}</span>)}
          </div>
        </div>

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

        <section className="gw-averia">
          <div className="gw-ancho">
            <div className="gw-averia-texto">
              <p className="gw-rotulo" data-r>Cuando algo falla</p>
              <h2 data-r>Del aviso a la reparación, sin tiempos muertos.</h2>
              <p data-r>El tiempo que se pierde en detectar una avería, reaccionar y documentarla se puede reducir: Gradiox puede ejecutar la primera actuación de forma automática. Menos tiempo de parada es menos riesgo para el producto y menos desgaste para los equipos.</p>
            </div>
            <ol className="gw-pasos-lista">
              {PASOS.map(({ Icono, titulo, texto }, i) => (
                <li key={titulo}>
                  <span className="gw-paso-icono"><Icono size={22} strokeWidth={1.6} aria-hidden="true" /></span>
                  <span className="gw-paso-num">{String(i + 1).padStart(2, "0")}</span>
                  <strong>{titulo}</strong>
                  <p>{texto}</p>
                </li>
              ))}
            </ol>
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
              <img src="/web/pared-dark.webp" width={2000} height={1125} alt="Pantalla de pared de Gradiox: cada servicio en grande, para un televisor" loading="lazy" />
              <figcaption><strong>Pantalla de pared.</strong> El estado de la nave en un televisor, sin menús.</figcaption>
            </figure>
            <figure data-r>
              <img src="/web/sistema-light.webp" width={1600} height={1000} alt="Pantalla Sistema de Gradiox: comprobaciones de toda la cadena" loading="lazy" />
              <figcaption><strong>Sistema.</strong> Qué eslabón falla, de la sonda al aviso.</figcaption>
            </figure>
            <figure data-r>
              <img src="/web/comparar-light.webp" width={1600} height={1000} alt="Pantalla Comparar de Gradiox: varios servicios en la misma gráfica" loading="lazy" />
              <figcaption><strong>Comparar.</strong> Varios servicios en la misma gráfica.</figcaption>
            </figure>
          </div>
        </section>

        <section className="gw-bolsillo">
          <div className="gw-ancho">
            <div className="gw-bolsillo-texto">
              <p className="gw-rotulo" data-r>En el móvil</p>
              <h2 data-r>La nave entera, en el bolsillo.</h2>
              <p data-r>Diseñado para usarse de pie, con una mano y con poco tiempo: lo importante arriba, letra grande y una sola acción principal en cada pantalla. Se instala en el teléfono desde el navegador.</p>
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
            <p data-r>Lo que hay hoy en esta dirección es una demostración con datos simulados: no hay ninguna instalación conectada y las órdenes a los equipos están simuladas. Sirve para ver, pantalla a pantalla, cómo trabajaría Gradiox en tu instalación.</p>
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
