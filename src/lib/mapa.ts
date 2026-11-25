// El mapa de Gradiox: qué está programado y dónde se ve, qué solo está dibujado,
// qué solo está escrito en el plan y qué espera a datos de fuera. Es la cabecera
// de la Hoja de ruta (/ops/plan). Al terminar algo, se mueve aquí de grupo en el
// mismo cambio, igual que su tarea en plan.ts.

export type Funciona = "real" | "simulado" | "explica" | "prueba";
export const ROTULO_FUNCIONA: Record<Funciona, string> = {
  real: "Con datos de verdad",
  simulado: "Simulado",
  explica: "Solo explica",
  prueba: "En prueba, sin publicar",
};

export type Sitio = { que: string; donde: string; ruta?: string; funciona: Funciona; nota?: string };

/** Programado: se puede abrir hoy en gradiox.com. */
export const PROGRAMADO: { grupo: string; sub: string; sitios: Sitio[] }[] = [
  {
    grupo: "Panel interno (ops)",
    sub: "Lo que usa Gradiox. Menú de la izquierda; en el móvil, la barra de abajo.",
    sitios: [
      { que: "Inicio: lo que pide atención y los clientes", donde: "Inicio", ruta: "/ops", funciona: "real" },
      { que: "Clientes y alta de un cliente en siete pasos", donde: "Clientes", ruta: "/ops/clientes", funciona: "real" },
      { que: "Instalación de un cliente por zonas, como en la maqueta: Cómo trabaja, Ver y actuar, y Preparar", donde: "Cliente › su instalación", funciona: "real", nota: "Preparar va arriba mientras no lee y al final cuando ya lee." },
      { que: "Preparar: cámaras y visita, ficha técnica (con los equipos de medida que ya tiene) y conexión", donde: "Cliente › su instalación › Preparar", funciona: "real" },
      { que: "Leer, Actuar a mano e Historia", donde: "Cliente › su instalación › Ver y actuar", funciona: "real", nota: "Probado con el autómata de pruebas de Antonio y con el simulado. Ninguna planta real conectada todavía." },
      { que: "Rendimiento: qué se verá y qué le falta a esa instalación", donde: "Cliente › su instalación › Rendimiento", funciona: "explica", nota: "Sin números: el cálculo no está programado. La lista de lo que falta sale de su ficha técnica." },
      { que: "Planes: consignas por tarifa en cada cámara y los siguientes", donde: "Cliente › su instalación › Planes", funciona: "simulado", nota: "Solo el de tarifa funciona, contra el autómata simulado y con una tarifa de partida. Los demás dicen qué necesitan." },
      { que: "Arranque sin espera: consumo esperado y avisos desde el primer día", donde: "Herramientas › Arranque (simulado)", ruta: "/ops/arranque", funciona: "simulado" },
      { que: "Los cinco niveles de automatización explicados", donde: "Herramientas › Automatización", ruta: "/ops/automatizacion", funciona: "explica", nota: "Es una explicación para reuniones. No calcula ni ajusta nada." },
      { que: "Tareas y notas para Claude", donde: "Herramientas › Tareas", ruta: "/ops/tareas", funciona: "real" },
      { que: "Esta página: qué hay, qué falta y quién lo hace", donde: "Herramientas › Hoja de ruta", ruta: "/ops/plan", funciona: "explica" },
    ],
  },
  {
    grupo: "App del cliente",
    sub: "Lo que ve quien lleva la instalación. Con una instalación conectada, lo que aún es de ejemplo lleva la marca «Ejemplo» en el menú.",
    sitios: [
      { que: "Hoy, Servicios, Históricos y Mi instalación", donde: "Menú de arriba y «Instalación»", ruta: "/", funciona: "real", nota: "Enseñan lo que lee la pasarela de esa instalación." },
      { que: "Avisos, Turno, Mantenimiento, Recepción, Registro, Informe y Luz", donde: "Resto del menú", ruta: "/avisos", funciona: "simulado", nota: "Pantallas de ejemplo. Las alarmas solo se ven con la app abierta." },
      { que: "Ayuda, también «Rendimiento (COP)»", donde: "Instalación › Cómo funciona", ruta: "/como-funciona/rendimiento", funciona: "explica", nota: "Explica qué será el rendimiento. No hay ningún COP calculado." },
    ],
  },
  {
    grupo: "Programa de la pasarela",
    sub: "Lo que se instala en la planta y lee el autómata.",
    sitios: [
      { que: "Versión 0.4.2, la publicada: se actualiza sola en los ordenadores donde está instalada", donde: "En el ordenador de la planta", funciona: "real" },
      { que: "«Gradiox Gateway» 0.5.0: cuatro pasos, código de 6 cifras, variables con su valor y escribir en la misma fila", donde: "Zip de prueba (prueba7), en los archivos del proyecto", funciona: "prueba", nota: "Espera tu visto bueno para publicarla." },
    ],
  },
];

