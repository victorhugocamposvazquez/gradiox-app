// Textos de «Cómo funciona». Cada tema tiene una explicación corta, una
// sencilla para quien llega de nuevas y otra técnica para quien conoce el oficio.

export type Tema = {
  id: string;
  titulo: string;
  /** Una o dos frases que se leen en la propia pantalla. */
  corto: string;
  sencillo: string[];
  tecnico: string[];
  /** Cómo está esto hoy de verdad, sin adornar. */
  hoy: string;
};

export const PASOS: Tema[] = [
  {
    id: "controlador",
    titulo: "La cámara ya tiene un controlador",
    corto: "Cada cámara lleva un aparato con pantalla que mide la temperatura y decide cuándo arranca el frío. Gradiox no lo sustituye: lo aprovecha.",
    sencillo: [
      "Es la cajita con números que hay junto a la puerta de la cámara o en el cuadro eléctrico. Hace de termostato: si la cámara se calienta, pone en marcha el frío.",
      "Ese aparato ya sabe casi todo lo que interesa: la temperatura, si la puerta está abierta, si el compresor está trabajando y si hay alguna alarma.",
      "Lo único que le falta es contárselo a alguien que no esté delante. De eso se ocupa Gradiox.",
    ],
    tecnico: [
      "La mayoría de controladores de frío comercial e industrial tienen un puerto serie RS-485 y hablan Modbus RTU; los más recientes, Modbus TCP por Ethernet.",
      "De cada uno se leen temperatura de sonda, consigna, estado de compresor, puerta, desescarche y alarmas, según lo que ofrezca el modelo.",
      "Si un controlador no tiene comunicación, se añaden sondas propias junto a él.",
    ],
    hoy: "Probado con un controlador simulado que habla Modbus de verdad. Falta leer el primer controlador real.",
  },
  {
    id: "pasarela",
    titulo: "Se pone una pasarela a su lado",
    corto: "La pasarela es un aparato pequeño, del tamaño de un router, que se instala en el cuadro eléctrico. Se conecta por cable a los controladores y les pregunta cada pocos segundos cómo están.",
    sencillo: [
      "Piensa en ella como en un mensajero. Los controladores no saben usar internet; la pasarela sí. Les pregunta la temperatura y lo demás, y lleva la respuesta a Gradiox.",
      "Físicamente es una caja pequeña sin pantalla, con dos conexiones: un cable hacia los controladores y otro hacia internet. Donde no hay internet por cable puede llevar una tarjeta de móvil.",
      "Una sola pasarela atiende a muchas cámaras. Se instala una vez y no hay que tocarla.",
    ],
    tecnico: [
      "Es un ordenador industrial comprado, con marcado CE, puertos RS-485 y Ethernet, y 4G opcional, montado en carril DIN. El programa que lleva dentro es de Gradiox.",
      "Sondea cada equipo por Modbus con la ficha de su modelo y entrega las lecturas por HTTPS.",
      "Guarda en disco lo que no ha podido entregar y lo envía en orden, por tandas, cuando vuelve la conexión.",
    ],
    hoy: "El programa de la pasarela está hecho y probado. El modelo de aparato se elige después de ver los equipos de la primera instalación.",
  },
  {
    id: "internet",
    titulo: "La pasarela envía las lecturas por internet",
    corto: "Usa la conexión de la empresa o una tarjeta de móvil. Siempre llama ella hacia fuera: no hay que abrir nada en la red ni dejar entrar a nadie.",
    sencillo: [
      "Funciona igual que cuando tú abres una página web: la llamada sale de dentro hacia fuera. Desde fuera nadie puede entrar por la pasarela a la red de la empresa.",
      "Envía muy pocos datos, unos cuantos números cada medio minuto. No se nota en la conexión.",
      "Si internet se cae, la pasarela no deja de leer. Se lo guarda y lo entrega todo cuando vuelve, así que el histórico no tiene huecos.",
    ],
    tecnico: [
      "Solo conexiones salientes HTTPS al puerto 443. No requiere IP fija, apertura de puertos ni VPN.",
      "Cada envío va identificado con la clave de la pasarela. Un envío repetido no duplica datos.",
      "Las órdenes hacia la instalación, cuando lleguen, irán por un canal también iniciado por la pasarela.",
    ],
    hoy: "Hecho y probado, incluido el corte de internet y el reinicio de la pasarela. Falta dar a cada pasarela su propia clave.",
  },
  {
    id: "nube",
    titulo: "Gradiox lo guarda y lo vigila",
    corto: "Todo llega a los servidores de Gradiox, que guardan cada lectura y la comparan con lo que debería ser.",
    sencillo: [
      "Gradiox apunta cada lectura con su hora, como un cuaderno que nunca se pierde y que nadie tiene que rellenar a mano.",
      "A la vez comprueba si todo está en orden: que la temperatura no suba de lo debido, que una puerta no lleve demasiado tiempo abierta, que el compresor no esté parado cuando hace falta.",
      "También se da cuenta si una pasarela deja de entregar, para avisar de que se ha quedado sin noticias.",
    ],
    tecnico: [
      "Entrada HTTPS con validación de cada lote y guardado en Postgres, con una lectura única por pasarela, equipo e instante.",
      "Los datos de cada cliente van separados de los de los demás.",
      "Las reglas de aviso tienen umbral y tiempo de espera, para no avisar por un pico corto o por un desescarche.",
    ],
    hoy: "La entrada y el guardado están hechos. Falta conectar la base de datos definitiva y la separación por cliente.",
  },
  {
    id: "avisos",
    titulo: "Si algo va mal, avisa",
    corto: "Cuando una cámara se sale de lo normal, Gradiox avisa a quien esté de guardia, antes de que se estropee el género.",
    sencillo: [
      "El aviso llega al móvil y dice qué pasa, dónde y desde cuándo. Quien lo recibe marca que se ocupa, y los demás lo ven.",
      "Si nadie responde, vuelve a avisar y sube al siguiente responsable.",
      "No avisa por tonterías: espera un tiempo razonable antes de dar la voz, para no molestar por abrir una puerta un momento.",
    ],
    tecnico: [
      "Avisos por temperatura, puerta, compresor, falta de datos y mantenimiento atrasado, con horarios y guardias.",
      "Cada aviso queda en el registro con quién lo atendió y qué se hizo.",
    ],
    hoy: "Los avisos funcionan en la demostración con datos simulados. Falta alimentarlos con lecturas reales.",
  },
  {
    id: "pantalla",
    titulo: "Tú lo ves en el móvil o en el ordenador",
    corto: "Abres Gradiox y ves todas las cámaras de un vistazo: cuáles van bien, cuáles piden atención y qué ha pasado mientras no mirabas.",
    sencillo: [
      "No hay que instalar nada raro: se entra desde el navegador, con usuario y contraseña, desde cualquier sitio.",
      "Además de ver el estado, deja hechos los registros de temperatura y los informes, que antes se apuntaban a mano.",
      "También enseña a qué horas cuesta menos la luz, para aprovecharlas.",
    ],
    tecnico: [
      "Aplicación web adaptable a móvil, tableta y pantalla de pared.",
      "Cada empresa cliente tendrá sus usuarios y sus permisos, y solo verá sus instalaciones.",
    ],
    hoy: "La aplicación está hecha con datos simulados. Las lecturas reales se ven ya en Sistema, Conexiones.",
  },
];

