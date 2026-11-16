import type { Perfil } from "../perfil";

/**
 * Perfil del controlador simulado del banco de pruebas. No corresponde a
 * ningún fabricante: sirve para probar la cadena completa sin hardware.
 * Los perfiles de equipos reales se escriben a partir de su manual.
 */
export const PERFIL_BANCO: Perfil = {
  id: "banco-camara-v1",
  marca: "Gradiox",
  modelo: "Controlador simulado de cámara",
  origen: "Banco de pruebas. No es un equipo real.",
  senales: {
    temperatura: { tabla: "entrada", direccion: 0, tipo: "int16", escala: 0.1 },
    consigna: { tabla: "retencion", direccion: 0, tipo: "int16", escala: 0.1, escribible: { min: -30, max: 10 } },
    compresor: { tabla: "discreta", direccion: 0, tipo: "bit" },
    puerta: { tabla: "discreta", direccion: 1, tipo: "bit" },
    desescarche: { tabla: "discreta", direccion: 2, tipo: "bit" },
    alarma: { tabla: "discreta", direccion: 3, tipo: "bit" },
  },
};
