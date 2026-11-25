// Los cinco tipos (niveles) de automatización de Gradiox: qué hace cada uno, qué hace
// falta, qué consigue, cuánto cuesta, cuánto tarda, quién hace qué, riesgos y garantías,
// y en qué punto está hoy. Es la fuente de la página /ops/automatizacion, pensada para
// explicarlo en una reunión. Las reglas finas están en docs/rendimiento.md (sección 9):
// si cambias algo aquí, cambia también ese documento en el mismo PR.

export type EstadoHoy = "hecho" | "simulado" | "pendiente";

export interface Equipo {
  que: string;
  /** Coste orientativo, sin presupuesto pedido. */
  coste: string;
  quien: string;
  obligatorio: boolean;
}

export interface RiesgoGarantia {
  riesgo: string;
  garantia: string;
}

export interface NivelAuto {
  numero: 0 | 1 | 2 | 3 | 4;
  nombre: string;
  frase: string;
  /** Lo que hace Gradiox en este nivel. */
  hace: string[];
  /** Lo que nunca hace todavía en este nivel. */
  noHace: string;
  /** Lo que ve y obtiene el cliente. */
  consigue: string[];
  ahorro: string;
  /** De dónde salen los números: medido, calculado o estimado. */
  calidad: string;
  datos: string[];
  equipos: Equipo[];
  automata: string[];
  software: string[];
  papeles: string[];
  quien: { gradiox: string[]; instalador: string[]; cliente: string[]; hugo: string[] };
  /** Condiciones medibles para llegar a este nivel. */
  puerta: string[];
  /** Cuándo se baja de este nivel sin esperar a nadie. */
  bajada: string;
  plazo: string;
  coste: string;
  riesgos: RiesgoGarantia[];
  hoy: { texto: string; estado: EstadoHoy }[];
}

export const PRINCIPIOS = [
  {
    titulo: "Solo consignas",
    texto: "Gradiox cambia consignas de regulación (temperaturas y presiones objetivo). Nunca toca seguridades, alarmas, válvulas ni arranca o para compresores.",
  },
  {
    titulo: "Si algo falla, vuelve lo de siempre",
    texto: "El autómata vuelve solo a las consignas del frigorista si se pierde la conexión, la pasarela o el PC. Y si un técnico toca algo a mano, manda él.",
  },
  {
    titulo: "Sube por pasos, con pruebas",
    texto: "Cada ajuste sube de nivel solo cuando pasa una prueba medida y una persona lo aprueba. Si pasa algo raro, baja solo. Nunca sube solo.",
  },
] as const;

