# Gradiox · notas para Claude Code

Lee también `AGENTS.md` (esta versión de Next.js no es la que conoces) y, para saber qué hace cada parte, `README.md` y `pasarela-opcua/README.md`. Aquí solo va lo que no se deduce del código.

## Qué es

Telegestión de cámaras frigoríficas. Tres piezas en este repositorio:

- **La app del cliente** (`src/app/**` salvo `ops/` y `api/ops/`): lo que ve quien lleva la instalación. Datos simulados salvo donde se dice.
- **El panel interno** (`src/app/ops/**`, `src/app/api/ops/**`): solo para Gradiox. Clientes, pasarelas, históricos, actuación, plan. Tiene su propia sesión.
- **La pasarela** (`pasarela-opcua/`, en Go): el programa que se instala en la planta, lee el autómata por OPC UA y entrega a la nube.

`main` se despliega solo en gradiox.com. **El repositorio es público**: nada de contraseñas, tokens, claves de firma ni datos de clientes en el código, en las pruebas ni en los mensajes de commit.

## Cómo quiere Hugo que se trabaje

- Escribe en español: código, comentarios, commits y textos de pantalla. Nombres de variables y funciones también.
- Claude lleva el proyecto entero y se adelanta. Hugo no es del sector del frío: no le pidas que traiga él la información técnica si se puede averiguar o proponer.
- Reglas y cuentas antes que IA. No se mete IA «por meter».
- Cada afirmación va con cómo se ha comprobado. Lo que solo está probado en simulado se dice así, sin adornar.
- No se inventan cifras. Si un número es de partida (tarifa, potencias, ahorro), la pantalla lo dice.
- Documentación dentro del panel, clara y para quien no sabe, con el paso siguiente a la vista.

## Lo que no se hace nunca sin que Hugo lo diga

- **Base de datos**: no se ejecuta la CLI de Supabase ni migraciones. Las tablas se crean solas desde el código con `create table if not exists` y seguridad por filas (ver `TABLAS_PASARELAS` en `src/pasarelas/almacen.ts`). Una tabla nueva sigue ese mismo patrón.
- **Escribir en un autómata de verdad**: las órdenes están probadas solo contra el PLC simulado. Nada que escriba en una planta real sin su visto bueno expreso.
- **La clave de firma de la pasarela** vive fuera del repositorio. No se copia aquí ni se pega en ningún sitio.
- Usuario y contraseña del PLC de un cliente no pasan por el chat ni por el código.

## Antes de dar algo por hecho

```
npm run check          # tipos, pruebas y compilación
cd pasarela-opcua && go vet ./... && go test ./...   # si se tocó la pasarela
```

- Si falla una prueba, se arregla la causa. No se salta ni se desactiva.
- Pantallas: mirarlas a 390, 768 y 1280 px y en los dos temas (`data-theme="light"` y `"dark"`), sin desplazamiento horizontal. `npm run e2e` lo hace para las principales.
- Las pruebas de los almacenes solo usan Postgres si `GRADIOX_PRUEBA_BASE_URL` apunta a una base de pruebas (nunca una real); sin ella esa parte se salta y lo demás pasa en memoria.

## Código

- **Importaciones**: dentro de `src/app/` y `src/components/` se usa `@/…`. En el resto de `src/` (`actua`, `pasarelas`, `clientes`, `historicos`, `huella`, `conexion`…) y en `tests/` se usan rutas relativas: Vitest no resuelve `@/`.
- **La lógica va fuera de las rutas**. Cada área tiene su modelo y su servicio en `src/<área>/` (funciones puras, con el reloj como parámetro) y la ruta de `src/app/api/` solo los llama. Así se prueba sin levantar el servidor.
- **Almacenes**: cada uno tiene versión en memoria y en Postgres con la misma interfaz. Un método nuevo se añade a las dos y se prueba con las dos.
- **Fallos para la persona**: en el panel se lanzan `ErrorClientes` con una frase que diga qué pasa y qué hacer. `conPasarelas` y `conClientes` los convierten en respuesta.
- Comentarios: el porqué, en una o dos frases, encima de lo que no es evidente.

## Interfaz

