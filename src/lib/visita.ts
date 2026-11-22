// Guía para visitar a un cliente sin ser técnico: qué es el aparato de
// Gradiox, qué mirar, qué fotografiar y qué preguntar.

import type { Tema } from "./ayuda";

/** Los tres cables del aparato. */
export const CABLES: { id: string; titulo: string; detalle: string }[] = [
  { id: "controladores", titulo: "A los controladores", detalle: "Un cable fino de dos hilos que va pasando de un controlador al siguiente, o un cable de red si son modernos o si hay un autómata que los gobierna. Con un solo cable se llega a todas las cámaras de la sala." },
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
    id: "automata",
    titulo: "Pregunta si hay un autómata",
    corto: "En instalaciones grandes, un ordenador industrial llamado autómata gobierna todas las cámaras desde el cuadro eléctrico. Si lo hay, Gradiox lee de él y no de cada controlador.",
    sencillo: [
      "Pregunta al técnico: «¿hay un autómata que lo gobierne todo?». Si dice que sí, pide que te lo enseñe y hazle una foto de frente sin tocar nada.",
      "Apunta la marca y el modelo que pone en su frontal. Por ejemplo, en un Siemens S7-1500 pone algo como «CPU 1513».",
      "Pregunta quién lo programa, si alguien de la casa o una empresa de fuera, y pide su nombre y su teléfono.",
      "Pregunta si tiene activado «OPC UA» y si pueden pasar la lista de variables. Con que apuntes la respuesta, basta.",
    ],
    tecnico: [
      "Con autómata, la pasarela se conecta a él por la red de la planta y lee con OPC UA, un estándar abierto con usuario y cifrado. A la red interna del autómata con sus equipos (Profinet) no hay que entrar.",
      "Quien programa el autómata es quien activa OPC UA y decide qué variables se pueden leer y cuáles escribir. Sin esa persona no hay conexión.",
      "La lista de variables hace de ficha del equipo: temperaturas, alarmas, estados de compresores y consignas.",
    ],
    hoy: "Marca y modelo del autómata, una foto, quién lo programa y si tiene OPC UA activado.",
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
    corto: "Deja la ficha del cliente completa en «Clientes» y avisa a Claude el mismo día. Con eso se identifican los modelos, se elige el aparato y se prepara la propuesta.",
    sencillo: [
      "Da de alta al cliente en «Clientes» y apunta allí sus datos, sus cámaras y las fotos. Puedes hacerlo durante la visita, desde el móvil.",
      "Avisa en el hilo de Gradiox de que la ficha está lista. Si alguna foto no se ha podido subir, mándala por el hilo.",
      "No prometas fechas ni precios en la visita. Di que en unos días tendrán una propuesta.",
    ],
    tecnico: ["Con modelo y fotos se busca el manual, se escribe la ficha del equipo y se confirma si se puede leer por cable o hacen falta sondas."],
    hoy: "Nada más. Comprobar que la ficha del cliente dice «Guardado».",
  },
];

export const ROTULOS_VISITA = { sencillo: "Qué hacer", tecnico: "Por qué importa", hoy: "Qué anotar" };

/** Lo que suele preguntar el cliente en la visita, con una respuesta corta y cierta. */
export const RESPUESTAS: { pregunta: string; respuesta: string }[] = [
  { pregunta: "¿Hay que cambiar mis equipos?", respuesta: "No. Gradiox se conecta a los controladores o al autómata que ya tiene." },
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
  { id: "automata", texto: "Si hay autómata: marca, modelo, foto y quién lo programa" },
  { id: "red", texto: "Si llega cable de red a la sala" },
  { id: "cobertura", texto: "Cobertura del móvil donde iría el aparato" },
  { id: "informatica", texto: "Quién lleva la informática" },
  { id: "sitio", texto: "Foto del sitio del aparato y si hay enchufe" },
  { id: "preguntas", texto: "Respuestas del cliente a las cuatro preguntas" },
  { id: "permiso", texto: "Si aceptan un aparato que solo lee" },
];

/**
 * La visita de conexión: cuando el cliente ya tiene autómata y se va a la
 * planta a conectar la pasarela por OPC UA. Va dentro del paso «Programa
 * instalado en la planta y leyendo el autómata» de la hoja de ruta y se puede
 * leer también en la guía de visita. Siempre solo leyendo: escribir en el
 * autómata es otro día y con permiso por escrito.
 */
