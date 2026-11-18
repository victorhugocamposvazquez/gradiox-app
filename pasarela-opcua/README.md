# Pasarela de prueba (OPC UA)

Programa que se deja en un ordenador de la planta (o en un portátil, para una visita). Lee variables de un PLC por OPC UA, las enseña en una página local y, si tiene token, las entrega a Gradiox. Está escrito en Go y es independiente de la app: no comparte código con ella.

Se entrega **solo el ejecutable**. Este código fuente no sale del repositorio.

## Qué garantiza

- **Solo lee.** En todo el programa no hay ninguna llamada de escritura al PLC.
- **No lleva secretos de Gradiox.** Ni claves de Supabase ni de la app. Lo único que identifica a una instalación es su token, que se le pone al instalarla, solo sirve para entregar lecturas y pedir su propia configuración, caduca y se puede anular desde el panel (`/ops/pasarelas`). En la base solo se guarda la huella del token.
- **No lleva lógica de la app.** Lee, enseña y entrega. Qué significa cada dato lo decide Gradiox.
- **La contraseña del PLC no sale del ordenador** donde se escribe.
- El ejecutable va sin símbolos ni rutas, y con el código propio ofuscado (garble).

## Cómo se configura

Casi todo se cambia desde el panel interno, sin tocar el ordenador de la planta: dirección del PLC, cada cuánto lee y la lista de variables (el «perfil»). El programa lo recoge solo en menos de un minuto y lo guarda, para seguir igual si se queda sin internet. Lo que se escriba en el propio programa (dirección y ritmo) manda sobre lo del panel, para poder corregir en planta sin internet.

Sin token funciona igual, con la lista del archivo `variables.csv` que tenga al lado, y guarda lo leído en `gradiox-datos/lecturas/`.

## Cómo se actualiza solo

1. Al arrancar y cada 6 horas pregunta a Gradiox por la última versión para su plataforma.
2. El anuncio trae versión, tamaño, huella (sha256) y una **firma Ed25519**. El programa lleva dentro la clave pública y no instala nada que no esté firmado con la privada: aunque alguien entrase en el servidor o en el repositorio, no podría colar otro programa. Tampoco instala una versión igual o anterior.
3. Descarga por partes, comprueba la huella, y antes de cambiarse **arranca el nuevo con `-comprobar`** para ver que funciona en ese ordenador.
4. Guarda el anterior (`.anterior`). Si el nuevo no llega a funcionar un minuto en dos arranques, **vuelve solo al anterior** y descarta esa versión.

El protocolo con el servidor va numerado (`X-Gradiox-Protocolo`). Si un día el servidor deja de entender a un programa viejo, le responde 426 y el programa se actualiza.

## Publicar una versión

Hace falta la clave de firma, que **no está en el repositorio** (está en la carpeta privada del proyecto, `gradiox/pasarela/privado/clave-firma.txt`). Si se pierde, los programas ya instalados no podrán actualizarse solos y habrá que reinstalarlos a mano.

```
GRADIOX_FIRMA=/ruta/clave-firma.txt ./compilar.sh 0.2.0
```

Deja los ejecutables en `dist/` (lo que se entrega a mano) y, comprimidos y firmados, en `publicado/`. Al subir `publicado/` a `main`, los programas instalados se actualizan solos. Con `garble` instalado ofusca; necesita la misma versión de Go que pida garble.

## Probar sin PLC

En la página del programa, «Conexión» y «PLC simulado, para probar»: arranca dentro del propio programa un servidor OPC UA con las variables de la lista, con los nombres que usa un S7-1500 y valores inventados que se mueven.

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
- `nube.go`: configuración remota y entrega. `actualiza.go`: actualización firmada y vuelta atrás.
- `simulador.go`: PLC simulado. `web.go`, `pagina.html`: página local (solo se sirve a ese mismo ordenador).
- `herramientas/firmar`: crea la clave y firma.