- **Sistema nuevo (desde el 23 nov 2026, decisión de Hugo):** shadcn/ui con Tailwind, al estilo sobrio de Linear. Las piezas viven en `src/components/ui/` (se copian de shadcn y se adaptan; no se escriben a mano), los colores en escalas `--gx-n-*` de `src/app/ui.css`, en claro y oscuro. Se migra pantalla a pantalla, empezando por ops: lo nuevo se hace con estas piezas y clases de Tailwind; Tailwind solo mira las carpetas que lista `@source` en `ui.css` (añade la tuya). Sin el «preflight» de Tailwind: un borde sin color dentro de ops toma el de la escala; fuera, pon `border-border`.
- Pantallas antiguas: variables `--gx-*` y clases `gx-*` de `src/app/globals.css` hasta que se migren. Dentro de ops y de la app del cliente (todo lo que cuelga de un armazón con la clase `gx-nuevo`), `src/app/ops-puente.css` las viste con los colores y formas nuevos para que no se mezclen dos estilos; al migrar una pantalla, borra lo que solo usaba ella. La entrada, la web pública, la pantalla de pared y la ficha del técnico quedan fuera. Antes de crear una clase, busca si ya hay una que sirva (`gx-tarjeta`, `gx-pila`, `gx-fila`, `gx-chip`, `gx-datos-cifras`, `gx-tabla`…).
- **Palabras (decisión de Hugo, 24 nov 2026):** tres niveles, una palabra cada uno. **Cliente** = la empresa. **Instalación** = un sitio con frío (nave, tienda, supermercado, restaurante, almacén…; es la palabra del sector y del RSIF); un sitio con dos centrales son dos instalaciones. **Servicios** = las cámaras y puntos de frío. Nunca «nave» en pantalla. La pasarela con su token y sus lecturas es la **conexión** de una instalación: no llamarla instalación, para que no haya dos cosas con el mismo nombre. En el código siguen los nombres viejos (`nave`, `NAVES`, `PESTANAS_NAVE`, `nombreNave`, `/ops/instalaciones` para las conexiones); solo cambia el texto.
- Ops se ordena Cliente → Instalación. Una instalación de la ficha del cliente (`Instalacion`) tiene su página (`/ops/clientes/<id>/instalaciones/<id>`; la antigua `/naves/` redirige) con todo lo suyo en pestañas (`PESTANAS_NAVE`): cámaras y visita, ficha técnica, conexión y, una vez conectada, lecturas, órdenes, históricos, datos guardados, ahorro y ajustes. La conexión es la pasarela con `cliente` y `ubicacion` = la instalación; se crea desde la propia instalación. Algo nuevo de una instalación va en una pestaña suya, no en un menú aparte. `/ops/instalaciones/<id>` (la conexión) y `/ops/clientes/<id>/tecnica` llevan a la instalación cuando la hay. La ficha del cliente tiene cinco pestañas (`src/clientes/pestanas.ts`: resumen, datos, instalaciones, app, historial); los `?paso=` antiguos se traducen con `pestanaPedida`.
- Móvil como app: arriba ☰ y la marca a la izquierda, el usuario a la derecha; en pantallas apiladas, `BarraMovil`/`BarraApp` (`src/components/ops/movil.tsx`) con la flecha sola (vuelve a la pantalla de antes; si se entró por enlace, sube un nivel) y dónde se está: nombre y, debajo, la parte. Los procesos guiados (alta de cliente) van en pantalla propia, sin nada de otros clientes alrededor, y dicen arriba qué se está haciendo.
- Estilo: compacto y sobrio, tipo Stripe. Letra Onest; el logotipo va en Outfit y siempre con `src/components/marca.tsx`, nunca una imagen.
- Nada nuevo por debajo de 12 px. Una acción principal por pantalla. Los estados vacíos dicen cuál es el primer paso.
- Menú de la app del cliente (`src/components/armazon.tsx`): arriba Hoy, Servicios, Avisos e Históricos (abajo en el móvil, con «Más» que abre el resto) y debajo por temas. Con una instalación conectada elegida, lo que aún es simulado se marca «Ejemplo» en el menú; al conectar una pantalla, añádela a `conectada()`.
- Los puntos de frío se llaman **Servicios** en la app del cliente. Nombres largos (p. ej. «Instalación de demostración») no pueden romper el diseño.
- Iconos de `lucide-react`. Textos literales en el JSX, sin claves de traducción.
- Las confirmaciones nuevas van dentro de la página, no con `window.confirm` (quedan algunas antiguas; no añadas más).