export const PREGUNTAS: Tema[] = [
  {
    id: "marcas",
    titulo: "¿Vale para los equipos que ya tengo?",
    corto: "Sí, sean de la marca que sean. Gradiox tiene una ficha por modelo de controlador que le dice dónde está cada dato.",
    sencillo: [
      "Cada fabricante guarda los datos a su manera, como si cada uno hablase un idioma. La ficha es el diccionario de ese modelo.",
      "Se escribe una vez, a partir del manual del fabricante, y sirve para todos los clientes que tengan ese modelo.",
      "Si llega un modelo nuevo, se escribe su ficha. No hay que cambiar el programa ni los equipos.",
    ],
    tecnico: [
      "La ficha (perfil de equipo) asigna cada señal a su tabla y dirección Modbus, con su tipo, escala y, si se puede escribir, sus límites.",
      "Modbus RTU y TCP primero. Sondas inalámbricas y contadores después. BACnet, CANbus y nubes de fabricante, bajo pedido.",
    ],
    hoy: "El sistema de fichas está hecho. Las primeras fichas de equipos reales se escriben tras la visita a la primera instalación.",
  },
  {
    id: "actuar",
    titulo: "¿Puede cambiar cosas en mi instalación?",
    corto: "Al principio no: solo mira. Más adelante podrá actuar, primero pidiéndote permiso y después solo, dentro de los límites que tú pongas.",
    sencillo: [
      "Primero, solo mira: lee, avisa y deja registro. No puede tocar nada.",
      "Después, actúa si tú dices que sí: propone un cambio, por ejemplo bajar un grado de madrugada, y espera a que alguien lo confirme.",
      "Por último, actúa solo con límites: hace esos cambios por su cuenta, sin salirse nunca de lo que le has permitido.",
    ],
    tecnico: [
      "Tres niveles: 0 lectura, 1 orden con confirmación, 2 automático con límites por equipo.",
      "Toda escritura comprueba el rango permitido y vuelve a leer el valor para confirmar que se ha aplicado.",
    ],
    hoy: "Gradiox está en el primer nivel. La escritura de consigna está probada solo en el banco de pruebas.",
  },
  {
    id: "seguridad",
    titulo: "¿Es seguro?",
    corto: "La pasarela solo habla hacia fuera, cada una con su clave, y los datos de cada empresa están separados de los de las demás.",
    sencillo: [
      "Nadie de fuera puede entrar a la red de la empresa a través de Gradiox, porque la pasarela no acepta llamadas: solo las hace.",
      "Cada empresa ve solo lo suyo. Una empresa no puede ver las cámaras de otra.",
      "Mientras Gradiox solo mira, lo peor que puede pasar si falla es quedarse sin datos un rato. La instalación sigue funcionando igual, con su controlador de siempre.",
    ],
    tecnico: [
      "Conexiones salientes cifradas, clave por pasarela y entrada cerrada por defecto si no hay clave configurada.",
      "El control del frío sigue siendo local: Gradiox no está en el lazo de regulación.",
    ],
    hoy: "Hecho lo primero. La clave por pasarela y la separación por empresa están en el plan, antes del primer piloto.",
  },
];

