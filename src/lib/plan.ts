// El plan para llevar Gradiox de la demostración a instalaciones reales.
// Se mantiene a mano: cada vez que se cierra una tarea, se cambia aquí su estado.

export type EstadoPlan = "hecho" | "curso" | "esperando" | "pendiente";
export const ROTULO_PLAN: Record<EstadoPlan, string> = { hecho: "Hecho", curso: "En curso", esperando: "Esperando", pendiente: "Sin empezar" };
export const CHIP_PLAN: Record<EstadoPlan, string> = { hecho: "correcto", curso: "azul", esperando: "aviso", pendiente: "neutro" };

export type Fase = { numero: number; nombre: string; resumen: string; estado: EstadoPlan };
export type Tarea = { texto: string; quien: "Hugo" | "Gradiox"; fase: number; estado: EstadoPlan; nota?: string };

export const ACTUALIZADO = "2026-11-18";
export const DOCUMENTO = "https://claude.ai/artifact/1g7src7fsaTmMKUumyJGMT";

export const FASES: Fase[] = [
  { numero: 0, nombre: "Preparación", resumen: "Plan, visita a una instalación con equipos y elección de la pasarela.", estado: "curso" },
  { numero: 1, nombre: "Banco de pruebas", resumen: "Toda la cadena funcionando con un controlador simulado: equipo, pasarela, nube y pantalla.", estado: "hecho" },
  { numero: 2, nombre: "Piloto en lectura", resumen: "Una pasarela en una instalación real, solo leyendo, sin tocar nada del cliente.", estado: "esperando" },
  { numero: 3, nombre: "Producto en lectura", resumen: "Gradiox como servicio para muchas empresas: cada cliente con sus usuarios, instalaciones y ajustes, y sus datos separados de los demás.", estado: "pendiente" },
  { numero: 4, nombre: "Órdenes", resumen: "Cambiar consignas y programar desescarches desde Gradiox, siempre con confirmación y con límites.", estado: "pendiente" },
  { numero: 5, nombre: "Más cobertura", resumen: "Más marcas y más formas de conectar: sondas inalámbricas, contadores y otros protocolos bajo pedido.", estado: "pendiente" },
  { numero: 6, nombre: "Automático y venta", resumen: "Gradiox actúa solo dentro de los límites que fija el cliente. Precios, contrato y soporte.", estado: "pendiente" },
];