## Rendimiento (COP)

El núcleo de Gradiox. Fórmulas, umbrales, avisos y ajustes en `docs/rendimiento.md`; los datos que ve la persona en `src/cop/indicadores.ts` (Ayuda en `/como-funciona/rendimiento`); el porqué en el plan (enlace dentro del documento).

- **Tres niveles y manda el de la instalación** (todo el frío ÷ toda la electricidad del frío: compresores, condensador, bombas, ventiladores, desescarches). Un ajuste se decide y se verifica con ese, no con el de un compresor. Los otros dos: compresor (averías, secuencia) y servicio (coste por cámara, ±10–20 %).
- **Un indicador por equipo**: COP si produce frío; W por kW de frío si no. Sumados dan 1000 / COP de la instalación (`repartoPorKwFrio`).
- **Cada número lleva su calidad (medido, calculado o estimado) y su margen.** Lo que no se puede calcular dice «Faltan datos», qué hace falta y qué precisión daría; no se rellena con un supuesto.
- El objetivo es el menor coste con el género seguro, no el COP más alto. Un ahorro solo vale medido (línea base antes de activar ajustes, días alternos, mayor que el doble de su incertidumbre). No se prometen porcentajes.
- En tornillos con aceite no se calcula el rendimiento isentrópico con la temperatura de descarga; se usa el índice de consumo frente a su propia historia.
- Presión relativa o absoluta: comprobada contra la temperatura de saturación antes de enseñar ningún COP.
- Curvas de fabricante y datos de cada planta, en la base de datos por instalación, nunca en el repositorio. CoolProp (MIT) sí, en tablas precalculadas; REFPROP no.
- Automatización en cinco niveles (mirar, avisar, proponer, aplicar con aviso, automático): explicada en `/ops/automatizacion` desde `src/cop/automatizacion.ts`. Solo consignas, nunca seguridades; el autómata vuelve solo a la consigna del frigorista si falla algo; un ajuste nunca sube de nivel solo. Al construir una pieza, cambia su estado («hoy») ahí.
- **Quien cambie una regla, fórmula, umbral, indicador o nivel actualiza `docs/rendimiento.md`, `src/cop/indicadores.ts` y `src/cop/automatizacion.ts` en el mismo PR**, y la Ayuda si cambia lo que ve la persona.

## La pasarela

- Publicar una versión: `./compilar.sh X.Y.Z` con la clave de firma y luego `./empaquetar-mac.sh X.Y.Z`. Subir `pasarela-opcua/publicado/` a `main` hace que las instaladas se actualicen solas. Solo queda una versión publicada: se borran los `.gz` de la anterior.
- Una versión nueva tiene que poder arrancar desde la anterior: no se rompe el protocolo con la nube (`PROTOCOLO_MINIMO` y `PROTOCOLO_MAXIMO` en `src/pasarelas/modelo.ts`) sin subir el número y mantener el anterior.
- La página local (`pagina.html`) es un solo archivo sin dependencias.
- Órdenes al PLC: doble llave (activadas en el panel y permitidas en el programa), lista cerrada de variables con mínimo y máximo, y caducan a los dos minutos. Cualquier cosa que escriba pasa por ahí.

## Git

- Rama propia, PR contra `main` con cómo probarlo y lo que no está comprobado, y fusión por *squash*.
- Commits en imperativo: «Añade…», «Corrige…».
- Hugo ha pedido publicar en `main` sin preguntar cada vez mientras no diga lo contrario. Sigue valiendo lo de arriba: lo que toca base de datos, plantas reales o secretos se pregunta siempre.
- Al terminar algo que cambia lo que Gradiox sabe hacer, se actualiza `src/lib/plan.ts` y, si cambia una medida de seguridad, `src/lib/seguridad.ts`, en el mismo cambio.
