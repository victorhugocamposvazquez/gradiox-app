// Pasarela de prueba de Gradiox: lee variables de un PLC por OPC UA, las enseña
// en una página local y, si tiene token, las entrega a Gradiox.
//
// Solo lee, salvo que se activen las órdenes con dos llaves: en el panel de
// Gradiox para esta instalación y en el propio programa, en la planta. Aun así
// solo escribe las variables de la lista que manda el panel y dentro de sus límites.
// No lleva claves de Gradiox dentro: lo único que identifica a una instalación
// es el token que se le pone en la configuración, que se puede anular desde el panel.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

// Se fijan al compilar con -ldflags.
var (
	version    = "0.0.0"
	claveFirma = "" // clave pública (base64) con la que se comprueban las actualizaciones
)

// Versión del idioma que habla con el servidor. Solo cambia si deja de ser compatible.
const protocolo = 1

func plataforma() string { return runtime.GOOS + "-" + runtime.GOARCH }

func main() {
	comprobar := flag.Bool("comprobar", false, "arranca, comprueba que el programa está entero y sale")
	sinNavegador := flag.Bool("sin-navegador", false, "no abre la página al arrancar")
	carpeta := flag.String("carpeta", "", "carpeta de trabajo (por defecto, la del programa)")
	flag.Parse()

	// Las bibliotecas no escriben en la ventana: solo lo que este programa quiere contar.
	log.SetOutput(io.Discard)

	if *comprobar {
		// Lo usa la actualización para saber que la versión nueva arranca antes de cambiarse por ella.
		fmt.Println("gradiox-pasarela", version, plataforma(), "protocolo", protocolo)
		return
	}

	base := *carpeta
	if base == "" {
		exe, err := os.Executable()
		if err != nil {
			fmt.Println("No se puede saber dónde está el programa:", err)
			os.Exit(1)
		}
		if real, err := filepath.EvalSymlinks(exe); err == nil {
			exe = real
		}
		base = filepath.Dir(exe)
		// Como aplicación de Mac no se puede escribir dentro de la propia aplicación: los datos van a la carpeta del usuario.
		if runtime.GOOS == "darwin" && strings.Contains(exe, ".app/Contents/MacOS/") {
			base = carpetaDeMac(base)
		}
	}
	// Si ya está abierto, no se abre otro: se enseña la página del que está en marcha.
	if os.Getenv("GRADIOX_REINICIO") == "" && yaEnMarcha() {
		if !*sinNavegador {
			abrirNavegador(paginaFija)
		}
		fmt.Println("La pasarela ya estaba abierta:", paginaFija)
		return
	}
	a, err := nuevaApp(base)
	if err != nil {
		fmt.Println(err)
		esperarTecla()
		os.Exit(1)
	}
	a.registrar("Gradiox · pasarela de prueba %s (%s).", version, plataforma())

	// Si la versión recién instalada no llegó a funcionar, se vuelve a la anterior.
	if a.vueltaAtrasSiHaceFalta() {
		return
	}

	ctx, parar := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer parar()
	a.parar = parar

	url, err := a.servirPagina(ctx)
	if err != nil {
		a.registrar("No se puede abrir la página local: %v", err)
		esperarTecla()
		os.Exit(1)
	}
	fmt.Println()
	fmt.Println("  Página de la pasarela:", url)
	fmt.Println("  Para parar: pulse «Cerrar el programa» en la página, o cierre esta ventana.")
	fmt.Println()
	if !*sinNavegador && os.Getenv("GRADIOX_REINICIO") == "" {
		abrirNavegador(url)
	}

	go a.cicloNube(ctx)
	go a.cicloLectura(ctx)
	go a.cicloActualizacion(ctx)
	go a.cicloOrdenes(ctx)
	// Tras un minuto en marcha, esta versión se da por buena.
	go func() {
		select {
		case <-ctx.Done():
		case <-time.After(time.Minute):
			a.confirmarVersion()
		}
	}()

	<-ctx.Done()
	a.cerrar()
	if a.reiniciarCon != "" {
		reiniciar(a.reiniciarCon)
		return
	}
	// Si se ha podido usar y cerrar con normalidad, la versión vale.
	a.confirmarVersion()
}

func esperarTecla() {
	if runtime.GOOS == "windows" {
		fmt.Println("Pulse Intro para cerrar.")
		fmt.Scanln()
	}
}

// Carpeta de trabajo cuando el programa es una aplicación de Mac. La primera
// vez deja en ella la lista de variables que viene dentro de la aplicación.
func carpetaDeMac(macos string) string {
	casa, err := os.UserHomeDir()
	if err != nil {
		return macos
	}
	base := filepath.Join(casa, "Library", "Application Support", "Gradiox Pasarela")
	if err := os.MkdirAll(base, 0o755); err != nil {
		return macos
	}
	destino := filepath.Join(base, "variables.csv")
	if _, err := os.Stat(destino); err != nil {
		if b, err := os.ReadFile(filepath.Join(macos, "..", "Resources", "variables.csv")); err == nil {
			_ = os.WriteFile(destino, b, 0o644)
		}
	}
	return base
}