export const TAREAS: Tarea[] = [
  { texto: "Plan de integración y guía para la visita", quien: "Gradiox", fase: 0, estado: "hecho" },
  { texto: "Visita al colaborador con la guía: fotos, notas y respuestas", quien: "Hugo", fase: 0, estado: "pendiente", nota: "Miércoles 18 de noviembre" },
  { texto: "Preguntar al colaborador si permite una pasarela en solo lectura", quien: "Hugo", fase: 0, estado: "pendiente" },
  { texto: "Identificar modelos, buscar manuales y escribir los primeros perfiles de equipo", quien: "Gradiox", fase: 0, estado: "esperando", nota: "Con las fotos de la visita" },
  { texto: "Elegir el modelo de pasarela y calcular su coste", quien: "Gradiox", fase: 0, estado: "esperando", nota: "Depende de los equipos que haya" },
  { texto: "Contrastar la tabla de fabricantes con sus manuales", quien: "Gradiox", fase: 0, estado: "esperando" },
  { texto: "Pedir al colaborador los datos de su autómata: modelo y versión, si tiene OPC UA activado y con licencia, lista de variables y quién lo programa", quien: "Hugo", fase: 0, estado: "curso", nota: "Dicho el 17 de noviembre: Siemens S7-1500 con Profinet y OPC UA; se puede enchufar un aparato a su red, hay internet, OPC UA ya está activado y lo programa un compañero del cliente. Falta: CPU exacta y lista de variables" },
  { texto: "Pedir al programador del autómata un usuario de solo lectura, la lista de variables de frío y la dirección del autómata en la red", quien: "Hugo", fase: 0, estado: "pendiente", nota: "La contraseña no se manda por el chat" },
  { texto: "Conector OPC UA en la pasarela, probado con un autómata simulado", quien: "Gradiox", fase: 1, estado: "hecho", nota: "Programa de prueba para Mac y Windows, solo lectura. Se da de alta y se vigila en el panel interno, en Pasarelas" },
  { texto: "Controlador simulado que habla Modbus, con pruebas", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "Programa de la pasarela: lee por perfil, guarda sin internet y entrega", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "Nube: entrada de lecturas y guardado en base de datos", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "La app enseña las lecturas reales en Conexiones", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "Avisos y consumo esperado desde el primer día, sin semanas de aprendizaje: cuenta física por cámara, huella medida en sus ciclos, prueba de arranque de una hora y perfiles compartidos", quien: "Gradiox", fase: 1, estado: "hecho", nota: "En simulado, sobre la nave de demostración. Se ve en el panel interno, en Arranque, con la medida de cuánto acierta" },
  { texto: "Primera actuación para ahorrar: consignas por tarifa en cada cámara (punta, llana y valle), con el ahorro previsto en euros, aplicar con doble llave, deshacer, vuelta atrás sola en el límite y medida del ahorro de verdad", quien: "Gradiox", fase: 1, estado: "hecho", nota: "En el panel interno, en Actuación. Probado contra el PLC simulado, que desde la versión 0.4.0 se comporta como una cámara" },
  { texto: "Confirmar con RGV qué hacen exactamente las consignas Hora_punta_ac, Hora_llana_ac y Hora_valle_ac del autómata y a qué horas cambia de tramo", quien: "Hugo", fase: 2, estado: "pendiente", nota: "La actuación da por hecho que son la temperatura a la que arranca el frío en cada tramo. Hay que oírselo a Antonio antes de escribir en un PLC de verdad" },
  { texto: "Factura eléctrica del primer cliente: horas de cada tramo y precio del kWh", quien: "Hugo", fase: 2, estado: "pendiente", nota: "Los euros de Actuación salen de una tarifa de partida hasta que se ponga la suya" },
  { texto: "Crear la base de datos en Supabase y poner en Vercel su conexión y la clave de pasarelas", quien: "Hugo", fase: 1, estado: "pendiente", nota: "Sin esto gradiox.com no admite lecturas" },
  { texto: "Poner en Vercel el permiso de GitHub para activar las tareas", quien: "Hugo", fase: 1, estado: "pendiente", nota: "Sin esto la pantalla de Tareas no guarda" },
  { texto: "Llevar el arranque sin espera a una instalación real: ficha, huella y predicciones en la base de datos, lecturas de la pasarela y prueba de arranque por el camino de órdenes con doble llave", quien: "Gradiox", fase: 2, estado: "esperando", nota: "Necesita la base de datos y la primera instalación leyendo" },
  { texto: "Enlazar cada equipo real con su Servicio en la app", quien: "Gradiox", fase: 2, estado: "esperando", nota: "Necesita la base de datos" },
  { texto: "Comprar la pasarela del piloto", quien: "Hugo", fase: 2, estado: "pendiente" },
  { texto: "Separar los datos por cliente y dar a cada pasarela su propia clave", quien: "Gradiox", fase: 2, estado: "pendiente", nota: "Antes del primer piloto" },
  { texto: "Diseño de los datos: empresas, usuarios, instalaciones y pasarelas", quien: "Gradiox", fase: 3, estado: "curso" },
  { texto: "Cuentas de cliente: usuarios, instalaciones y ajustes propios de cada empresa", quien: "Gradiox", fase: 3, estado: "pendiente" },
  { texto: "Zona interna de clientes: alta, ficha, instalaciones, puntos de frío y fotos de la visita", quien: "Gradiox", fase: 3, estado: "hecho", nota: "Guarda de verdad cuando esté conectada la base de datos" },
  { texto: "Panel interno aparte de la app, con entrada y usuario propios", quien: "Gradiox", fase: 3, estado: "hecho" },
  { texto: "Control de cada instalación: fase, aparato, si está leyendo, próximo paso y registro", quien: "Gradiox", fase: 3, estado: "hecho" },
  { texto: "Ficha técnica de cada instalación: qué hay, cómo se conecta, señales, documentos y qué falta", quien: "Gradiox", fase: 3, estado: "hecho" },
  { texto: "Poner en Vercel el usuario y la contraseña del panel interno", quien: "Hugo", fase: 3, estado: "pendiente", nota: "Sin esto el panel queda cerrado" },
  { texto: "Panel interno, lo que falta: usuarios de cada cliente, clave propia de cada aparato y ajustes por cliente", quien: "Gradiox", fase: 3, estado: "pendiente", nota: "Necesita la base de datos" },
  { texto: "Soporte: ver la app como la ve un cliente, dejando constancia", quien: "Gradiox", fase: 3, estado: "pendiente" },
  { texto: "Consultar la normativa de registro de temperaturas con un especialista", quien: "Hugo", fase: 3, estado: "pendiente" },
];

export const DECISIONES: { titulo: string; detalle: string }[] = [
  { titulo: "Pasarela propia y siempre la misma", detalle: "Gradiox pone en cada instalación su propio aparato, el mismo modelo en todos los clientes, con su programa dentro. Así es fácil de instalar, de actualizar y de sustituir. No se usa el ordenador del cliente." },
  { titulo: "Una ficha por modelo de equipo", detalle: "Para conectar con cualquier fabricante no se programa para cada cliente: se escribe una ficha con las señales de ese modelo y sirve para todos. Con autómata, la ficha es la lista de variables de esa instalación." },
  { titulo: "Dos vías de conexión: OPC UA y Modbus", detalle: "Si la instalación la gobierna un autómata, Gradiox lee de él con OPC UA por la red de la planta. Si hay controladores sueltos, lee de cada uno con Modbus. Sondas inalámbricas y contadores después; el resto, bajo pedido." },
  { titulo: "Primero solo leer", detalle: "Gradiox empieza sin poder cambiar nada en la instalación. Las órdenes llegan después, con confirmación y con límites." },
  { titulo: "Un servicio para muchas empresas", detalle: "Cada cliente tiene su espacio aparte y sus propios ajustes. El programa es el mismo para todos." },
  { titulo: "La conexión sale siempre de la pasarela", detalle: "No hay que abrir nada en la red del cliente. Si se cae internet, la pasarela guarda las lecturas y las entrega al volver." },
];