export const PASOS_CONEXION: Tema[] = [
  {
    id: "c-antes",
    titulo: "La víspera",
    corto: "Confirma con quien programa el autómata que va a estar, qué autómata vais a conectar y que el servidor OPC UA ya está activado. Abre el programa de la pasarela en tu portátil y comprueba que va con el autómata simulado.",
    sencillo: [
      "Llama a quien programa el autómata. Pregúntale: «¿Qué autómata conectamos mañana? ¿Tienes ya activado el OPC UA en él?». Si no lo está, lo activa él en TIA Portal; no se hace en la visita sin que él lo decida.",
      "Pregúntale si activarlo obliga a parar el autómata un momento. Si es así, que elija él cuándo: en una planta funcionando no se para nada por nosotros.",
      "En tu portátil abre «Gradiox Pasarela», marca «PLC simulado, para probar» y mira que arriba ponga «PLC conectado». Si va en casa, irá allí.",
      "En el panel, mira que la pasarela del cliente existe y tiene token. Si el token no lo tienes, saca uno nuevo en «Pasarelas».",
      "Mete en la mochila: el portátil cargado y su cargador, un cable de red de 3 a 5 metros, el adaptador de red si el portátil no tiene puerto, y un pendrive.",
    ],
    tecnico: [
      "En un Siemens S7-1500 el servidor OPC UA se activa en las propiedades de la CPU y se carga al PLC. Es un cambio de configuración: según la versión puede pedir pasar la CPU a STOP. Que lo decida y lo haga su programador.",
      "En S7-1500 el servidor OPC UA suele pedir una licencia de runtime según el tamaño de la CPU. Que el programador confirme si la tiene. No lo hemos comprobado en una fuente oficial.",
      "El programa lleva un autómata simulado dentro: probarlo la víspera descarta problemas del portátil antes de llegar.",
    ],
    hoy: "Quién va a estar, qué autómata se conecta y si el OPC UA ya está activado.",
  },
  {
    id: "c-preguntas",
    titulo: "Antes de enchufar nada",
    corto: "Pide permiso al técnico para conectar tu portátil a la red del autómata y pregúntale tres cosas: la dirección del autómata, si pide usuario y qué dirección libre puedes usar tú.",
    sencillo: [
      "«¿Cuál es la dirección del autómata y el puerto del OPC UA?». Lo normal es algo como 50.50.0.1 y el puerto 4840.",
      "«¿Pide usuario y contraseña?». Lo ideal es que cree un usuario solo para Gradiox que solo pueda leer. La contraseña la escribe él o la apuntas en el programa, nunca en un chat.",
      "«¿Qué dirección puedo poner a mi portátil sin chocar con nada?». Por ejemplo 50.50.0.200.",
      "Dile que hoy solo vamos a leer. No se cambia ningún valor del autómata.",
    ],
    tecnico: [
      "Dos aparatos con la misma dirección en una red de planta pueden tumbar comunicaciones: la dirección del portátil la da el técnico.",
      "Un usuario de solo lectura en el servidor OPC UA es la mejor garantía: aunque el programa fallara, el autómata no aceptaría escrituras.",
    ],
    hoy: "Dirección y puerto del autómata, si pide usuario y la dirección de tu portátil.",
  },
  {
    id: "c-conectar",
    titulo: "Conecta tu portátil",
    corto: "Cable del portátil a la red del autómata, pones la dirección que te dio el técnico y, en el programa, «PLC de verdad» con la dirección del autómata. Arriba tiene que poner «PLC conectado».",
    sencillo: [
      "Enchufa el cable al punto de red que te diga el técnico (un switch del cuadro o el propio autómata).",
      "En el Mac: Ajustes, Red, Ethernet, Detalles, TCP/IP, «Manualmente». Pon la dirección que te dio y máscara 255.255.255.0.",
      "En la página del programa, «Conexión»: «PLC de verdad», la dirección del autómata, usuario y contraseña si los hay, y «Guardar y conectar».",
      "Si no conecta, la tarjeta «PLC» dice por qué en una frase. Lo más habitual: el OPC UA sin activar o el portátil en otra red.",
      "Si dice que el autómata no se fía del certificado: «Abrir la carpeta de datos», carpeta «certificado», y dale al técnico el archivo gradiox-pasarela.pem en el pendrive. Él lo acepta en TIA Portal.",
    ],
    tecnico: [
      "La conexión es OPC UA cliente-servidor por la red Ethernet de la planta. No se entra en Profinet como dispositivo.",
      "«Sin cifrar» solo para salir del paso con cable y con el visto bueno del técnico. Lo que se quede instalado, cifrado.",
    ],
    hoy: "Si conectó a la primera y, si no, qué frase salió.",
  },
  {
    id: "c-variables",
    titulo: "Elige las variables con el técnico",
    corto: "Pulsa «Buscar variables». Vienen marcadas las de nuestra lista; repasa con el técnico las que faltan y qué significa cada grupo. Luego «Leer las marcadas».",
    sencillo: [
      "Abajo salen las de nuestra lista que el autómata no tiene. Pregúntale por ellas, sobre todo por las alarmas.",
      "Pregunta qué es cada cosa en las cámaras: la temperatura, las consignas, si está enfriando, desescarchando o en avería. Apunta sus palabras.",
      "Pregunta si hay alguna medida de consumo eléctrico o de puertas abiertas: hoy no la tenemos.",
    ],
    tecnico: [
      "La lista elegida y la búsqueda completa se guardan en el portátil y, con token, se proponen a Gradiox para aceptarlas en el panel.",
      "Las palabras de alarma por bits que el panel del operador lee por dirección absoluta no tienen nombre en OPC UA: el programador tiene que publicarlas con nombre.",
    ],
    hoy: "Lo que falte de la lista, qué es cada variable dudosa y si hay consumo o puertas.",
  },
  {
    id: "c-cuadra",
    titulo: "Comprueba que cuadra",
    corto: "Déjalo leyendo diez minutos y compara con el técnico tres valores con su pantalla: la temperatura de una cámara, una consigna y un compresor en marcha o parado.",
    sencillo: [
      "Abre a la vez la pantalla del técnico (el panel del operador) y la del programa. Mira que la temperatura de una cámara sea la misma.",
      "Haz lo mismo con una consigna y con un compresor. Haz una foto de las dos pantallas juntas.",
      "Si algo no cuadra, apúntalo: suele ser una unidad (décimas, por ejemplo) o una variable que no es la que creíamos.",
    ],
    tecnico: ["Es la validación mínima de que nombre, tipo y escala de las variables son los que suponemos antes de construir avisos y ahorro encima."],
    hoy: "Tres valores comparados y una foto de las dos pantallas.",
  },
  {
    id: "c-dejar",
    titulo: "Si se queda instalado en su ordenador",
    corto: "Solo si el cliente quiere y el técnico está de acuerdo: el programa de Windows en su ordenador de la planta, con su token, abriéndose solo al encender y sin permitir órdenes.",
    sencillo: [
      "Copia gradiox-pasarela-windows.zip en el pendrive y descomprímelo en el ordenador de la planta. Windows puede avisar porque el programa no lleva firma comprada: «Más información», «Ejecutar de todas formas».",
      "Conexión: la dirección del autómata, el token de la pasarela del cliente y marca «Abrirse solo al encender el ordenador».",
      "Deja sin marcar «Permitir órdenes de Gradiox».",
      "Comprueba que el ordenador tiene internet por su otra tarjeta de red: arriba debe decir que entrega a Gradiox.",
    ],
    tecnico: [
      "El programa solo llama hacia fuera por HTTPS (puerto 443) y guarda en disco lo que no pueda entregar.",
      "El ordenador tiene que iniciar la sesión de Windows solo para que el programa arranque tras un corte de luz.",
    ],
    hoy: "Si se quedó instalado y, en el panel, que la pasarela entrega.",
  },
  {
    id: "c-salir",
    titulo: "Al salir",
    corto: "Comprueba que no se ha cambiado nada en el autómata, apunta en la ficha lo que te han dicho y avisa a Claude el mismo día.",
    sencillo: [
      "Pregunta al técnico si queda todo como estaba. Hoy no se escribe nada en el autómata.",
      "Desenchufa tu portátil y vuelve a poner su red en automático (DHCP) para tener internet.",
      "Con internet, en «Pasarelas», abre la instalación y pulsa «Usar esta lista».",
      "Escribe en el hilo de Gradiox lo que salió y manda las fotos que no hayas subido.",
    ],
    tecnico: ["Dar órdenes al autómata requiere que el programador abra variables concretas como escribibles y el visto bueno del cliente. Va en otra visita."],
    hoy: "Lista aceptada en el panel y aviso a Claude.",
  },
];