/** Solo dibujado: está en una maqueta, no en gradiox.com. */
export const SOLO_MAQUETA: { que: string; detalle: string }[] = [
  { que: "Servicios como zona propia de la instalación", detalle: "Cada cámara con quién la gobierna ahora y lo que Gradiox le ha hecho. Hoy las cámaras están en Preparar › Cámaras y visita." },
  { que: "Rendimiento con números y la pantalla de cada compresor", detalle: "Con números de ejemplo. No hay ninguno calculado de verdad." },
  { que: "Actividad de los planes", detalle: "Ahora mismo, hecho hoy, lo siguiente; activar, pausar y «Parar los planes que ajustan»." },
  { que: "Inicio con cuatro preguntas", detalle: "¿Va todo bien? ¿Gastan lo que deberían? ¿Qué está haciendo Gradiox? ¿Qué falta por hacer?" },
  { que: "«Cómo funciona Gradiox» interno", detalle: "Zonas, objetivos, catálogo de planes y lo que se pide a cada instalación." },
  { que: "Mandar las instrucciones de conexión al técnico", detalle: "Por WhatsApp o copiando el texto, desde la conexión de la instalación." },
];

/** Solo escrito: está en el plan o en los documentos, ni dibujado del todo ni programado. */
export const SOLO_PLAN: { que: string; detalle: string }[] = [
  { que: "El COP de la instalación, de cada compresor y de cada servicio", detalle: "Fórmulas y reglas en docs/rendimiento.md. Falta programarlo y, sobre todo, los datos de electricidad." },
  { que: "Avisos de rendimiento", detalle: "Quince avisos pensados (aceite, presiones, desescarches…), sin programar." },
  { que: "Ajustes que ahorran: condensación y aspiración flotantes", detalle: "Con línea base medida antes de activarlos y días de control." },
  { que: "Modo automático y guardia en la pasarela", detalle: "Si se cae internet, el autómata vuelve solo a las consignas del frigorista. Hoy no existe esa vuelta atrás: hay que hacerla antes de ajustar solo." },
  { que: "Analizadores de red leídos directamente por la pasarela", detalle: "Hoy la pasarela solo lee el autómata por OPC UA." },
  { que: "Avisos con la app cerrada", detalle: "Notificaciones al móvil aunque no se tenga Gradiox abierto." },
  { que: "Gradiox para muchas empresas", detalle: "Datos separados por cliente y una clave propia para cada pasarela, antes del primer piloto." },
];

