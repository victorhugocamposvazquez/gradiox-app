#!/usr/bin/env bash
# Empaqueta la pasarela de Mac como aplicación dentro de una imagen de disco.
#
#   ./empaquetar-mac.sh 0.1.1      (después de compilar.sh con la misma versión)
#
# Deja en dist/ «Gradiox Pasarela.app» (vale para Apple Silicon e Intel),
# gradiox-pasarela-mac.dmg y, por si la imagen no se abre, gradiox-pasarela-mac.zip.
# La aplicación no va firmada por Apple: la primera vez hay que permitirla en
# Ajustes del Sistema > Privacidad y seguridad > «Abrir igualmente».
set -euo pipefail
cd "$(dirname "$0")"
version="${1:?Falta la versión, por ejemplo 0.1.1}"
variables="${GRADIOX_VARIABLES:-}"
for f in dist/gradiox-pasarela-darwin-arm64 dist/gradiox-pasarela-darwin-amd64; do
  [[ -f "$f" ]] || { echo "Falta $f: ejecute antes compilar.sh"; exit 1; }
done
command -v xorriso >/dev/null || { echo "Falta xorriso para hacer la imagen de disco"; exit 1; }

sitio="dist/mac"; app="$sitio/Gradiox Pasarela.app"
rm -rf "$sitio" dist/gradiox-pasarela-mac.dmg dist/gradiox-pasarela-mac.zip
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
go run ./herramientas/universal "$app/Contents/MacOS/gradiox-pasarela" dist/gradiox-pasarela-darwin-arm64 dist/gradiox-pasarela-darwin-amd64
chmod 755 "$app/Contents/MacOS/gradiox-pasarela"
cp mac/icono.icns "$app/Contents/Resources/icono.icns"
[[ -n "$variables" ]] && cp "$variables" "$app/Contents/Resources/variables.csv"
printf 'APPL????' > "$app/Contents/PkgInfo"
cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Gradiox Pasarela</string>
  <key>CFBundleDisplayName</key><string>Gradiox Pasarela</string>
  <key>CFBundleIdentifier</key><string>com.gradiox.pasarela</string>
  <key>CFBundleExecutable</key><string>gradiox-pasarela</string>
  <key>CFBundleIconFile</key><string>icono</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>CFBundleDevelopmentRegion</key><string>es</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST
[[ -f mac/LEEME.txt ]] && cp mac/LEEME.txt "$sitio/LEEME.txt"
(cd "$sitio" && zip -qry ../gradiox-pasarela-mac.zip .)
ln -s /Applications "$sitio/Aplicaciones"
xorriso -as mkisofs -D -l -V "Gradiox Pasarela" -no-pad -r -dir-mode 0755 -o dist/gradiox-pasarela-mac.dmg "$sitio" 2>/dev/null
rm "$sitio/Aplicaciones"
echo "Hecho: dist/gradiox-pasarela-mac.dmg y dist/gradiox-pasarela-mac.zip"
