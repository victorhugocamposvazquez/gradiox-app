package main

import (
	"context"
	"fmt"
	"hash/fnv"
	"math"
	"net"
	"strconv"
	"strings"
	"sync"
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
	// La biblioteca lee los valores sin echar la llave; se le pone por encima,
	// para que el simulador pueda cambiarlos mientras se leen.
	esp := server.NewMapNamespace(server.New(), espacioSiemens)
	a.mu.Lock()
	if a.escritosSim == nil {
		a.escritosSim = &escritosSimulador{m: map[string]any{}}
	}
	escritos := a.escritosSim
	a.mu.Unlock()
	conLlave := &espacioConLlave{MapNamespace: esp, fijadas: map[string]bool{}, escritos: escritos}
	s.AddNamespace(conLlave)
	var publicadas []Variable
	for _, v := range vars {
		if !sinNombreEnPLC(v) && v.Nodo == "" {
			publicadas = append(publicadas, v)
		}
	}
	// Las cámaras con consignas por tarifa se comportan como cámaras; el resto son valores inventados que se mueven.
	camaras := camarasSim(publicadas)
	deCamara := map[string]bool{}
	for _, v := range publicadas {
		k := claveSiemens(v.Nombre)
		if clave, _ := camaraDe(v.Nombre); camaras[clave] != nil && camaras[clave].lleva(k) {
			deCamara[k] = true
		}
	}
	anterior := time.Now()
	poner := func() {
		ahora := time.Now()
		t := float64(ahora.UnixMilli()) / 1000
		esp.Mu.Lock()
		for _, v := range publicadas {
			// Lo que se ha escrito por una orden se queda como se dejó, igual que en un PLC.
			if k := claveSiemens(v.Nombre); !conLlave.fijadas[k] && !deCamara[k] {
				esp.Data[k] = valorSimulado(v, t)
			}
		}
		for _, c := range camaras {
			c.avanzar(esp.Data, ahora, ahora.Sub(anterior).Hours())
		}
		anterior = ahora
		esp.Mu.Unlock()
	}
	esp.Mu.Lock()
	for _, c := range camaras {
		c.iniciar(esp.Data)
	}
	esp.Mu.Unlock()
	poner()
	// Lo escrito antes de volver a arrancar el simulador sigue ahí, como en un autómata de verdad.
	esp.Mu.Lock()
	escritos.mu.Lock()
	for k, x := range escritos.m {
		if antes, ok := esp.Data[k]; ok && fmt.Sprintf("%T", antes) == fmt.Sprintf("%T", x) {
			esp.Data[k] = x
			conLlave.fijadas[k] = true
		}
	}
	escritos.mu.Unlock()
	esp.Mu.Unlock()
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

// Espacio de nombres del simulador que se puede leer y cambiar a la vez.
type espacioConLlave struct {
	*server.MapNamespace
	fijadas  map[string]bool    // escritas por una orden
	escritos *escritosSimulador // lo mismo, guardado en el programa para el siguiente arranque
}

type escritosSimulador struct {
	mu sync.Mutex
	m  map[string]any
}

// Una escritura en el PLC simulado: solo el valor, en una variable que exista y con su mismo tipo.
func (e *espacioConLlave) SetAttribute(n *ua.NodeID, a ua.AttributeID, v *ua.DataValue) ua.StatusCode {
	if a != ua.AttributeIDValue || v == nil || v.Value == nil {
		return ua.StatusBadNotWritable
	}
	e.Mu.Lock()
	defer e.Mu.Unlock()
	k := n.StringID()
	antes, ok := e.Data[k]
	if !ok {
		return ua.StatusBadNodeIDUnknown
	}
	nuevo := v.Value.Value()
	if fmt.Sprintf("%T", antes) != fmt.Sprintf("%T", nuevo) {
		return ua.StatusBadTypeMismatch
	}
	e.Data[k] = nuevo
	e.fijadas[k] = true
	e.escritos.mu.Lock()
	e.escritos.m[k] = nuevo
	e.escritos.mu.Unlock()
	return ua.StatusOK
}

func (e *espacioConLlave) Attribute(n *ua.NodeID, a ua.AttributeID) *ua.DataValue {
	e.Mu.RLock()
	defer e.Mu.RUnlock()
	return e.MapNamespace.Attribute(n, a)
}