/** Espera a algo de fuera: datos de la planta, de RGV o tu visto bueno. */
export const ESPERA: { que: string; quien: string; desbloquea: string }[] = [
  { que: "Leer la electricidad: analizadores de red en el autómata o directos", quien: "RGV / instalador", desbloquea: "Cualquier COP. El autómata de hoy no tiene ninguna variable de potencia." },
  { que: "Potencia y modelo de cada compresor, hojas de selección, presión relativa o absoluta, temperatura exterior y facturas", quien: "Hugo pide a RGV", desbloquea: "Comparar con lo que dice el fabricante y saber si una presión se lee bien." },
  { que: "Qué hacen las consignas Hora_punta_ac, Hora_llana_ac y Hora_valle_ac", quien: "Hugo pregunta a Antonio", desbloquea: "Usar el Ahorro por tarifa en una planta real." },
  { que: "Factura eléctrica del primer cliente", quien: "Hugo", desbloquea: "Euros de verdad en vez de la tarifa de partida." },
  { que: "Primera planta real leyendo", quien: "RGV y Hugo", desbloquea: "Todo lo anterior con datos de verdad: hoy solo leen el autómata simulado y el de pruebas." },
  { que: "Consulta a Industria o a un OCA: ¿cambiar consignas por software es explotación o modificación?", quien: "Hugo", desbloquea: "El primer ajuste automático." },
  { que: "Publicar la pasarela 0.5.0", quien: "Hugo (visto bueno)", desbloquea: "Que las pasarelas instaladas pasen solas a la nueva." },
];

/** Dónde se ha ido guardando todo. Cuantos más sitios, más fácil perderse. */
export const SITIOS: { nombre: string; tipo: "Ops" | "Maqueta" | "Documento" | "Repositorio"; papel: string; enlace?: string; desde?: "seguir" | "archivo" }[] = [
  { nombre: "Ops (gradiox.com/ops)", tipo: "Ops", papel: "Lo que existe y funciona. Única fuente de verdad sobre qué hay hecho.", desde: "seguir" },
  { nombre: "Hoja de ruta (esta página)", tipo: "Ops", papel: "Qué hay, qué falta, quién lo hace.", enlace: "/ops/plan", desde: "seguir" },
  { nombre: "Maqueta de ops", tipo: "Maqueta", papel: "Cómo quedará ops. La única maqueta viva: se dibuja aquí lo siguiente que se va a programar.", enlace: "https://claude.ai/artifact/FYu4WPDYAXExrcSXRbqgJP", desde: "seguir" },
  { nombre: "Maqueta de la pasarela", tipo: "Maqueta", papel: "Ya está programada en la 0.5.0. Queda como archivo.", enlace: "https://claude.ai/artifact/Hw6rKwDD5kX3S71mSbXR74", desde: "archivo" },
  { nombre: "Maqueta del COP", tipo: "Maqueta", papel: "Su contenido pasó a la maqueta de ops (Rendimiento). Queda como archivo.", enlace: "https://claude.ai/artifact/Vduqx9E6hfuBtsbmYs7Xyd", desde: "archivo" },
  { nombre: "Plan de integración", tipo: "Documento", papel: "El plan del 16 nov. Lo vigente está en esta página.", enlace: "https://claude.ai/artifact/1g7src7fsaTmMKUumyJGMT", desde: "archivo" },
  { nombre: "Plan de optimización por COP", tipo: "Documento", papel: "El porqué y el estudio. Lo que se programa sale de las reglas del repositorio y de Automatización.", enlace: "https://claude.ai/artifact/HSnhTUUwT4jQ1cLFf43GLT", desde: "archivo" },
  { nombre: "Zonas y planes de una instalación", tipo: "Documento", papel: "El diseño de la instalación por zonas. Pasa a ops cuando se programe.", enlace: "https://claude.ai/artifact/RFnxBvAT5ooWeWbcShh6dD", desde: "archivo" },
  { nombre: "Reglas del rendimiento (docs/rendimiento.md)", tipo: "Repositorio", papel: "Fórmulas y umbrales exactos, para programar siempre igual.", enlace: "https://github.com/victorhugocamposvazquez/gradiox-app/blob/main/docs/rendimiento.md", desde: "seguir" },
];