export const NIVELES_AUTO: NivelAuto[] = [
  {
    numero: 0,
    nombre: "Mirar",
    frase: "Gradiox lee la instalación, calcula y guarda. Todavía no enseña propuestas.",
    hace: [
      "Lee por OPC UA las variables del autómata cada pocos segundos y las guarda.",
      "Comprueba si las presiones son relativas o absolutas antes de calcular nada.",
      "Empieza a construir la historia de cada compresor (su «base propia») para compararlo luego consigo mismo.",
      "Históricos de todo lo leído, para consultarlos desde el primer día.",
    ],
    noHace: "No avisa de ahorros ni escribe nada en el autómata.",
    consigue: [
      "Ver la instalación en directo desde el panel y la app: temperaturas, presiones, compresores en marcha.",
      "Históricos para mirar qué pasó cualquier día.",
    ],
    ahorro: "Ninguno directo: es la fase de conocer la instalación.",
    calidad: "Lo leído es medido (con la precisión de cada sonda). Lo demás aún no se enseña.",
    datos: [
      "Variables que ya tiene el autómata: presiones de aspiración y descarga, temperaturas, marcha y carga de cada compresor, temperaturas de cada cámara.",
      "Ficha de la instalación: refrigerante, presión relativa o absoluta, altitud, modelos de compresor.",
    ],
    equipos: [
      { que: "Pasarela Gradiox en un PC de la planta con acceso al autómata", coste: "0 € si se usa el PC que ya hay; un PC industrial dedicado es recomendable", quien: "Gradiox instala, el instalador da acceso", obligatorio: true },
      { que: "Servidor OPC UA del autómata activado (S7-1500 ya lo trae)", coste: "0 €; horas del instalador para activarlo", quien: "Instalador", obligatorio: true },
    ],
    automata: ["Activar el servidor OPC UA y dar un usuario de solo lectura."],
    software: ["Pasarela y lectura: hechas. Comprobación relativa/absoluta y base propia: por programar."],
    papeles: ["Permiso del cliente para leer sus datos.", "Política de guardado de datos aceptada."],
    quien: {
      gradiox: ["Instalar la pasarela", "Elegir la lista de variables", "Calcular y guardar"],
      instalador: ["Activar OPC UA", "Rellenar la ficha técnica", "Dar acceso de red al PC"],
      cliente: ["Aceptar la lectura", "Dar el PC o el sitio para la pasarela"],
      hugo: ["Dar de alta al cliente y la instalación en ops"],
    },
    puerta: ["La pasarela lee y entrega a la nube sin cortes.", "La ficha técnica está completa."],
    bajada: "—",
    plazo: "Semanas 0 a 2 desde la visita de conexión.",
    coste: "Prácticamente 0 € en equipos si ya hay PC y autómata con OPC UA.",
    riesgos: [
      { riesgo: "Leer mal una variable (otra unidad, relativa en vez de absoluta)", garantia: "Comprobación de saturación (±1 K) antes de enseñar ningún COP; ficha firmada por el instalador." },
      { riesgo: "Que la lectura moleste al autómata", garantia: "Solo lectura, a ritmo moderado; probado contra un S7-1500 de pruebas el 23 nov 2026." },
    ],
    hoy: [
      { texto: "Lectura por OPC UA de punta a punta contra un autómata de pruebas real", estado: "hecho" },
      { texto: "Históricos de lo leído en el panel", estado: "hecho" },
      { texto: "Comprobación relativa/absoluta y base propia de cada compresor", estado: "pendiente" },
    ],
  },
  {
    numero: 1,
    nombre: "Avisar",
    frase: "Gradiox avisa de averías y de dinero perdido, con la prueba y qué revisar. No toca nada.",
    hace: [
      "Avisos de avería: compresor que gasta más que antes, descarga caliente, filtro de aceite cargado, condensador que rinde menos, aire en el circuito, arranques seguidos, sonda dudosa (A1–A15).",
      "Aviso cuando alguien cambia una consigna a mano, con lo que cuesta.",
      "Estimación de lo que se pierde por consignas (por ejemplo, condensar más alto de lo que permite el tiempo), en euros.",
      "Indicador de cada equipo y COP de la instalación cuando hay datos para ello.",
    ],
    noHace: "No propone cambios para aplicar ni escribe en el autómata.",
    consigue: [
      "Enterarse de una avería antes de que pare la instalación (mantenimiento predictivo).",
      "Saber cuánto dinero se va por consignas mal puestas, aunque sea estimado.",
      "Cada aviso dice qué pasa, la prueba (los datos) y qué revisar por orden.",
    ],
    ahorro: "El de las averías que se arreglan antes y las consignas que el técnico corrige al ver el aviso. Es estimado: sin analizadores no se puede medir.",
    calidad: "Avisos con datos medidos. Pérdidas y COP estimados (banda ±15–35 %) hasta que haya analizadores y curva del fabricante.",
    datos: [
      "Todo lo del nivel 0.",
      "30 días de historia por compresor y régimen (para los avisos que comparan con su pasado).",
      "Variables que el autómata ya tiene y no se leen todavía: aceite, purgador, niveles, temperatura y humedad exterior, velocidad del condensador.",
      "Facturas y tarifa del cliente, para hablar en euros.",
    ],
    equipos: [
      { que: "Ninguno nuevo", coste: "0 €", quien: "—", obligatorio: false },
      { que: "Sonda de temperatura en la línea de líquido (confirma aire en el circuito)", coste: "50–150 € por punto (orientativo)", quien: "Instalador", obligatorio: false },
    ],
    automata: ["Nada que programar. Solo añadir variables a la lista de lectura."],
    software: ["Avisos A1–A15, indicadores por equipo y estimación de pérdidas: por programar (diseño cerrado en docs/rendimiento.md)."],
    papeles: ["Acordar con el cliente y el instalador quién recibe cada aviso y cuándo."],
    quien: {
      gradiox: ["Programar y afinar los avisos", "Revisar los primeros avisos a mano antes de mandarlos"],
      instalador: ["Atender los avisos técnicos", "Decir si un aviso fue útil o falso"],
      cliente: ["Facturas y tarifa", "Decidir quién recibe los avisos"],
      hugo: ["Pedir los datos al instalador y al cliente"],
    },
    puerta: [
      "Presión relativa/absoluta comprobada (±1 K).",
      "30 días de referencia, con al menos 30 muestras por régimen.",
    ],
    bajada: "Una sonda dudosa deja sin aviso lo que dependa de ella hasta que se revise.",
    plazo: "Avisos de física desde el primer día; los que comparan con la historia, a partir del día 30.",
    coste: "0 € en equipos. Opcional: sondas de líquido.",
    riesgos: [
      { riesgo: "Demasiados avisos y que se ignoren", garantia: "Cada aviso tiene persistencia mínima (minutos o días) y se revisan los primeros a mano (criterio de gestión de alarmas ISA-18.2)." },
      { riesgo: "Confundir un aviso de Gradiox con una alarma de seguridad", garantia: "Los avisos no sustituyen las alarmas del autómata ni del cuadro, y se dice en pantalla y en el contrato." },
    ],
    hoy: [
      { texto: "Avisos y consumo esperado desde el primer día (prueba de arranque)", estado: "simulado" },
      { texto: "Avisos de compresor A1–A15 con base propia", estado: "pendiente" },
      { texto: "Ayuda «Rendimiento» con el indicador de cada equipo", estado: "hecho" },
    ],
  },
  {
    numero: 2,
    nombre: "Proponer",
    frase: "Gradiox propone un cambio de consigna con su ahorro estimado. Una persona lo aplica con un toque.",
    hace: [
      "Propone ajustes concretos: condensación flotante, aspiración flotante, frío a horas baratas, devolver consignas movidas, y el resto de la lista J1–J11 según su tope.",
      "Cada propuesta dice el cambio, el porqué, los límites y cómo se medirá.",
      "Al aplicarla, escribe por las órdenes de doble llave y vigila: si una cámara se sale de su temperatura, la deshace sola y avisa.",
      "Mide el ahorro con días de control sorteados (con y sin el ajuste).",
    ],
    noHace: "Nada se aplica sin el toque de una persona identificada.",
    consigue: [
      "Ahorro real en la factura, aplicado con un toque y deshecho con otro.",
      "Informe mensual con ahorro medido y su margen, o «ahorro no demostrado» si no llega.",
      "Registro de cada cambio: quién, cuándo, antes, después y por qué.",
    ],
    ahorro: "Por física (CoolProp, amoniaco): cada grado menos de condensación ahorra un 2,6–3,7 % del consumo de compresores a −10 °C de aspiración (1,8–2,3 % a −32/−40 °C); cada grado más de aspiración, un 3,0–4,1 % (2,3–2,8 %). Lo que se consigue en cada planta se mide; no se promete un porcentaje.",
    calidad: "Ahorro medido (kWh de analizadores, días de control). El reparto por ajuste, estimado.",
    datos: [
      "Todo lo del nivel 1.",
      "Electricidad del frío medida cada 15 minutos o menos.",
      "Temperatura y humedad exterior en la planta.",
      "Línea base: cómo gasta la instalación según tiempo y carga, antes de tocar nada (3 meses mínimo, 12 ideal).",
      "Curva cuartohoraria de la distribuidora (Datadis) como contraste independiente.",
    ],
    equipos: [
      { que: "Analizador de red general del frío (clase 0,5S o MID B)", coste: "150–400 € cada uno, o 0 € integrando los que ya tiene el instalador (orientativo)", quien: "Instalador", obligatorio: true },
      { que: "Analizadores por compresor, condensador y bombas (para repartir por equipo)", coste: "150–400 € cada uno, o integrar los existentes (orientativo)", quien: "Instalador", obligatorio: false },
      { que: "Sonda exterior de temperatura y humedad, si no la hay", coste: "Sin presupuesto pedido", quien: "Instalador", obligatorio: true },
    ],
    automata: [
      "Bloque «consigna remota» (una página de especificación, la escribe Gradiox): consigna del frigorista aparte, consigna remota (lo único que Gradiox puede escribir), selector Local/Remoto en el cuadro, latido (si no llega en 60–120 s vuelve la consigna del frigorista), límites y rampa que solo se cambian en planta.",
      "Interfaz OPC UA «Gradiox» con usuario propio y cifrado, solo con las consignas remotas.",
      "Prueba de corte del latido en planta, con el frigorista delante.",
    ],
    software: [
      "Órdenes de doble llave con lista cerrada y caducidad de 2 min: hechas (probadas en simulado y en autómata de pruebas).",
      "Guardia local de la pasarela (latido, rampa, vuelta sin nube): por programar.",
      "Propuestas, verificación con días de control e informe mensual: por programar.",
    ],
    papeles: [
      "Envolvente firmada por la frigorista mantenedora y el titular: mínimos, máximos y rampa de cada consigna, anotada en el libro de la instalación (RSIF art. 15.2.e).",
      "Contrato: Gradiox no es función de seguridad; protocolo de verificación del ahorro como anexo.",
    ],
    quien: {
      gradiox: ["Especificar el bloque del autómata", "Programar propuestas, guardia de la pasarela y verificación", "Informe mensual"],
      instalador: ["Programar el bloque en el autómata", "Montar o integrar analizadores", "Firmar la envolvente", "Estar en la prueba de corte"],
      cliente: ["Firmar la envolvente y el contrato", "Aplicar o rechazar propuestas (o delegarlo)"],
      hugo: ["Visto bueno para escribir en la planta", "Contrato con cliente e instalador"],
    },
    puerta: [
      "Analizadores de red funcionando (≥ 98 % de datos válidos y cuadrando con la distribuidora ±2 %).",
      "Línea base: con los históricos del instalador si sirven (kWh y tiempo de al menos 3 meses). Si no hay, no se espera: la prueba con días de control vale sin ella y la línea base se completa en paralelo.",
      "Envolvente firmada por frigorista y titular.",
      "Bloque del autómata probado en planta, con prueba de corte del latido presenciada.",
    ],
    bajada: "Se queda en «Avisar» si un analizador deja de dar datos, si cambia el programa del autómata o la lista de variables, o con una versión nueva de la pasarela sin repetir la prueba de corte.",
    plazo: "Camino rápido: el instalador programa el bloque del autómata mientras se conecta (semanas 1 a 4); prueba de corte en la semana 4 y ese día empieza el primer grupo de ajustes.",
    coste: "Analizadores (o 0 € si ya existen), horas del instalador para el bloque del autómata y la prueba, sonda exterior si falta.",
    riesgos: [
      { riesgo: "Un ajuste calienta una cámara", garantia: "Techo por cámara con margen a su alarma; se deshace solo (al momento si pasa 2 K del techo, a los 15 min si sigue por encima)." },
      { riesgo: "Se cae internet con una consigna cambiada", garantia: "Latido en el autómata: vuelve solo a la consigna del frigorista en 60–120 s. La pasarela, a los 5 min sin nube." },
      { riesgo: "Ahorro que no existe (los ventiladores gastan lo que ahorran los compresores)", garantia: "Se decide con el COP de toda la instalación y se mide con días de control; si el ahorro no supera el doble de su margen, no cuenta." },
      { riesgo: "Que cambiar consignas por software se considere modificación de la instalación", garantia: "Envolvente firmada por la frigorista mantenedora y anotada en el libro; consulta escrita a Industria o a un OCA." },
    ],
    hoy: [
      { texto: "Órdenes de doble llave al autómata", estado: "simulado" },
      { texto: "Actuación por tarifa (consignas por horario) con vuelta atrás", estado: "simulado" },
      { texto: "Bloque «consigna remota» en el autómata", estado: "pendiente" },
      { texto: "Guardia local de la pasarela", estado: "pendiente" },
      { texto: "Verificación con días de control e informe mensual", estado: "pendiente" },
    ],
  },
  {
    numero: 3,
    nombre: "Aplicar con aviso",
    frase: "Gradiox aplica solo los ajustes que ya se han probado, dentro de la envolvente, y avisa de cada cambio.",
    hace: [
      "Aplica sin esperar a nadie los ajustes que llegaron a este nivel, dentro de los límites firmados.",
      "Avisa de cada cambio en el momento, con botón para deshacerlo.",
      "Sigue midiendo con días de control y baja de nivel solo si algo va mal.",
    ],
    noHace: "No estrena ajustes nuevos ni amplía límites; de noche y en festivos solo trabaja con lo ya validado.",
    consigue: [
      "El ahorro de cada hora, no solo de cuando alguien mira el panel (por ejemplo, condensación siguiendo al tiempo de noche).",
      "Menos trabajo para el técnico: aprueba una vez, Gradiox lo mantiene.",
    ],
    ahorro: "El mismo tipo de ajustes que en el nivel 2, aplicados todo el tiempo. Lo que se gana de más frente al nivel 2 se mide con los días de control; no se promete un porcentaje.",
    calidad: "Ahorro total medido; el de cada ajuste, estimado.",
    datos: ["Todo lo del nivel 2.", "Previsión meteorológica (AEMET, gratuita) para adelantarse al tiempo."],
    equipos: [
      { que: "Caudalímetro de glicol con dos sondas (frío medido: COP de la instalación medido, no estimado)", coste: "1.500–5.000 € más montaje (orientativo)", quien: "Instalador", obligatorio: false },
      { que: "Señal de puertas o muelle (para apartar una cámara cuando entra mercancía)", coste: "30–150 € por punto (orientativo)", quien: "Instalador", obligatorio: false },
    ],
    automata: ["Nada nuevo: el mismo bloque del nivel 2."],
    software: ["Niveles y puertas por ajuste e instalación, registro encadenado (cada fila con la huella de la anterior), parada en ops, app y página local: por programar."],
    papeles: [
      "Respuesta de Industria o del OCA a la consulta sobre el RSIF antes del primer ajuste en este nivel.",
      "Seguro de responsabilidad civil y ciberseguridad.",
    ],
    quien: {
      gradiox: ["Vigilar cada ajuste", "Revisar las reversiones", "Mantener los niveles al día"],
      instalador: ["Recibir los avisos técnicos y el resumen semanal", "Usar el selector Local/Remoto cuando trabaje en la instalación"],
      cliente: ["Recibir el aviso de cada cambio y poder pararlo"],
      hugo: ["Aprobar la subida de cada ajuste a este nivel", "Hacer la consulta a Industria"],
    },
    puerta: [
      "Al menos 20 propuestas de ese grupo de ajustes aceptadas en al menos 4 semanas.",
      "Ninguna reversión por temperatura del género y ninguna alarma atribuible.",
      "La estimación acierta: error mediano frente a lo medido ≤ ±30 %.",
      "Visto bueno expreso de Hugo y consulta RSIF respondida.",
    ],
    bajada: "Baja a «Proponer» al momento con una reversión por temperatura, un aviso de compresor (A2, A3, A4, A6, A15) con el ajuste activo, un enclavamiento que salta, 2 reversiones en 7 días o el autómata pasado a local por falta de latido.",
    plazo: "Grupo «Presiones» hacia la semana 10 (hasta la 17 si su ahorro es pequeño y cuesta más medirlo); grupo «Horario y potencia» hacia la semana 16.",
    coste: "Sin equipos obligatorios nuevos. Seguro y, si se quiere COP medido, caudalímetro de glicol.",
    riesgos: [
      { riesgo: "Un error de Gradiox aplicado sin que nadie mire", garantia: "Límites guardados en la pasarela que la nube no puede ampliar, rampa en el autómata, órdenes que caducan a 2 min, selector del frigorista." },
      { riesgo: "Credenciales de la nube robadas", garantia: "La envolvente solo se amplía en planta; token revocable; usuario OPC UA propio sin acceso a nada más (IEC 62443)." },
      { riesgo: "Un técnico trabaja en la instalación mientras Gradiox ajusta", garantia: "Si toca una consigna o el selector, ese ajuste se aparta 24 h (72 h si se repite)." },
    ],
    hoy: [{ texto: "Todo lo de este nivel", estado: "pendiente" }],
  },
  {
    numero: 4,
    nombre: "Automático",
    frase: "Gradiox lleva los ajustes probados por su cuenta y manda un informe semanal.",
    hace: [
      "Lleva solo los ajustes que llegaron a este nivel, sin aviso por cada cambio.",
      "Un día por semana, sorteado y apuntado antes, trabaja con las consignas del frigorista para seguir demostrando el ahorro.",
      "Recalibra sus referencias solo con esos días de control; una deriva sin causa se trata primero como posible avería.",
    ],
    noHace: "Los desescarches con gas caliente, el orden de compresores y la presión intermedia nunca llegan a este nivel.",
    consigue: [
      "Ahorro continuo y demostrado mes a mes.",
      "Informe semanal al técnico y mensual al cliente, con euros, margen y calidad del dato.",
      "Expediente para certificados de ahorro (CAE) si la vía de actuación singular se confirma: se cobra una vez.",
    ],
    ahorro: "El del nivel 3 de forma continua, menos lo que cuesta el día de control semanal (en torno a una séptima parte del ahorro). CAE: estimado 9–19 k€ una sola vez en una planta de 1 GWh, sin confirmar con gestores.",
    calidad: "Ahorro medido con días de control (con variabilidad diaria del 5 %, un trimestre da ±1,5 % y un año ±0,75 %).",
    datos: ["Todo lo del nivel 3."],
    equipos: [{ que: "Ninguno nuevo", coste: "0 €", quien: "—", obligatorio: false }],
    automata: ["Nada nuevo."],
    software: ["Informe semanal y mensual automático, detección de deriva: por programar."],
    papeles: ["Protocolo de verificación firmado como anexo del contrato."],
    quien: {
      gradiox: ["Informes", "Guardia del sistema", "Revisar deriva y reversiones"],
      instalador: ["Guardia 24 h de la planta, como siempre", "Modo mantenimiento cuando trabaje"],
      cliente: ["Leer el informe", "Avisar de cambios (ampliaciones, otro producto, turnos)"],
      hugo: ["Aprobar la subida de cada ajuste a este nivel"],
    },
    puerta: [
      "8 semanas en «Aplicar con aviso».",
      "Ahorro medido mayor que el doble de su incertidumbre.",
      "Como mucho 1 reversión al mes y ninguna por temperatura del género.",
      "Latido disponible al menos el 99 % del tiempo.",
    ],
    bajada: "Las mismas que en el nivel 3, y además a «Avisar» con una sonda dudosa en una variable del ajuste o un analizador sin datos.",
    plazo: "Grupo «Presiones» hacia la semana 18; grupo «Horario y potencia» hacia la semana 24. Unos 4 meses hasta el primer automático y 6 hasta los dos grupos (antes, 6–9 meses).",
    coste: "Sin equipos nuevos.",
    riesgos: [
      { riesgo: "Confianza de más del personal", garantia: "Informe semanal, botón de parada visible y formación del encargado de la instalación (RSIF art. 18)." },
      { riesgo: "Cambia la planta (ampliación, otro producto) y el modelo deja de valer", garantia: "Se anota, se aparta ese tramo y se recalcula la línea base; los días de control siguen valiendo." },
    ],
    hoy: [{ texto: "Todo lo de este nivel", estado: "pendiente" }],
  },
];

