import { defineConfig } from "@playwright/test";

// Pruebas de pantalla: abren la app de verdad en móvil, tableta y escritorio.
// `npm run e2e`. Si el Chromium de Playwright no está instalado, se puede dar
// otro con CHROMIUM_PATH.
const PUERTO = 3031;

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "movil", use: { viewport: { width: 390, height: 844 } } },
    { name: "tableta", use: { viewport: { width: 768, height: 1024 } } },
    { name: "escritorio", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/login`,
    timeout: 180_000,
    reuseExistingServer: true,
    env: { GRADIOX_USUARIO: "prueba", GRADIOX_CLAVE: "clave-de-prueba-e2e" },
  },
});
