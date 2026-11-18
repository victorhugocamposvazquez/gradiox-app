//go:build !windows

package main

import (
	"os"
	"syscall"
)

func pararHijo(p *os.Process) { _ = p.Signal(syscall.SIGTERM) }
