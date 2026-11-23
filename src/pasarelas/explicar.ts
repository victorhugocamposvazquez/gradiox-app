// Por qué una orden no se hizo y qué hacer. Sin dependencias de servidor: lo
// usan el panel (en el navegador) y la puesta en marcha.

import type { Orden } from "./ordenes";

/**
 * Traduce por qué una orden no se hizo a lo que hay que hacer. El motivo lo
 * pone el programa o el panel; aquí se añade el paso siguiente.
 */
export function explicarOrden(o: Pick<Orden, "estado" | "motivo">): { que: string; hacer: string } {
  const m = o.motivo ?? "";
  if (o.estado === "caducada") return { que: "nadie la recogió en 2 minutos.", hacer: "El programa no tenía marcado «Permitir órdenes de Gradiox», estaba cerrado o sin internet. Márcalo en «Conexión» y vuelve a darla." };
  if (/lista que lee este programa/i.test(m)) return { que: "el programa todavía no lee esa variable.", hacer: "Pasa cuando la lista acaba de cambiar o el nombre no es exactamente el del PLC. Comprueba que tenga valor en «Última lectura» y vuelve a darla en un minuto." };
  if (/entre las variables que se pueden cambiar/i.test(m)) return { que: "el programa aún no sabía que se puede cambiar.", hacer: "Recoge los cambios del panel en menos de un minuto: vuelve a darla en un momento." };
  if (/no deja escribir/i.test(m)) return { que: "el PLC no deja escribir esa variable.", hacer: "Hay que abrirla a escritura en el PLC (en TIA Portal, accesible y escribible desde HMI/OPC UA)." };
  if (/fuera de rango|tipo de valor|es un número|es de sí o no/i.test(m)) return { que: `${m.charAt(0).toLowerCase()}${m.slice(1)}.`, hacer: "Revisa el valor y los límites de esa variable." };
  if (/No se llega al PLC/i.test(m)) return { que: "el programa no llegaba al PLC en ese momento.", hacer: "Mira el paso «Conectar con el PLC» y vuelve a darla." };
  if (/tarde/i.test(m)) return { que: "llegó al programa demasiado tarde.", hacer: "El ordenador tiene mala conexión o la hora mal puesta. Vuelve a darla." };
  if (o.estado === "anulada") return { que: m ? `${m.charAt(0).toLowerCase()}${m.slice(1)}.` : "se anuló.", hacer: "" };
  return { que: m ? `${m.charAt(0).toLowerCase()}${m.slice(1)}.` : "sin motivo.", hacer: "" };
}
