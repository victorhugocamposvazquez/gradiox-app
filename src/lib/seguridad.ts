// Lo que se cuenta a los clientes sobre la seguridad de Gradiox y sobre lo que
// hace la app. Solo se escribe aquí lo que está hecho; lo que está en
// preparación va aparte y dicho como tal. Al cambiar una medida en el código,
// se cambia aquí en el mismo cambio.

export type Medida = { titulo: string; texto: string };
export type Bloque = { id: string; titulo: string; resumen: string; medidas: Medida[] };

export const SEGURIDAD: Bloque[] = [
  {
    id: "planta",
    titulo: "En tu planta: la pasarela",
    resumen: "El programa de Gradiox que lee tu autómata está pensado para que por él no pueda entrar nadie.",
    medidas: [
      { titulo: "Solo llama hacia fuera", texto: "La pasarela abre ella la conexión con Gradiox, como cuando tú abres una página web. No hay que abrir puertos en tu red ni dar acceso remoto: desde internet no se puede llegar a la pasarela ni, por ella, a tu autómata." },
      { titulo: "Por defecto solo lee", texto: "Gradiox lee temperaturas, consignas, estados y alarmas. No puede cambiar nada en el autómata mientras no se active expresamente." },
      { titulo: "Las órdenes llevan doble llave", texto: "Para que Gradiox pueda escribir (por ejemplo una consigna) hay que activarlo en dos sitios: en Gradiox y en el propio programa de tu planta. Y solo sobre las variables elegidas una a una, cada una con sus límites. Si alguien entrara en Gradiox, sin la llave de tu planta no podría dar ninguna orden." },
      { titulo: "Cada instalación tiene su propia llave", texto: "La pasarela se identifica con una clave única de esa instalación, que solo sirve para entregar sus lecturas. Gradiox no guarda la clave, solo su huella. Caduca sola y se puede anular al momento si un ordenador se pierde o se cambia." },
      { titulo: "Sigue funcionando sin internet", texto: "Si se cae la conexión, la pasarela sigue leyendo el autómata y guarda las lecturas en el ordenador de la planta. Cuando vuelve internet las entrega en orden: el histórico no pierde nada. Y tu instalación no depende de Gradiox para enfriar: el autómata sigue gobernando igual, con o sin nosotros." },
      { titulo: "Actualizaciones firmadas", texto: "El programa se actualiza solo, pero antes de instalar nada comprueba la firma de Gradiox. Una actualización que no venga firmada por nosotros se descarta." },
      { titulo: "Conexión cifrada", texto: "Todo lo que viaja entre tu planta y Gradiox va cifrado (HTTPS), igual que la banca por internet." },
    ],
  },
  {
    id: "cuenta",
    titulo: "Tu cuenta y tus usuarios",
    resumen: "Cada persona entra con su usuario y solo ve lo de su empresa.",
    medidas: [
      { titulo: "Solo ves lo tuyo", texto: "Cada usuario pertenece a una empresa y solo recibe las instalaciones de esa empresa. Se comprueba en el servidor en cada consulta, no en la pantalla: las instalaciones de otros clientes no llegan a tu navegador." },
      { titulo: "Las contraseñas no se guardan", texto: "Gradiox guarda solo una huella de cada contraseña, con la que no se puede reconstruir. Ni nosotros podemos verla: si se pierde, se crea otra." },
      { titulo: "Freno a quien prueba contraseñas", texto: "Cada intento fallido se retrasa, y tras ocho fallos seguidos con un usuario, ese usuario queda cerrado quince minutos." },
      { titulo: "Cerrar sesiones al momento", texto: "Al cambiar tu contraseña se cierran tus sesiones en los demás aparatos. Si alguien deja la empresa, se le desactiva y pierde el acceso en ese instante, aunque tuviera la app abierta." },
      { titulo: "Sesión protegida", texto: "La sesión va en una galleta firmada que el navegador solo envía por conexión cifrada y que los programas de la página no pueden leer. Caduca sola a los siete días." },
      { titulo: "Gradiox no se puede incrustar en otra web", texto: "El navegador tiene prohibido enseñar Gradiox dentro de otra página, para que nadie pueda montar una pantalla falsa encima de la de verdad." },
    ],
  },
  {
    id: "gradiox",
    titulo: "Dentro de Gradiox",
    resumen: "Quién de nosotros puede ver tus datos, y cómo queda constancia.",
    medidas: [
      { titulo: "El panel interno va aparte", texto: "La gestión de clientes está en un panel separado de la app, con su propia entrada. Entrar en la app no da paso al panel, ni al revés." },
      { titulo: "Las visitas de soporte quedan apuntadas", texto: "Si soporte necesita ver tu app para ayudarte, entra desde el panel con un motivo escrito, durante una hora como mucho y sin poder cambiar nada. Cada visita queda registrada y la ves más abajo en esta página." },
      { titulo: "Todo lo que se ordena queda en el histórico", texto: "Cada orden enviada a un autómata se guarda con su hora, su valor y quién la dio, junto a las lecturas. No se puede borrar desde la app." },
      { titulo: "Base de datos cerrada", texto: "Las lecturas y los datos de cada cliente están en una base de datos en la que solo entra el servidor de Gradiox, por conexión cifrada. El acceso público que trae la base de datos de serie está cerrado en todas las tablas: desde un navegador no se puede leer nada." },
      { titulo: "Sin contraseñas de tu instalación", texto: "En la ficha técnica de tu instalación no guardamos contraseñas de tus equipos: solo apuntamos si el acceso está pedido o creado." },
    ],
  },
];

