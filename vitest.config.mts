import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Las mismas rutas cortas que Next (@/… es src/…), para poder probar las rutas de la API.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
