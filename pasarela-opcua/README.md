# Pasarela de prueba (OPC UA)

Programa que se deja en un ordenador de la planta (o en un portátil, para una visita). Lee variables de un PLC por OPC UA, las enseña en una página local y, si tiene token, las entrega a Gradiox. Está escrito en Go y es independiente de la app: no comparte código con ella.

Se entrega **solo el ejecutable**. Este código fuente no sale del repositorio.

## Qué garantiza

- **Lee, y solo escribe con dos llaves.** Por defecto solo lee. Para que Gradiox cambie un valor en el PLC hacen falta las dos: en el panel interno se activan las órdenes y se elige qué variables y entre qué límites, y en la planta se marca «Permitir órdenes de Gradiox» en el programa. Cada orden caduca a los 2 minutos, se comprueba con el tipo del PLC, se lee antes y después y queda apuntada en `ordenes.csv` y en la tabla `gradiox_ordenes_opc`.
- **No lleva secretos de Gradiox.** Ni claves de Supabase ni de la app. Lo único que identifica a una instalación es su token, que se le pone al instalarla, solo sirve para entregar lecturas y pedir su propia configuración, caduca y se puede anular desde el panel (`/ops/pasarelas`). En la base solo se guarda la huella del token.
- **No lleva lógica de la app.** Lee, enseña y entrega. Qué significa cada dato lo decide Gradiox.
- **La contraseña del PLC no sale del ordenador** donde se escribe.
- El ejecutable va sin símbolos ni rutas, y con el código propio ofuscado (garble).

## Cómo se configura

Casi todo se cambia desde el panel interno, sin tocar el ordenador de la planta: dirección del PLC, cada cuánto lee y la lista de variables (el «perfil»). El programa lo recoge solo en menos de un minuto y lo guarda, para seguir igual si se queda sin internet. Lo que se escriba en el propio programa (dirección y ritmo) manda sobre lo del panel, para poder corregir en planta sin internet.

**Vincular.** En el panel, en la conexión de la instalación, «Código de conexión» da 6 cifras que sirven una vez y caducan a los 30 minutos. En el primer paso del programa se escriben y el programa las cambia por su token (`POST /api/pasarela/vincular`): nadie copia el token a mano. Diez intentos fallidos anulan los códigos abiertos. El token largo se puede seguir pegando, para las conexiones antiguas.

Sin token funciona igual, con la lista del archivo `variables.csv` que tenga al lado, y guarda lo leído en `gradiox-datos/lecturas/`.

## Cómo se actualiza solo

1. Al arrancar y cada 6 horas pregunta a Gradiox por la última versión para su plataforma. En la página sale «Actualizar ahora» para no esperar.
2. El anuncio trae versión, tamaño, huella (sha256) y una **firma Ed25519**. El programa lleva dentro la clave pública y no instala nada que no esté firmado con la privada: aunque alguien entrase en el servidor o en el repositorio, no podría colar otro programa. Tampoco instala una versión igual o anterior.
3. Descarga por partes, comprueba la huella, y antes de cambiarse **arranca el nuevo con `-comprobar`** para ver que funciona en ese ordenador.
4. La versión nueva **no se escribe donde está instalado el programa** (en un Mac o en «Archivos de programa» esa carpeta suele ser de solo lectura), sino en la carpeta de datos, en `gradiox-datos/programa/`, con `actual.json` (versión, huella y firma) y `anterior.json` (la que había).
5. Si el nuevo se cae dos veces en su primer minuto, o no llega a funcionar un minuto en dos arranques, se descarta y **se vuelve a la versión anterior** (y si no la hay, al programa instalado).

## Que funcione siempre

- **Vigilante.** Lo que se abre (el .exe, la aplicación de Mac, el inicio con el ordenador) es un vigilante que no lee ni habla con nadie: arranca el programa de verdad como proceso aparte con la versión en uso. Si el programa se cae, lo vuelve a abrir (a los 5 s, y espaciando hasta 1 min si se repite). «Cerrar el programa» lo cierra todo.
- **Carpeta de datos.** Junto al programa si ahí se puede escribir; si no, en la carpeta de la cuenta del usuario (`%APPDATA%\Gradiox Pasarela` en Windows, `~/Library/Application Support/Gradiox Pasarela` en Mac).
- **Abrirse al encender.** Casilla en «Conexión»: en Windows deja un archivo en la carpeta Inicio del usuario; en Mac, un agente de sesión (la aplicación tiene que estar en Aplicaciones).

El protocolo con el servidor va numerado (`X-Gradiox-Protocolo`). Si un día el servidor deja de entender a un programa viejo, le responde 426 y el programa se actualiza.

## Publicar una versión