export interface TopeAjuste {
  ajuste: string;
  tope: 0 | 1 | 2 | 3 | 4;
  porQue: string;
}

/** Hasta qué nivel puede llegar cada ajuste, aunque pase todas las pruebas. */
export const TOPES: TopeAjuste[] = [
  { ajuste: "Devolver consignas movidas (J4)", tope: 4, porQue: "Vuelve a un valor ya validado." },
  { ajuste: "Condensación flotante (J1, J10)", tope: 4, porQue: "Efecto físico comprobado y riesgos con guardas medibles." },
  { ajuste: "Aspiración flotante (J2) en positivas y −10 °C", tope: 4, porQue: "Margen suficiente sobre la temperatura del género." },
  { ajuste: "Aspiración flotante (J2) en −32/−40 °C", tope: 2, porQue: "Menos margen en congelado: solo propuesta." },
  { ajuste: "Frío a horas baratas (J8)", tope: 4, porQue: "Ya trabaja con techo de temperatura y vuelta atrás." },
  { ajuste: "Potencia contratada (J9)", tope: 3, porQue: "Acción breve (15 min) y acotada." },
  { ajuste: "Bombas de glicol (J6)", tope: 3, porQue: "Riesgo de congelar el intercambiador; mínimo fijo en el autómata." },
  { ajuste: "Recuperación de calor (J7)", tope: 3, porQue: "Sube la condensación: puede costar más de lo que ahorra." },
  { ajuste: "Desescarche por necesidad (J5)", tope: 2, porQue: "Con gas caliente en amoniaco nunca se inicia en remoto: solo aplazar dentro del máximo." },
  { ajuste: "Presión intermedia (J11)", tope: 2, porQue: "Límites de cada máquina; ganancia pequeña." },
  { ajuste: "Orden de compresores (J3)", tope: 2, porQue: "Los arranques y paros los decide el autómata." },
];