export const PALABRAS: [string, string][] = [
  ["Servicio", "Cada punto de frío que se vigila: una cámara, un obrador, un muelle."],
  ["Controlador", "El aparato con pantalla que ya tiene cada cámara. Decide cuándo arranca el frío."],
  ["Pasarela", "El aparato de Gradiox que se pone junto a los controladores y lleva sus datos a internet."],
  ["Consigna", "La temperatura que se le pide a la cámara. Por ejemplo, 20 bajo cero."],
  ["Desescarche", "El rato en que la cámara se quita el hielo. La temperatura sube un poco y es normal."],
  ["Compresor", "El motor que produce el frío. Es lo que más luz gasta."],
  ["Ficha de equipo", "El diccionario de un modelo de controlador: dónde tiene cada dato."],
  ["Modbus", "El idioma en el que hablan casi todos los controladores de frío."],
];

export type EstadoConexion = "hecho" | "siguiente" | "despues" | "pedido";
export const ROTULO_CONEXION: Record<EstadoConexion, string> = { hecho: "Funciona en pruebas", siguiente: "Lo siguiente", despues: "Después", pedido: "Bajo pedido" };
export const CHIP_CONEXION: Record<EstadoConexion, string> = { hecho: "correcto", siguiente: "azul", despues: "neutro", pedido: "neutro" };

