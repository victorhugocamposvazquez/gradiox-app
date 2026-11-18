//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
)

// Arranca el programa indicado en la misma ventana y espera a que termine, para que la ventana siga abierta.
func reiniciar(exe string) {
	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	cmd.Env = append(os.Environ(), "GRADIOX_REINICIO=1")
	if err := cmd.Start(); err != nil {
		fmt.Println("No se ha podido reiniciar. Vuelva a abrir el programa:", err)
		return
	}
	_ = cmd.Wait()
}
