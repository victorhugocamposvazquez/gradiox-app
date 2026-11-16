// Guía para visitar a un cliente sin ser técnico: qué es el aparato de
// Gradiox, qué mirar, qué fotografiar y qué preguntar.

import type { Tema } from "./ayuda";

/** Los tres cables del aparato. */
export const CABLES: { id: string; titulo: string; detalle: string }[] = [
  { id: "controladores", titulo: "A los controladores", detalle: "Un cable fino de dos hilos que va pasando de un controlador al siguiente, o un cable de red si son modernos. Con un solo cable se llega a todas las cámaras de la sala." },
  { id: "internet", titulo: "A internet", detalle: "Un cable de red al router de la empresa. Si no hay internet en la sala, lleva dentro una tarjeta de móvil y este cable no hace falta." },
  { id: "corriente", titulo: "A la corriente", detalle: "Un enchufe normal o la alimentación del propio cuadro eléctrico. Gasta muy poco." },
];

/** Costes estimados, sin presupuesto de ningún proveedor todavía. */
export const COSTES: { concepto: string; importe: string; nota: string }[] = [
  { concepto: "El aparato", importe: "150 a 500 €", nota: "Según el modelo que se elija" },
  { concepto: "Accesorios", importe: "30 a 80 €", nota: "Fuente de alimentación, antena y cables" },
  { concepto: "Tarjeta de datos", importe: "3 a 10 € al mes", nota: "Solo si no hay internet por cable" },
  { concepto: "Instalación", importe: "1 a 2 horas", nota: "De un técnico. Si el cliente es instalador, la hace él" },
];