/** Lo que Gradiox no escribe nunca, en ningún nivel. */
export const NUNCA = [
  "Enclavamientos y seguridades",
  "Presostatos y su tarado",
  "Umbrales de alarma y rearme de alarmas",
  "Temporizadores antiarranque y límites de intensidad",
  "Válvulas (solenoides, gas caliente, purga)",
  "Marcha o paro directo de compresores",
  "Detectores y ventilación de amoniaco",
  "Niveles de separador y parámetros de aceite",
];

export const CAPAS = [
  { titulo: "Seguridades del autómata y del cuadro", texto: "Presostatos, válvulas de seguridad, detección de amoniaco, paradas de emergencia. Gradiox no las toca (EN 378-2 las pide independientes de la regulación)." },
  { titulo: "Bloque «consigna remota» en el autómata", texto: "Lo programa el instalador. Consigna del frigorista aparte, límites y rampa que solo se cambian en planta, selector Local/Remoto y latido: si algo falla, vuelve solo a la consigna del frigorista, aunque no haya internet ni PC." },
  { titulo: "Guardia en la pasarela", texto: "Guarda la envolvente (la nube no la puede ampliar), frena los cambios bruscos y, si pierde la nube 5 minutos, reescribe las consignas originales guardadas en disco. Tiene su botón de parada." },
  { titulo: "La nube", texto: "Decide, estima y verifica. Sus órdenes caducan a los 2 minutos, así que un fallo suyo queda acotado por las capas de abajo." },
];

