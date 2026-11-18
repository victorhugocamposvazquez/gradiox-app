//go:build !windows

package main

import (
	"fmt"
	"os"
	"syscall"
)

// Sustituye este proceso por el programa indicado, en la misma ventana y con las mismas opciones.
func reiniciar(exe string) {
	env := append(os.Environ(), "GRADIOX_REINICIO=1")
	if err := syscall.Exec(exe, append([]string{exe}, os.Args[1:]...), env); err != nil {
		fmt.Println("No se ha podido reiniciar. Vuelva a abrir el programa:", err)
	}
}