// En las ventanas de la visita: «sencillo» es qué hacer, «tecnico» es por qué importa y «hoy» es qué anotar.
export const PASOS_VISITA: Tema[] = [
  {
    id: "antes",
    titulo: "Antes de ir",
    corto: "Pide que esté presente quien se ocupa del frío y que te dejen entrar a la sala de máquinas. Lleva el móvil con batería: casi todo el trabajo son fotos.",
    sencillo: [
      "Al concertar la visita, pregunta quién mantiene las cámaras, si es alguien de la casa o una empresa de fuera, y pide que esté ese día.",
      "Pide permiso para hacer fotos de los equipos. Di que es solo para identificar los modelos.",
      "Abre esta guía en el móvil antes de entrar: dentro de una nave puede no haber cobertura.",
    ],
    tecnico: [
      "Quien mantiene el frío sabe dónde está cada cosa y qué da problemas. Sin esa persona, la visita se queda a medias.",
      "Las fotos de las etiquetas permiten identificar el modelo exacto y buscar su manual, que es de donde sale la ficha del equipo.",
    ],
    hoy: "El nombre y el teléfono de quien mantiene el frío.",
  },
  {
    id: "camaras",
    titulo: "Cuenta las cámaras",
    corto: "Apunta cuántas hay, cómo las llaman en la casa, qué guardan y a qué temperatura deben estar.",
    sencillo: [
      "Recorre la instalación con el cliente y haz una lista: «Congelado 1», «Fresco pescado», «Obrador». Usa los nombres que usan ellos.",
      "Pregunta por cada una qué guarda y a qué temperatura debe estar. No hace falta que lo sepas tú: lo saben ellos.",
      "Pregunta cuál les preocupa más y cuál ha dado problemas.",
    ],
    tecnico: [
      "Cada cámara será un Servicio en Gradiox, con ese mismo nombre y sus límites de temperatura.",
      "El número de cámaras y la distancia entre ellas deciden cuántas pasarelas hacen falta.",
    ],
    hoy: "Lista de cámaras con nombre, contenido y temperatura.",
  },
  {
    id: "controladores",
    titulo: "Busca el controlador de cada cámara",
    corto: "Es el aparato con pantalla y números que hay junto a la puerta o en el cuadro eléctrico. Haz una foto de frente y otra de su etiqueta.",
    sencillo: [
      "Pregunta «¿dónde se ve la temperatura de esta cámara?». Lo que te enseñen es el controlador.",
      "Haz una foto de frente, donde se vea la marca, y otra de la etiqueta con el modelo. La etiqueta suele estar en un lateral o detrás.",
      "Si la etiqueta está dentro del cuadro eléctrico, no lo abras tú. Pide al técnico que lo abra y haz la foto sin tocar nada.",
    ],
    tecnico: [
      "La marca y el modelo exacto dicen si el controlador tiene comunicación y en qué idioma habla. De ahí sale su ficha.",
      "Si hay un controlador por cámara o una central que gobierna varias cambia cómo se conecta la pasarela.",
    ],
    hoy: "Dos fotos por controlador: de frente y de la etiqueta.",
  },
  {
    id: "conexion",
    titulo: "Mira si ya están conectados entre sí",
    corto: "Pregunta si hay algún ordenador o pantalla donde ya se vean todas las cámaras juntas, y si los controladores tienen un cable que va de uno a otro.",
    sencillo: [
      "Pregunta: «¿hay algún sitio donde veáis todas las temperaturas a la vez?». Si lo hay, hazle una foto y apunta cómo se llama el programa.",
      "Pregunta al técnico si los controladores están unidos por un cable de comunicación. Con que te diga sí o no, basta.",
      "Si te dejan, haz una foto de la parte de atrás de un controlador, donde entran los cables.",
    ],
    tecnico: [
      "Un sistema de supervisión existente indica que el bus ya está cableado y con direcciones asignadas: la pasarela se suma a él o lee de ese sistema.",
      "En la foto trasera se ven los bornes de comunicación, normalmente marcados como A y B, o RS-485.",
    ],
    hoy: "Si hay un sistema que ya las junta, su nombre y una foto.",
  },
  {
    id: "internet",
    titulo: "Comprueba el internet",
    corto: "Mira si hay un router o una toma de red cerca de los controladores, y cuántas rayas de cobertura tiene tu móvil en ese sitio.",
    sencillo: [
      "Pregunta dónde está el router de la empresa y si llega cable de red hasta la sala donde están los controladores.",
      "Saca el móvil justo donde iría el aparato y mira la cobertura. Apunta las rayas y tu compañía.",
      "Pregunta quién lleva la informática, por si hay que pedirle permiso para conectar un aparato a la red.",
    ],
    tecnico: [
      "Con red por cable, la pasarela solo necesita salida a internet por el puerto 443. Sin ella, va con tarjeta de móvil.",
      "Las salas de máquinas suelen tener mala cobertura: saberlo antes evita llevar el aparato equivocado.",
    ],
    hoy: "Si hay red por cable, la cobertura del móvil y quién lleva la informática.",
  },
  {
    id: "sitio",
    titulo: "Busca el sitio del aparato",
    corto: "Tiene que quedar cerca de los controladores, bajo techo y con un enchufe. Haz una foto del sitio.",
    sencillo: [
      "Pregunta al técnico dónde lo pondría él. Lo normal es dentro del cuadro eléctrico o en la pared de al lado.",
      "Comprueba que hay corriente cerca y que no es un sitio donde se moje o haga mucho frío.",
      "Haz una foto general del sitio y del cuadro, cerrado.",
    ],
    tecnico: [
      "El aparato va fuera de la cámara, en zona seca. Dentro del cuadro se monta en carril DIN y se alimenta de él.",
      "La distancia hasta el último controlador importa: el cable de dos hilos admite tiradas largas, el de red no más de cien metros.",
    ],
    hoy: "Foto del sitio y si hay enchufe.",
  },
  {
    id: "preguntas",
    titulo: "Pregunta al cliente",
    corto: "Lo que más interesa saber es qué le quita el sueño, cómo se entera hoy de un fallo y si acepta empezar solo mirando.",
    sencillo: [
      "«¿Qué pasa hoy si una cámara falla de noche? ¿Quién se entera y cómo?»",
      "«¿Apuntáis las temperaturas a mano? ¿Quién, y cuánto tiempo lleva?»",
      "«¿Habéis perdido género alguna vez por un fallo de frío?»",
      "«¿Nos dejaríais poner un aparato que solo lee, sin cambiar nada de la instalación?»",
    ],
    tecnico: [
      "Las respuestas dicen qué vender primero: avisos, registros automáticos o ahorro de luz.",
      "El permiso para leer es lo único que hace falta para un piloto. Las órdenes vienen después y por separado.",
    ],
    hoy: "Las respuestas, con sus palabras.",
  },
  {
    id: "despues",
    titulo: "Al salir",
    corto: "Manda las fotos y las notas a Claude el mismo día. Con eso se identifican los modelos, se elige el aparato y se prepara la propuesta.",
    sencillo: [
      "Sube las fotos y las notas al hilo de Gradiox. No hace falta ordenarlas.",
      "No prometas fechas ni precios en la visita. Di que en unos días tendrán una propuesta.",
    ],
    tecnico: ["Con modelo y fotos se busca el manual, se escribe la ficha del equipo y se confirma si se puede leer por cable o hacen falta sondas."],
    hoy: "Nada más. Enviar lo recogido.",
  },
];

