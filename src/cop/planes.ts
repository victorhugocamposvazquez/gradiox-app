// Los planes de una instalación: lo que Gradiox hace por su cuenta en ella, vigilar o
// ajustar. Es la pestaña «Planes» de cada instalación en ops. Aquí solo los que ya
// existen o se pueden construir con lo diseñado en docs/rendimiento.md; el catálogo
// completo y su porqué están en el documento «Zonas y planes». Al construir uno,
// cambia aquí su estado y su «hoy» en src/cop/automatizacion.ts en el mismo PR.

export type ClasePlan = "vigila" | "ajusta";
export type EstadoPlan = "simulado" | "pendiente";

export interface Plan {
  id: string;
  nombre: string;
  clase: ClasePlan;
  /** Qué hace, en una frase para quien no es del sector. */
  que: string;
  /** Qué hace falta para que funcione en esta instalación. */
  necesita: string;
  estado: EstadoPlan;
}

export const ROTULO_CLASE: Record<ClasePlan, string> = { vigila: "Vigila", ajusta: "Ajusta" };
export const ROTULO_ESTADO_PLAN: Record<EstadoPlan, string> = { simulado: "Probado en simulado", pendiente: "Sin programar" };

export const PLANES: Plan[] = [
  {
    id: "tarifa",
    nombre: "Consignas por tarifa",
    clase: "ajusta",
    que: "Enfría un poco más cuando la luz es barata y deja subir un poco la temperatura cuando es cara, sin salir de los límites de cada cámara.",
    necesita: "Saber qué hacen las consignas de tarifa del autómata y la factura de la luz del cliente.",
    estado: "simulado",
  },
  {
    id: "condensacion",
    nombre: "Condensación flotante",
    clase: "ajusta",
    que: "Baja la presión de condensación cuando fuera hace fresco: los compresores trabajan menos para el mismo frío.",
    necesita: "Sonda exterior, analizador de red del frío y que el autómata acepte esa consigna desde Gradiox.",
    estado: "pendiente",
  },
  {
    id: "aspiracion",
    nombre: "Aspiración flotante",
    clase: "ajusta",
    que: "Sube la presión de aspiración cuando las cámaras van holgadas de frío.",
    necesita: "Analizador de red del frío y las temperaturas de todas las cámaras.",
    estado: "pendiente",
  },
  {
    id: "consumo",
    nombre: "Compresor que gasta más que antes",
    clase: "vigila",
    que: "Avisa cuando un compresor necesita más electricidad que en sus primeros días para el mismo trabajo: suele ser una avería que empieza.",
    necesita: "Lo que gasta cada compresor (analizador o intensidad) y sus presiones.",
    estado: "pendiente",
  },
  {
    id: "marcha",
    nombre: "Arranques y horas de marcha",
    clase: "vigila",
    que: "Cuenta cuántas veces arranca cada máquina y cuántas horas lleva, para adelantar el mantenimiento.",
    necesita: "Que se lea si cada compresor está en marcha.",
    estado: "pendiente",
  },
];
