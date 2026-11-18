package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Cada cuánto se guarda y se entrega una foto completa aunque nada haya cambiado.
const cadaFoto = 15 * time.Minute

type huella struct {
	x any
	c string
}

// Recibe una vuelta de lectura. Deja los valores a la vista y apunta, en el
// archivo del día y en la cola de entrega, solo lo que ha cambiado.
func (a *App) anotar(vars []Variable, nuevos []Valor, ahora int64, leidas int) {
	a.mu.Lock()
	defer a.mu.Unlock()
	foto := time.Since(a.fotoEn) >= cadaFoto
	if foto {
		a.fotoEn = time.Now()
	}
	vivos := make(map[string]bool, len(vars))
	var lineas []string
	for i, v := range vars {
		n := nuevos[i]
		vivos[v.Nombre] = true
		a.valores[v.Nombre] = n
		antes, habia := a.enviados[v.Nombre].(huella)
		if !foto && habia && antes.x == n.X && antes.c == n.C {
			continue
		}
		a.enviados[v.Nombre] = huella{n.X, n.C}
		// Lo que no se puede leer se apunta una vez, no en cada foto.
		if n.C != "" && habia && antes.c == n.C {
			continue
		}
		a.cola = append(a.cola, Lectura{V: v.Nombre, T: ahora, X: n.X, C: n.C})
		lineas = append(lineas, fmt.Sprintf("%s;%s;%s;%s", time.UnixMilli(ahora).Format("2006-01-02 15:04:05"), v.Nombre, textoValor(n.X), n.C))
	}
	for k := range a.valores {
		if !vivos[k] {
			delete(a.valores, k)
			delete(a.enviados, k)
		}
	}
	a.recortarCola()
	a.plc.Ultima, a.plc.Leidas, a.plc.Total = ahora, leidas, len(vars)
	a.nube.Pendientes = len(a.cola)
	if len(lineas) > 0 {
		a.escribirDia(lineas)
		select {
		case a.despierta <- struct{}{}:
		default:
		}
	}
}

func textoValor(x any) string {
	switch v := x.(type) {
	case nil:
		return ""
	case bool:
		if v {
			return "1"
		}
		return "0"
	case float64:
		return strings.Replace(strconv.FormatFloat(v, 'f', -1, 64), ".", ",", 1)
	case string:
		return strings.NewReplacer(";", ",", "\n", " ", "\r", " ").Replace(v)
	}
	return fmt.Sprint(x)
}

// Un archivo por día, que se abre con Excel: fecha y hora; variable; valor; incidencia.
func (a *App) escribirDia(lineas []string) {
	ruta := a.ruta("lecturas", time.Now().Format("2006-01-02")+".csv")
	_, err := os.Stat(ruta)
	nuevo := err != nil
	f, err := os.OpenFile(ruta, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	if nuevo {
		w.WriteString("\xef\xbb\xbffecha y hora;variable;valor;incidencia\r\n")
	}
	for _, l := range lineas {
		w.WriteString(l + "\r\n")
	}
	w.Flush()
}
