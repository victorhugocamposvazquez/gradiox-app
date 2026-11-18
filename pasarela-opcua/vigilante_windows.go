//go:build windows

package main

import "os"

// En Windows no se puede mandar una interrupción a otro proceso: se cierra sin más.
// Lo leído ya está guardado en disco a cada lectura.
func pararHijo(p *os.Process) { _ = p.Kill() }
