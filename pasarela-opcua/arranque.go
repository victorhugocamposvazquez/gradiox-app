package main

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// Abrirse solo al encender el ordenador (al iniciar la sesión del usuario).
// En Windows, un archivo en la carpeta Inicio; en Mac, un agente de la sesión.
// Lo que se abre es el programa instalado, que hace de vigilante.

func rutaArranque() string {
	switch runtime.GOOS {
	case "windows":
		if d := os.Getenv("APPDATA"); d != "" {
			return filepath.Join(d, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "Gradiox Pasarela.cmd")
		}
	case "darwin":
		if casa, err := os.UserHomeDir(); err == nil {
			return filepath.Join(casa, "Library", "LaunchAgents", "com.gradiox.pasarela.plist")
		}
	}
	return ""
}

func arranqueActivo() bool {
	r := rutaArranque()
	if r == "" {
		return false
	}
	_, err := os.Stat(r)
	return err == nil
}

func programaInstalado() (string, error) {
	if l := os.Getenv("GRADIOX_LANZADOR"); l != "" {
		return l, nil
	}
	return ejecutable()
}

func xmlTexto(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

func ponerArranque(activo bool) error {
	r := rutaArranque()
	if r == "" {
		return errors.New("en este sistema no se puede")
	}
	if !activo {
		if err := os.Remove(r); err != nil && !os.IsNotExist(err) {
			return errors.New("no se ha podido quitar")
		}
		return nil
	}
	exe, err := programaInstalado()
	if err != nil {
		return err
	}
	var contenido string
	switch runtime.GOOS {
	case "windows":
		contenido = "@echo off\r\nstart \"Gradiox Pasarela\" /min \"" + exe + "\" -sin-navegador\r\n"
	case "darwin":
		// Una aplicación abierta desde Descargas o desde la imagen de disco no tiene un sitio fijo.
		if strings.Contains(exe, "/AppTranslocation/") || strings.HasPrefix(exe, "/Volumes/") {
			return errors.New("primero mueva «Gradiox Pasarela» a Aplicaciones y ábrala desde allí")
		}
		contenido = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>com.gradiox.pasarela</string>
	<key>ProgramArguments</key>
	<array><string>` + xmlTexto(exe) + `</string><string>-sin-navegador</string></array>
	<key>RunAtLoad</key><true/>
</dict>
</plist>
`
	}
	if err := os.MkdirAll(filepath.Dir(r), 0o755); err != nil {
		return errors.New("no se puede escribir en la carpeta de inicio")
	}
	if err := escribirEntero(r, []byte(contenido), 0o644); err != nil {
		return errors.New("no se puede escribir en la carpeta de inicio")
	}
	return nil
}
