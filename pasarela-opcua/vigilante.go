package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

// El vigilante.
//
// Lo que se abre (el .exe, la aplicación de Mac, el inicio con el ordenador)
// es siempre un vigilante pequeño que no lee el PLC ni habla con Gradiox: solo
// arranca el programa de verdad como proceso aparte y lo mira. Si el programa
// se cae, lo vuelve a abrir; si es una versión nueva que se cae nada más
// arrancar, la descarta y vuelve al programa instalado. Así un fallo del
// programa nunca deja la planta sin pasarela.

const (
	salidaNormal    = 0
	salidaReiniciar = 3 // el programa pide que se le vuelva a abrir (versión nueva o vuelta atrás)
)

func anotarVigilante(datos, formato string, args ...any) {
	linea := time.Now().Format("15:04:05") + " " + fmt.Sprintf(formato, args...)
	fmt.Println(linea)
	if f, err := os.OpenFile(filepath.Join(datos, "registro.txt"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
		fmt.Fprintln(f, time.Now().Format("2006-01-02 ")+linea)
		f.Close()
	}
}

func guardadaEn(datos string) (instalada, bool) {
	var g instalada
	b, err := os.ReadFile(filepath.Join(carpetaVersiones(datos), "actual.json"))
	if err != nil || json.Unmarshal(b, &g) != nil {
		return g, false
	}
	return g, true
}

func descartarGuardada(datos, motivo string) {
	if g, ok := guardadaEn(datos); ok {
		anotarVigilante(datos, "La versión %s %s. Se vuelve a la anterior.", g.Version, motivo)
		if f, err := os.OpenFile(filepath.Join(datos, "versiones-descartadas.txt"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
			fmt.Fprintln(f, g.Version)
			f.Close()
		}
	}
	volverAnterior(datos)
	_ = os.Remove(filepath.Join(datos, "actualizacion.json"))
}

// Deja como versión en uso la anterior guardada, si la hay; si no, el programa instalado.
func volverAnterior(datos string) {
	dir := carpetaVersiones(datos)
	_ = os.Remove(filepath.Join(dir, "actual.json"))
	_ = os.Rename(filepath.Join(dir, "anterior.json"), filepath.Join(dir, "actual.json"))
}

// vigilar devuelve el código con el que debe terminar el vigilante.
func vigilar(base string) int {
	datos := filepath.Join(base, "gradiox-datos")
	_ = os.MkdirAll(datos, 0o755)
	yo, err := ejecutable()
	if err != nil {
		fmt.Println("No se puede saber dónde está el programa:", err)
		return 1
	}
	// El programa instalado. Si quien vigila es ya una versión guardada (la 0.3.1 pasaba
	// el testigo así), el instalado es el que la abrió.
	instalado := yo
	if l := os.Getenv("GRADIOX_LANZADOR"); l != "" && filepath.Dir(yo) == carpetaVersiones(datos) {
		instalado = l
	}
	senal := make(chan os.Signal, 1)
	signal.Notify(senal, os.Interrupt, syscall.SIGTERM)
	var caidas []time.Time
	fallosNueva := 0
	primera := os.Getenv("GRADIOX_REINICIO") == ""
	for {
		prog := instalado
		if r := versionGuardada(datos); r != "" {
			prog = r
		}
		cmd := exec.Command(prog, os.Args[1:]...)
		cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
		cmd.Env = append(os.Environ(), "GRADIOX_HIJO=1", "GRADIOX_CARPETA="+base, "GRADIOX_LANZADOR="+instalado)
		if !primera {
			cmd.Env = append(cmd.Env, "GRADIOX_REINICIO=1")
		}
		primera = false
		inicio := time.Now()
		if err := cmd.Start(); err != nil {
			if prog != instalado {
				descartarGuardada(datos, "no se puede abrir")
				continue
			}
			fmt.Println("No se puede abrir el programa:", err)
			return 1
		}
		fin := make(chan error, 1)
		go func() { fin <- cmd.Wait() }()
		parado := false
		select {
		case <-fin:
		case <-senal:
			// Se ha pedido cerrar: se cierra el programa con él.
			parado = true
			pararHijo(cmd.Process)
			select {
			case <-fin:
			case <-time.After(10 * time.Second):
				_ = cmd.Process.Kill()
				<-fin
			}
		}
		if parado {
			return salidaNormal
		}
		codigo := cmd.ProcessState.ExitCode()
		switch codigo {
		case salidaNormal:
			return salidaNormal
		case salidaReiniciar:
			fallosNueva = 0
			continue
		}
		// Se ha caído.
		if prog != instalado && time.Since(inicio) < time.Minute {
			fallosNueva++
			if fallosNueva >= 2 {
				descartarGuardada(datos, "se ha cerrado dos veces al arrancar")
				fallosNueva = 0
				continue
			}
		}
		ahora := time.Now()
		recientes := caidas[:0]
		for _, c := range caidas {
			if ahora.Sub(c) < 10*time.Minute {
				recientes = append(recientes, c)
			}
		}
		caidas = append(recientes, ahora)
		espera := time.Duration(len(caidas)) * 5 * time.Second
		if espera > time.Minute {
			espera = time.Minute
		}
		anotarVigilante(datos, "El programa se ha cerrado sin querer (código %d). Se vuelve a abrir en %d s.", codigo, int(espera.Seconds()))
		select {
		case <-senal:
			return salidaNormal
		case <-time.After(espera):
		}
	}
}