/** Lo que todavía no está: se dice tal cual. */
export const EN_PREPARACION: Medida[] = [
  { titulo: "Segundo paso al entrar", texto: "Un código en el móvil además de la contraseña, para los usuarios que lo quieran y obligatorio para el equipo de Gradiox." },
  { titulo: "Aviso de entradas nuevas", texto: "Un correo cuando alguien entra con tu usuario desde un aparato que no habías usado." },
  { titulo: "Registro de accesos a tu vista", texto: "La lista de quién de tu empresa ha entrado y cuándo, visible para el responsable de la cuenta." },
  { titulo: "Revisión de seguridad externa", texto: "Una auditoría hecha por una empresa independiente antes de conectar la primera instalación real con órdenes activas." },
];

export type Funcion = { titulo: string; texto: string; donde?: string; estado: "real" | "ejemplo" };

/** Qué hace Gradiox hoy. «real»: funciona con tu instalación conectada. «ejemplo»: se enseña con datos simulados y todavía no usa los tuyos. */
export const FUNCIONES: Funcion[] = [
  { titulo: "Hoy", texto: "De un vistazo: si todo está en orden, qué cámara pide atención y qué toca mirar, con las lecturas de tu pasarela.", donde: "/", estado: "real" },
  { titulo: "Servicios", texto: "Cada cámara y túnel con su temperatura, su consigna, si está enfriando o en desescarche y su curva de la última hora.", donde: "/servicios", estado: "real" },
  { titulo: "Históricos", texto: "Todo lo leído y todo lo ordenado, guardado con su hora: para ver qué pasó, cuándo y qué se hizo.", donde: "/historicos", estado: "real" },
  { titulo: "Conexiones", texto: "El esquema de tu instalación: la pasarela, el autómata y cada servicio, y dónde se corta si algo deja de llegar.", donde: "/conexiones", estado: "real" },
  { titulo: "Cómo funciona aquí", texto: "El recorrido de tus datos, del autómata a tu pantalla, con lo que hay configurado en tu instalación.", donde: "/como-funciona", estado: "real" },
  { titulo: "Usuarios de tu empresa", texto: "Cada persona con su usuario, su contraseña y su menú para cambiarla o pedir otra.", estado: "real" },
  { titulo: "Avisos", texto: "Las alarmas abiertas, quién las atiende y cómo se cerraron. En Hoy y Servicios ya se marca en rojo lo que se sale de sus límites; la pantalla de Avisos y los avisos al móvil aún no usan tu instalación.", donde: "/avisos", estado: "ejemplo" },
  { titulo: "Luz", texto: "Cuánto gasta el frío y cómo mover consumo a las horas baratas ajustando consignas dentro de los límites de cada cámara.", donde: "/luz", estado: "ejemplo" },
  { titulo: "Turno y ronda", texto: "El relevo entre turnos y los puntos que se revisan a mano.", donde: "/turno", estado: "ejemplo" },
  { titulo: "Mantenimiento", texto: "Las revisiones de cada equipo, con su fecha y lo que se hizo.", donde: "/mantenimiento", estado: "ejemplo" },
  { titulo: "Recepción de mercancía", texto: "La temperatura con la que entra el género, apuntada al recibirlo.", donde: "/recepcion", estado: "ejemplo" },
  { titulo: "Registro e informe", texto: "El registro de temperaturas para inspección y el resumen mensual, servicio a servicio.", donde: "/registro", estado: "ejemplo" },
];
