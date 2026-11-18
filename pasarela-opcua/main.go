// Pasarela de prueba de Gradiox: lee variables de un PLC por OPC UA, las enseña
// en una página local y, si tiene token, las entrega a Gradiox.
//
// Solo lee. En todo el programa no hay ninguna llamada de escritura al PLC.
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
	}
	a, err := nuevaApp(base)
	if err != nil {
		fmt.Println(err)
		esperarTecla()
		os.Exit(1)
	}
	a.registrar("Gradiox · pasarela de prueba %s (%s). Solo lectura.", version, plataforma())

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
	fmt.Println("  Para parar: cierre esta ventana o pulse Ctrl+C.")
	fmt.Println()
	if !*sinNavegador && os.Getenv("GRADIOX_REINICIO") == "" {
		abrirNavegador(url)
	}

	go a.cicloNube(ctx)
	go a.cicloLectura(ctx)
	go a.cicloActualizacion(ctx)
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
