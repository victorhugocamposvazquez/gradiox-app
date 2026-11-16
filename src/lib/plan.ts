// El plan para llevar Gradiox de la demostración a instalaciones reales.
// Se mantiene a mano: cada vez que se cierra una tarea, se cambia aquí su estado.

export type EstadoPlan = "hecho" | "curso" | "esperando" | "pendiente";
export const ROTULO_PLAN: Record<EstadoPlan, string> = { hecho: "Hecho", curso: "En curso", esperando: "Esperando", pendiente: "Sin empezar" };
export const CHIP_PLAN: Record<EstadoPlan, string> = { hecho: "correcto", curso: "azul", esperando: "aviso", pendiente: "neutro" };

export type Fase = { numero: number; nombre: string; resumen: string; estado: EstadoPlan };
export type Tarea = { texto: string; quien: "Hugo" | "Gradiox"; fase: number; estado: EstadoPlan; nota?: string };

export const ACTUALIZADO = "2026-11-16";
export const DOCUMENTO = "https://claude.ai/artifact/1g7src7fsaTmMKUumyJGMT";

export const FASES: Fase[] = [
  { numero: 0, nombre: "Preparación", resumen: "Plan, visita a una instalación con equipos y elección de la pasarela.", estado: "curso" },
  { numero: 1, nombre: "Banco de pruebas", resumen: "Toda la cadena funcionando con un controlador simulado: equipo, pasarela, nube y pantalla.", estado: "hecho" },
  { numero: 2, nombre: "Piloto en lectura", resumen: "Una pasarela en una instalación real, solo leyendo, sin tocar nada del cliente.", estado: "esperando" },
  { numero: 3, nombre: "Producto en lectura", resumen: "Alta de instalaciones, equipos y usuarios para cualquier empresa, con datos reales en toda la app.", estado: "pendiente" },
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
  { texto: "Controlador simulado que habla Modbus, con pruebas", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "Programa de la pasarela: lee por perfil, guarda sin internet y entrega", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "Nube: entrada de lecturas y guardado en base de datos", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "La app enseña las lecturas reales en Conexiones", quien: "Gradiox", fase: 1, estado: "hecho" },
  { texto: "Crear la base de datos en Vercel y poner la clave de pasarelas", quien: "Hugo", fase: 1, estado: "pendiente", nota: "Sin esto gradiox.com no admite lecturas" },
  { texto: "Enlazar cada equipo real con su Servicio en la app", quien: "Gradiox", fase: 2, estado: "esperando", nota: "Necesita la base de datos" },
  { texto: "Comprar la pasarela del piloto", quien: "Hugo", fase: 2, estado: "pendiente" },
  { texto: "Consultar la normativa de registro de temperaturas con un especialista", quien: "Hugo", fase: 3, estado: "pendiente" },
];

export const DECISIONES: { titulo: string; detalle: string }[] = [
  { titulo: "Pasarela comprada, programa propio", detalle: "Un equipo industrial con marcado CE que se pone junto a los controladores. El programa que lleva dentro es de Gradiox." },
  { titulo: "Una ficha por modelo de equipo", detalle: "Para conectar con cualquier fabricante no se programa para cada cliente: se escribe una ficha con las señales de ese modelo y sirve para todos." },
  { titulo: "Modbus primero", detalle: "Es lo que hablan casi todos los controladores de frío. Sondas inalámbricas y contadores después; el resto, bajo pedido." },
  { titulo: "Primero solo leer", detalle: "Gradiox empieza sin poder cambiar nada en la instalación. Las órdenes llegan después, con confirmación y con límites." },
  { titulo: "La conexión sale siempre de la pasarela", detalle: "No hay que abrir nada en la red del cliente. Si se cae internet, la pasarela guarda las lecturas y las entrega al volver." },
];