export const ROTULOS_VISITA = { sencillo: "Qué hacer", tecnico: "Por qué importa", hoy: "Qué anotar" };

/** Lo que suele preguntar el cliente en la visita, con una respuesta corta y cierta. */
export const RESPUESTAS: { pregunta: string; respuesta: string }[] = [
  { pregunta: "¿Hay que cambiar mis equipos?", respuesta: "No. Gradiox se conecta a los controladores que ya tiene." },
  { pregunta: "¿Y si vuestro aparato se estropea?", respuesta: "Sus cámaras siguen funcionando exactamente igual, con su controlador de siempre. Solo dejaríamos de ver los datos hasta cambiarlo." },
  { pregunta: "¿Podéis cambiar algo en mi instalación?", respuesta: "Al principio no: solo lee. Más adelante, y solo si usted quiere, podrá hacer ajustes con su permiso." },
  { pregunta: "¿Entra alguien en mi red?", respuesta: "No. El aparato solo llama hacia fuera, como cuando usted abre una página web. Y puede ir con su propia tarjeta de móvil, sin tocar su red." },
  { pregunta: "¿Vale para mi marca?", respuesta: "Lo confirmamos al ver el modelo. Por eso le pido hacer fotos de las etiquetas." },
  { pregunta: "¿Cuánto cuesta?", respuesta: "Se lo decimos en la propuesta, cuando sepamos qué equipos tiene. No dé cifras en la visita." },
];

/** La lista para marcar durante la visita. */
export const LISTA: { id: string; texto: string }[] = [
  { id: "contacto", texto: "Nombre y teléfono de quien mantiene el frío" },
  { id: "camaras", texto: "Lista de cámaras con nombre, contenido y temperatura" },
  { id: "fotos-frente", texto: "Foto de frente de cada controlador" },
  { id: "fotos-etiqueta", texto: "Foto de la etiqueta de cada controlador" },
  { id: "sistema", texto: "Si hay un sistema que ya junta las cámaras, su nombre y una foto" },
  { id: "red", texto: "Si llega cable de red a la sala" },
  { id: "cobertura", texto: "Cobertura del móvil donde iría el aparato" },
  { id: "informatica", texto: "Quién lleva la informática" },
  { id: "sitio", texto: "Foto del sitio del aparato y si hay enchufe" },
  { id: "preguntas", texto: "Respuestas del cliente a las cuatro preguntas" },
  { id: "permiso", texto: "Si aceptan un aparato que solo lee" },
];