/** Lo que para el automático en cualquier nivel. */
export const PARADAS = [
  "Una cámara se sale de su temperatura: vuelve atrás al momento.",
  "Alarma activa, desescarche (y 20 min después) o arranque reciente en ese grupo.",
  "Un dato de más de 2 minutos, congelado o de una sonda dudosa.",
  "Entra mercancía en una cámara: esa cámara queda fuera hasta que recupere.",
  "Lo leído después de escribir no coincide con lo escrito.",
  "El reloj de la pasarela se desvía más de 30 s.",
  "Se detecta amoniaco: parada total y aviso.",
];

export const AHORRO = [
  "Antes de tocar nada se mide la línea base: cómo gasta la instalación según el tiempo y la carga (3 meses mínimo, 12 ideal).",
  "Días de control sorteados en bloques de 2 días, con el sorteo apuntado antes en el registro: unos días con el ajuste y otros sin él. La diferencia, a igual tiempo y carga, es el ahorro medido (ensayo encendido/apagado del IPMVP).",
  "Dos semanas no bastan para ver un 3 %. Hace falta un número de días que depende de lo que varía la planta: con una variabilidad diaria del 5 %, unos 45 días por cada lado para acertar 8 de cada 10 veces. Se revisa en semanas fijadas de antemano (2, 4, 8 y 12).",
  "Un ahorro solo cuenta si supera el doble de su margen. Si no, el informe dice «Ahorro no demostrado este mes».",
  "Los ajustes se prueban en grupos. Dos ajustes juntos con un diseño 2×2 (bloques de 4 días: ninguno, uno, el otro, los dos, en orden sorteado) se miden cada uno por separado con la misma precisión que si fueran solos, y además se ve cómo se combinan. Con más de dos a la vez, el total sigue medido pero el reparto pasa a estimado.",
  "En automático, un día de control sorteado por semana mantiene la prueba viva.",
];

