# Gradiox

Control de cámaras frigoríficas. **Demostración con datos simulados**: no hay ningún autómata ni instalación conectada.

## Qué hace

- **Servicios**: así se llama aquí a cada punto de frío (cámara, antecámara, túnel, mueble). Estado de cada uno, en cuadrícula o en lista, con los que tienen problemas primero (temperatura, consigna, compresor, puerta, desescarche) y su histórico de 24 horas.
- **Avisos**: alarmas y avisos de las últimas 24 horas, que se pueden marcar como atendidas y pasar al libro de mantenimiento.
- **Fallos típicos**: lista que se amplía a mano con lo que suele fallar, por qué señal se reconoce, qué revisar y qué orden se le daría al autómata; con el histórico de 7 días de cuántas veces se repite cada uno.
- **Registro de temperaturas**: mínima, máxima y media de cada día, tiempo por encima del límite, descarga en CSV e impresión.
- **Conexiones**: estado de la pasarela y de cada autómata, última lectura y qué señales llegan de cada servicio. Si se corta la conexión, los servicios afectados pasan a «sin datos» con la última lectura en gris, y queda apuntado en avisos y en el registro.
- **Luz**: precio por horas y un plan que enfría de más en las horas baratas y afloja en las caras.
- **Mantenimiento**: próximas revisiones de cada equipo y libro de intervenciones.

Con una alarma, la ficha dice cuánto falta para llegar al límite del género y qué hacer. También enseña el consumo del día y la marcha del compresor.

En la ficha de cada servicio se puede provocar una avería para ver cómo reacciona el programa.

## Qué es simulado

- Las lecturas salen de `src/lib/sim.ts`: una función del instante, sin estado.
- El precio de la luz sale de `src/lib/luz.ts`: una curva inventada, no la de Red Eléctrica.
- Las potencias, los plazos de revisión y el ahorro estimado son valores de ejemplo.
- El consumo se calcula con la potencia nominal y el tiempo de marcha (`src/lib/analisis.ts`), no con un contador.
- Las órdenes al autómata de los fallos típicos (`src/lib/fallos.ts`) solo se muestran: no cambian nada.
- Lo que se cambia (consignas, averías, plan, intervenciones) se guarda solo en el navegador.

## Arrancar

```
npm install
npm run dev      # http://127.0.0.1:3000
npm run check    # tipos, pruebas y compilación
```

## Acceso

Toda la app pide usuario y contraseña. Se configuran en el servidor con dos variables de entorno; sin ellas la pantalla de entrada avisa de que falta configurarlo y no deja pasar.

```
GRADIOX_USUARIO=...
GRADIOX_CLAVE=...
```

En local van en `.env.local` (no se sube al repositorio). En Vercel, en Settings, Environment Variables. Es un único usuario compartido, sin base de datos: la sesión dura 7 días y cambiar la contraseña cierra todas las sesiones (`src/lib/sesion.ts`, `src/proxy.ts`).

## Marca

Logotipo «gradi°x» en Outfit seminegra; la o es un anillo azul (`src/components/marca.tsx`). Colores y letra en `src/app/globals.css` (variables `--gx-*`).

## Notificaciones

- `/notificaciones` guarda lo que va pasando (alarmas, cortes de conexión, fallos típicos, avisos y vueltas a la normalidad) y deja elegir qué interrumpe.
- `src/lib/notificaciones.ts` compara dos «fotos» de la instalación y saca las novedades. `src/components/vigia.tsx` lo hace en cada tic y enseña el aviso emergente.
- Con permiso del navegador, también salen como notificación del sistema cuando Gradiox está en segundo plano (`public/sw.js`).
- Límite actual: vigila el navegador, no un servidor. Con la app cerrada del todo no llega nada. El oyente `push` del trabajador de servicio está preparado para cuando haya servidor.
- `src/app/manifest.ts` permite instalar Gradiox en el móvil; en iPhone hace falta para las notificaciones.

## Inicio, naves e informe

- `/` es **Hoy**: estado general, cifras, qué toca hoy y accesos. Servicios está en `/servicios`.
- **Demostración guiada** (`src/components/guion.tsx`): desde Hoy, recorre una avería de compresor de principio a fin.
- `/naves`: lista de instalaciones con cuadrícula y lista. Solo la primera tiene detalle; las demás son ejemplos (`src/lib/naves.ts`).
- `/informe`: informe del día, pensado para imprimir o guardar en PDF.

## Órdenes, guardias y luz

- Los fallos típicos con orden se pueden enviar a mano desde la ficha o dejar en automático. La orden actúa en la simulación (rearme, avisador, consigna 2 °C más baja, desescarche extra) y queda apuntada.
- Guardias (`src/lib/guardias.ts`, pestaña en Notificaciones): a quién se avisa y cuándo pasa al siguiente. Simulado: no se envía nada.
- Precio de la luz: `/api/precio` pide el PVPC de hoy a los datos públicos de Red Eléctrica. Si falla, la app usa el precio simulado y lo indica.

## Tema oscuro

`data-theme="dark"` en `<html>`. Lo pone el botón de tema (se guarda en `gradiox-tema`) o, la primera vez, la preferencia del sistema. Al imprimir siempre sale en claro.

## Fuente de datos

Las pantallas y los cálculos leen de `src/lib/datos.ts`, nunca de `sim.ts` directamente. Para conectar datos reales se da otra fuente con `usarFuente`.

## Pruebas

- `npm run check`: tipos, pruebas de cálculo y compilación.
- `npm run e2e`: pruebas de pantalla con Playwright en 390, 768 y 1280 px y en los dos temas. Compila y arranca la app sola. Si el Chromium de Playwright no está instalado: `npx playwright install chromium`, o `CHROMIUM_PATH=/ruta/a/chromium npm run e2e`.
