import type { Perfil } from "../perfil";
import { PERFIL_BANCO } from "./banco";

/** Todos los perfiles de equipo que conoce Gradiox, por su identificador. */
export const PERFILES: Record<string, Perfil> = { [PERFIL_BANCO.id]: PERFIL_BANCO };