/** Lo que falta decidir o conseguir, sea de quien sea. */
export const PENDIENTE: { texto: string; quien: string }[] = [
  { texto: "Base de datos Supabase para guardar historia, avisos y registro", quien: "Hugo" },
  { texto: "Pedir al instalador: potencia por compresor, modelos y hojas de selección, presión relativa o absoluta, temperatura exterior, facturas", quien: "Hugo" },
  { texto: "Rellenar en la ficha técnica de cada instalación qué equipos de medida ya tiene y si el autómata los lee (apartado 6, también desde el enlace del instalador)", quien: "Instalador" },
  { texto: "Especificación del bloque «consigna remota» y prueba en el autómata simulado", quien: "Gradiox" },
  { texto: "Guardia local de la pasarela (latido, rampa, vuelta sin nube)", quien: "Gradiox" },
  { texto: "Consulta escrita a Industria o a un OCA: ¿cambiar consignas por software es explotación o modificación?", quien: "Hugo" },
  { texto: "Consulta a 2 gestores de CAE y 1 verificador sobre la actuación singular", quien: "Hugo" },
  { texto: "Modelo de contrato con envolvente firmada y exclusión de función de seguridad; seguro", quien: "Hugo" },
  { texto: "Pasar la tarifa a 3.0TD/6.xTD (seis periodos) y etiquetar como estimado el ahorro de la actuación por tarifa", quien: "Gradiox" },
];