Hace falta la clave de firma, que **no está en el repositorio** (está en la carpeta privada del proyecto, `gradiox/pasarela/privado/clave-firma.txt`). Si se pierde, los programas ya instalados no podrán actualizarse solos y habrá que reinstalarlos a mano.

```
GRADIOX_FIRMA=/ruta/clave-firma.txt ./compilar.sh 0.2.0
```

Deja los ejecutables en `dist/` (lo que se entrega a mano) y, comprimidos y firmados, en `publicado/`. Al subir `publicado/` a `main`, los programas instalados se actualizan solos. Con `garble` instalado ofusca; necesita la misma versión de Go que pida garble.

## La página del programa

«Gradiox Gateway · Pasarela industrial». Hasta que todo funciona enseña cuatro pasos: Vinculación, Autómata, Variables y Verificación. Después, un panel con Resumen, Variables, Probar, Equipos, Órdenes y Este equipo. En «Probar» se elige una variable de la lista, se ve su valor al momento y, si se puede escribir, se escribe desde la planta, también sin internet (`POST /api/escribir`). Pasa por las mismas comprobaciones que una orden del panel: las dos llaves, la lista cerrada y sus límites. Vuelve sola al valor de antes a los 5 o 30 minutos, salvo que se elija dejarla; volver al valor original no mira los límites, porque era el que tenía el autómata.

## Probar sin PLC

En el paso «Autómata», «Modo demostración»: arranca dentro del propio programa un servidor OPC UA con las variables de la lista, con los nombres que usa un S7-1500 y valores inventados que se mueven. Si la instalación aún no tiene lista, enseña unas de ejemplo (tres cámaras y la central).

## Tablas

Las crea el servidor solo la primera vez que se usa, como el resto (`src/pasarelas/almacen.ts`). Llevan la seguridad por filas encendida y sin reglas: solo entra el servidor. Por si se quieren crear a mano en el SQL Editor de Supabase:

```sql
create table if not exists gradiox_pasarelas (
  id uuid primary key,
  huella text not null unique,
  datos jsonb not null,
  contacto jsonb,
  creada bigint not null,
  actualizada bigint not null
);
alter table gradiox_pasarelas enable row level security;
create table if not exists gradiox_lecturas_opc (
  pasarela uuid not null references gradiox_pasarelas (id) on delete cascade,
  variable text not null,
  t bigint not null,
  valor jsonb,
  incidencia text,
  simulada boolean not null default false,
  recibida timestamptz not null default now(),
  primary key (pasarela, variable, t)
);
alter table gradiox_lecturas_opc enable row level security;
```

## Archivos

- `main.go`, `app.go`: arranque, configuración y estado.
- `opc.go`: conexión y lectura OPC UA. `explora.go`: lista de lo que publica el PLC.
- `anotar.go`: qué se guarda y qué se entrega (solo lo que cambia, y una foto completa cada 15 minutos).
- `nube.go`: configuración remota y entrega. `actualiza.go`: actualización firmada y vuelta atrás. `vigilante.go`: vuelve a abrir el programa si se cae. `arranque.go`: abrirse al encender.
- `simulador.go`: PLC simulado. `web.go`, `pagina.html`: página local (solo se sirve a ese mismo ordenador).
- `herramientas/firmar`: crea la clave y firma.

## La aplicación de Mac

`./empaquetar-mac.sh 0.1.1`, después de `compilar.sh`, junta los dos programas de Mac en uno que vale para Apple Silicon e Intel y lo deja como «Gradiox Pasarela.app» dentro de `dist/gradiox-pasarela-mac.dmg` (y en un zip, por si la imagen no se abre). Necesita `xorriso`. Como aplicación guarda sus datos en `~/Library/Application Support/Gradiox Pasarela`, no abre ventana (se cierra desde la página) y, si ya está abierta, solo enseña la página.

No va firmada por Apple: la primera vez hay que permitirla en Ajustes del Sistema, Privacidad y seguridad, «Abrir igualmente». Para quitar ese paso hace falta una cuenta de desarrollador de Apple, firmarla y notarizarla.

## Elegir las variables en la planta

«Buscar variables» recorre lo que publica el PLC y lo enseña con su valor, casado con la lista de partida (la del panel o `variables.csv`). Lo que se marca queda en `gradiox-datos/elegidas.json` y manda en ese ordenador. El programa lo manda al servidor (`POST /api/pasarela/propuesta`), que lo deja directamente como lista de la instalación y guarda la anterior (en el panel, «Volver a la anterior»); el programa deja entonces la suya y rige la del panel, que ya es la misma. La lista de `variables.csv` sí queda como propuesta hasta que se acepta en el panel con «Usar esta lista».