/** Las formas de conectar con los equipos de un cliente, de la más habitual a la menos. */
export const CONEXIONES: (Tema & { estado: EstadoConexion })[] = [
  {
    id: "modbus-tcp",
    titulo: "Modbus TCP",
    estado: "hecho",
    corto: "El idioma más extendido entre los controladores de frío, por cable de red.",
    sencillo: [
      "Modbus es un idioma muy antiguo y muy sencillo que entienden casi todos los aparatos industriales. Funciona a base de preguntas: «¿qué temperatura tienes?», y el aparato contesta con un número.",
      "«TCP» quiere decir que viaja por un cable de red normal, como el de un ordenador.",
    ],
    tecnico: [
      "Cliente Modbus TCP propio, sin librerías de terceros: lectura de bobinas, entradas discretas, registros de retención y de entrada, y escritura de un registro.",
      "Cada señal se define en la ficha del modelo con su tabla, dirección, tipo y escala.",
    ],
    hoy: "Hecho y probado contra un controlador simulado. Falta probarlo con un controlador real.",
  },
  {
    id: "modbus-rtu",
    titulo: "Modbus RTU",
    estado: "siguiente",
    corto: "El mismo idioma, por el cable de dos hilos que traen la mayoría de los controladores.",
    sencillo: [
      "Es el mismo idioma que el anterior, pero viaja por un cable fino de dos hilos que va saltando de un controlador al siguiente. Es lo que suele haber en una sala de máquinas.",
      "La pasarela se engancha a ese cable y habla con todos los controladores que cuelgan de él, uno por uno.",
    ],
    tecnico: [
      "Bus serie RS-485, un maestro y varios esclavos con su número de unidad. Hay que conocer velocidad, paridad y dirección de cada equipo.",
      "Las fichas de equipo sirven igual para RTU y para TCP: solo cambia el transporte.",
    ],
    hoy: "Sin hacer. Es lo primero tras la visita, porque es lo que se espera encontrar en la instalación.",
  },
  {
    id: "zigbee",
    titulo: "Sondas inalámbricas (Zigbee y similares)",
    estado: "despues",
    corto: "Sensores sin cable, para medir donde no hay controlador o no se puede conectar.",
    sencillo: [
      "Son sensores pequeños a pilas que miden temperatura o si una puerta está abierta, y lo mandan por radio a la pasarela.",
      "Sirven para cámaras antiguas cuyo controlador no se puede leer, o para añadir una segunda medida de comprobación.",
    ],
    tecnico: [
      "Zigbee es una red de radio de bajo consumo en malla. Para naves grandes puede convenir más LoRaWAN, de mayor alcance.",
      "La pasarela necesita una radio compatible; se decide al elegir el modelo de pasarela.",
    ],
    hoy: "Sin hacer. Previsto para después del primer piloto.",
  },
  {
    id: "mbus",
    titulo: "M-Bus",
    estado: "despues",
    corto: "El idioma de los contadores: luz, agua y energía.",
    sencillo: [
      "Los contadores de electricidad, agua o calor suelen hablar M-Bus. Leerlos permite saber cuánta luz gasta de verdad cada parte de la instalación.",
      "Hoy Gradiox estima el gasto con el precio de la luz; con un contador conectado dejaría de ser una estimación.",
    ],
    tecnico: [
      "Bus de dos hilos para lectura de contadores (norma EN 13757), con variante inalámbrica. Muchos contadores eléctricos ofrecen también Modbus.",
    ],
    hoy: "Sin hacer. Entra cuando se mida el consumo real.",
  },
  {
    id: "bacnet",
    titulo: "BACnet",
    estado: "pedido",
    corto: "El idioma de los edificios: climatización y gestión centralizada.",
    sencillo: [
      "Los edificios grandes tienen un sistema que gobierna la climatización, la ventilación y la luz. Ese sistema suele hablar BACnet.",
      "Si un cliente tiene el frío integrado ahí, Gradiox se conecta a ese sistema en lugar de a cada aparato.",
    ],
    tecnico: ["BACnet/IP por red y BACnet MS/TP por RS-485. Los datos se exponen como objetos con propiedades, no como direcciones."],
    hoy: "Sin hacer. Se hará cuando un cliente lo necesite.",
  },
  {
    id: "canbus",
    titulo: "CANbus",
    estado: "pedido",
    corto: "El idioma de las máquinas con motor: compresores con variador y frío de transporte.",
    sencillo: ["Es el idioma que usan los coches por dentro, y también algunas centrales de compresores y los equipos de frío de los camiones."],
    tecnico: ["Bus diferencial con mensajes por identificador; en industria, normalmente CANopen o J1939. Requiere interfaz CAN en la pasarela."],
    hoy: "Sin hacer. Se hará cuando un cliente lo necesite.",
  },
  {
    id: "mqtt",
    titulo: "MQTT",
    estado: "despues",
    corto: "Una forma de mandar mensajes por internet que usan muchos aparatos modernos.",
    sencillo: [
      "No es un idioma de controladores, sino un servicio de mensajería: los aparatos publican sus datos y quien quiere los recibe.",
      "Hay sensores y pasarelas de otros fabricantes que ya envían así sus datos. Gradiox podrá escucharlos sin poner nada más.",
    ],
    tecnico: [
      "Publicación y suscripción sobre una conexión saliente cifrada. Es también el canal previsto para enviar órdenes a la pasarela, porque la mantiene alcanzable sin abrir puertos.",
    ],
    hoy: "Sin hacer. Hoy la pasarela entrega por HTTPS; MQTT llega con las órdenes.",
  },
  {
    id: "apis",
    titulo: "Nubes de los fabricantes",
    estado: "pedido",
    corto: "Cuando los equipos ya envían sus datos a la nube de su marca, Gradiox los recoge de allí.",
    sencillo: [
      "Algunos fabricantes ya tienen su propia aplicación, y sus equipos mandan los datos allí. En ese caso no hace falta pasarela: Gradiox se los pide a esa nube.",
      "Depende de que el fabricante lo permita y de las condiciones que ponga.",
    ],
    tecnico: ["Integración de nube a nube mediante la API del fabricante, con las credenciales del cliente. Cada una es un desarrollo propio."],
    hoy: "Sin hacer. Se estudia caso por caso.",
  },
];