export const ROTULO_HOY: Record<EstadoHoy, string> = { hecho: "Hecho", simulado: "Solo simulado", pendiente: "Pendiente" };

export interface GrupoAjustes {
  nombre: string;
  ajustes: string;
  prueba: string;
  porQueJuntos: string;
  empieza: string;
}

/**
 * El camino rápido: los ajustes se prueban en grupos y no de uno en uno.
 * La seguridad no cambia: nada se escribe antes del bloque del autómata y la
 * prueba de corte, y cada ajuste conserva su tope.
 */
export const GRUPOS: GrupoAjustes[] = [
  {
    nombre: "Desde el primer día",
    ajustes: "Devolver consignas movidas (J4)",
    prueba: "Sin prueba de ahorro: vuelve a valores ya validados por el frigorista.",
    porQueJuntos: "No tiene riesgo nuevo.",
    empieza: "Semana 4, con la prueba de corte",
  },
  {
    nombre: "Presiones",
    ajustes: "Condensación flotante (J1, J10) y aspiración flotante (J2, en positivas y −10 °C)",
    prueba: "Diseño 2×2 en bloques de 4 días sorteados. Mide cada uno y cómo se combinan (los dos bajan el salto de presión, así que no se suman).",
    porQueJuntos: "Son los dos de más ahorro y se miden juntos sin perder precisión.",
    empieza: "Semana 4",
  },
  {
    nombre: "Horario y potencia",
    ajustes: "Frío a horas baratas (J8), potencia contratada (J9) y bombas de glicol (J6) si hay salto térmico medido",
    prueba: "J8 en euros, en bloques de 2 días descartando el primero (el género guarda frío); J9 con el maxímetro de la factura; J6 en su propia rotación. El total es medido; el reparto entre los tres, estimado.",
    porQueJuntos: "Se miden en euros y en potencia, no en kWh del día, así que se cruzan poco con «Presiones».",
    empieza: "Cuando «Presiones» pasa a «Aplicar con aviso» (hacia la semana 10)",
  },
  {
    nombre: "Siempre aparte",
    ajustes: "Recuperación de calor (J7), desescarche (J5), orden de compresores (J3), presión intermedia (J11), aspiración en −32/−40 °C",
    prueba: "Uno a uno y solo como propuesta o con aviso, según su tope.",
    porQueJuntos: "J7 sube la condensación (va contra «Presiones»); los demás tocan el género o las máquinas y no pasan de proponer.",
    empieza: "Cuando haya datos para cada uno",
  },
];

