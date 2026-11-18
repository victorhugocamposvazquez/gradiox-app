//go:build !windows

package main

import (
	"fmt"
	"os"
	"syscall"
)

// Sustituye este proceso por el programa indicado, en la misma ventana y con las mismas opciones.
func reiniciar(exe string) { lanzar(exe, true) }

// lanzar solo vuelve si no ha podido arrancar el otro programa.
func lanzar(exe string, reinicio bool) bool {
	env := os.Environ()
	if reinicio {
		env = append(env, "GRADIOX_REINICIO=1")
	}
	if err := syscall.Exec(exe, append([]string{exe}, os.Args[1:]...), env); err != nil {
		if reinicio {
			fmt.Println("No se ha podido reiniciar. Vuelva a abrir el programa:", err)
		}
		return false
	}
	return true
}
