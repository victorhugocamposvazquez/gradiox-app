// Punto de entrada del programa de pasarela. Se empaqueta con
// `npm run pasarela` en dist/gradiox-pasarela.mjs y se ejecuta con Node:
//
//   GRADIOX_PASARELA_CLAVE=… node gradiox-pasarela.mjs configuracion.json [--simulado]

import { readFileSync } from "node:fs";
import { arrancarPrograma, leerConfiguracion } from "../src/conexion/programa";

const registrar = (linea: string) => console.log(`${new Date().toISOString()} ${linea}`);

async function principal() {
  const args = process.argv.slice(2);
  const archivo = args.find((a) => !a.startsWith("--"));
  if (!archivo) throw new Error("Falta el archivo de configuración. Uso: node gradiox-pasarela.mjs configuracion.json [--simulado]");
  const clave = process.env.GRADIOX_PASARELA_CLAVE;
  if (!clave) throw new Error("Falta la clave de pasarela en la variable GRADIOX_PASARELA_CLAVE");
  let contenido: string;
  try {
    contenido = readFileSync(archivo, "utf8");
  } catch {
    throw new Error(`No se puede leer ${archivo}`);
  }
  const config = leerConfiguracion(contenido);
  registrar(`Pasarela «${config.pasarela}» entregando en ${config.nube}`);
  const programa = await arrancarPrograma(config, { clave, simulado: args.includes("--simulado"), registrar });
  const parar = () => void programa.parar().then(() => process.exit(0));
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
