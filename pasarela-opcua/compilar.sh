#!/usr/bin/env bash
# Compila la pasarela para Mac y Windows, la firma y deja lista la publicación.
#
#   GRADIOX_FIRMA=/ruta/a/clave-firma.txt ./compilar.sh 0.1.0
#
# Deja los programas en dist/ (lo que se entrega) y, comprimidos y firmados, en
# publicado/ (de donde se actualizan solos los ya instalados al subirlo a main).
# La clave de firma no está en el repositorio: sin ella no se puede publicar.
set -euo pipefail
cd "$(dirname "$0")"
version="${1:?Falta la versión, por ejemplo 0.1.0}"
clave="${GRADIOX_FIRMA:?Falta GRADIOX_FIRMA con la ruta de la clave de firma}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "La versión tiene que ser como 0.1.0"; exit 1; }

go build -o dist/firmar ./herramientas/firmar
publica="$(dist/firmar publica "$clave")"
banderas="-s -w -X main.version=$version -X main.claveFirma=$publica"

# Con garble los nombres internos y los textos quedan ofuscados. Sin él, se compila sin símbolos ni rutas.
if command -v garble >/dev/null 2>&1 && [[ "${GRADIOX_SIN_OFUSCAR:-}" == "" ]]; then
  # Solo se ofusca el código propio: la biblioteca OPC UA es pública y ofuscarla no protege nada.
  export GOGARBLE=gradiox.com/pasarela
  compilar=(garble -literals -tiny build -p 2)
else
  compilar=(go build)
fi

mkdir -p dist publicado
echo "{" > publicado/publicado.json.tmp
primero=1
for plataforma in ${GRADIOX_PLATAFORMAS:-darwin-arm64 darwin-amd64 windows-amd64}; do
  so="${plataforma%-*}"; arq="${plataforma#*-}"
  nombre="gradiox-pasarela-$plataforma"; [[ "$so" == windows ]] && nombre="$nombre.exe"
  echo "Compilando $plataforma…"
  CGO_ENABLED=0 GOOS="$so" GOARCH="$arq" "${compilar[@]}" -trimpath -ldflags "$banderas" -o "dist/$nombre" .
  rm -f publicado/gradiox-pasarela-"$plataforma"-*.gz
  archivo="gradiox-pasarela-$plataforma-$version.gz"
  gzip -9 -n -c "dist/$nombre" > "publicado/$archivo"
  datos="$(dist/firmar firma "$clave" "$plataforma" "$version" "dist/$nombre")"
  comprimido="$(wc -c < "publicado/$archivo" | tr -d ' ')"
  [[ $primero == 1 ]] || echo "," >> publicado/publicado.json.tmp
  primero=0
  printf '  "%s": %s' "$plataforma" "${datos%\}},\"archivo\":\"$archivo\",\"comprimido\":$comprimido}" >> publicado/publicado.json.tmp
done
printf '\n}\n' >> publicado/publicado.json.tmp
mv publicado/publicado.json.tmp publicado/publicado.json
rm -f dist/firmar
echo "Hecho: versión $version en dist/ y publicado/."