export const CALENDARIO: { semanas: string; que: string }[] = [
  { semanas: "0–2", que: "Conexión y ficha; integrar los analizadores; pedir al instalador sus históricos de consumo. Avisos de física desde el primer día." },
  { semanas: "1–4", que: "El instalador programa el bloque «consigna remota» (Gradiox da la especificación); prueba en simulado; envolvente firmada; consulta a Industria enviada." },
  { semanas: "4", que: "Prueba de corte del latido en planta, con el frigorista. Empiezan «Desde el primer día» y «Presiones» en «Proponer», con días de control." },
  { semanas: "4–10", que: "Días de control de «Presiones». Revisiones fijadas a las 2, 4 y 6 semanas. Si el ahorro es pequeño (3 %), puede alargarse hasta la semana 17." },
  { semanas: "≈10", que: "«Presiones» pasa a «Aplicar con aviso» si cumple su puerta y está la respuesta de Industria. Empieza «Horario y potencia» en «Proponer»." },
  { semanas: "≈18", que: "«Presiones» pasa a «Automático». «Horario y potencia» a «Aplicar con aviso»." },
  { semanas: "≈24", que: "«Horario y potencia» pasa a «Automático»." },
];

/** Qué se gana y qué se pierde con el camino rápido, dicho sin adornos. */
export const RAPIDO_BALANCE = {
  gana: [
    "Primer ajuste en automático hacia la semana 18 (unos 4 meses) en vez de la 24–36; los dos grupos principales en unos 6 meses en vez de 6–9.",
    "Las pruebas empiezan en la semana 4: no se esperan 3 meses de línea base, porque los días de control sorteados ya comparan con y sin ajuste en la misma planta.",
    "Con históricos del instalador, la línea base está desde el primer día.",
  ],
  pierde: [
    "Nada en seguridad: el bloque del autómata, la prueba de corte, los topes y las bajadas automáticas son los mismos.",
    "Nada en el ahorro total ni en J1 y J2 por separado: el diseño 2×2 los mide igual que de uno en uno.",
    "En «Horario y potencia», el reparto entre sus tres ajustes es estimado (el total sí es medido).",
    "Si no hay históricos y se empieza sin línea base medida antes, se pierde la vía de certificados de ahorro (CAE) para esa planta, que exige medir antes de actuar.",
    "Si algo va mal con un grupo activo, se deshace el grupo entero, porque no se sabe a la primera cuál de sus ajustes fue.",
  ],
};
