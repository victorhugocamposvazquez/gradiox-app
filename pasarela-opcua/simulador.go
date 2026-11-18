package main

import (
	"context"
	"hash/fnv"
	"math"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/gopcua/opcua/server"
	"github.com/gopcua/opcua/ua"
)

// PLC simulado dentro del propio programa, para probar sin ir a la planta.
// Publica las variables de la lista con los mismos nombres que usaría un S7-1500
// y valores inventados que se mueven. Las que el panel del operador lee por
// dirección absoluta no se publican, igual que pasará en el PLC de verdad.

func semilla(s string) float64 {
	h := fnv.New32a()
	h.Write([]byte(s))
	return float64(h.Sum32()%10000) / 10000
}

func valorSimulado(v Variable, t float64) any {
	s := semilla(v.Nombre)
	tipo := strings.ToLower(v.Tipo)
	n := strings.ToLower(v.Nombre)
	switch {
	case strings.HasPrefix(tipo, "bool"):
		// Cambia de vez en cuando, cada variable a su ritmo.
		periodo := 40 + s*400
		activo := math.Mod(t+s*1000, periodo) < periodo*(0.15+s*0.5)
		if strings.Contains(n, "averia") || strings.Contains(n, "alarma") || strings.Contains(n, "paro") {
			activo = math.Mod(t+s*5000, 1800) < 25
		}
		return activo
	case strings.HasPrefix(tipo, "word"), strings.HasPrefix(tipo, "int"), strings.HasPrefix(tipo, "dint"), strings.HasPrefix(tipo, "uint"):
		return uint16(0)
	}
	onda := math.Sin(t/(60+s*120) + s*6.28)
	var x float64
	switch v.Unidad {
	case "°C":
		base := -22 + math.Floor(s*5)*6 // cámaras de congelado y de fresco
		if strings.Contains(n, "consigna") || strings.Contains(n, "hora_") || strings.Contains(n, "_ac") || strings.Contains(n, "_de") {
			x = base + math.Round(s*4)
		} else {
			x = base + 1.5*onda
		}
	case "bar":
		x = 2 + s*12 + 0.3*onda
	case "%":
		x = 50 + 40*onda*s
	case "A":
		x = 20 + s*60 + 3*onda
	case "h":
		x = math.Floor(1000+s*20000) + math.Floor(t/3600)
	default:
		x = math.Round((s*100+5*onda)*10) / 10
	}
	return float32(math.Round(x*100) / 100)
}

func (a *App) pararSimulador() {
	a.mu.Lock()
	f := a.cierraSim
	a.cierraSim = nil
	a.mu.Unlock()
	if f != nil {
		f()
	}
}

func (a *App) arrancarSimulador(vars []Variable) (string, error) {
	a.pararSimulador()
	// Un puerto libre, solo en este ordenador.
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	puerto := l.Addr().(*net.TCPAddr).Port
	l.Close()
	s := server.New(
		server.EnableSecurity("None", ua.MessageSecurityModeNone),
		server.EnableAuthMode(ua.UserTokenTypeAnonymous),
		server.EndPoint("127.0.0.1", puerto),
		server.ServerName("PLC simulado de Gradiox"),
	)
	// Los índices 2 y 3 se rellenan para que el de Siemens no caiga siempre donde se espera por defecto.
	server.NewMapNamespace(s, "urn:gradiox:simulador:relleno")
	esp := server.NewMapNamespace(s, espacioSiemens)
	var publicadas []Variable
	for _, v := range vars {
		if !sinNombreEnPLC(v) && v.Nodo == "" {
			publicadas = append(publicadas, v)
		}
	}
	poner := func() {
		t := float64(time.Now().UnixMilli()) / 1000
		esp.Mu.Lock()
		for _, v := range publicadas {
			esp.Data[claveSiemens(v.Nombre)] = valorSimulado(v, t)
		}
		esp.Mu.Unlock()
	}
	poner()
	ctx, cancelar := context.WithCancel(context.Background())
	if err := s.Start(ctx); err != nil {
		cancelar()
		return "", err
	}
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Second):
				poner()
			}
		}
	}()
	a.mu.Lock()
	a.cierraSim = func() { cancelar(); _ = s.Close() }
	a.mu.Unlock()
	return "opc.tcp://127.0.0.1:" + strconv.Itoa(puerto), nil
}
