package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
)

// Elegir en la planta qué se lee: tras «Buscar variables» se marcan las que
// interesan de entre las que el PLC publica. La lista elegida manda en este
// ordenador y se propone a Gradiox, donde se acepta o se descarta.

// La lista de partida: la del panel si la hay, y si no, la de variables.csv. Con la llave echada.
func (a *App) listaBase() []Variable {
	if a.remota != nil && len(a.remota.Variables) > 0 {
		return a.remota.Variables
	}
	return a.locales
}

func (a *App) cargarElegidas() {
	if b, err := os.ReadFile(a.ruta("elegidas.json")); err == nil {
		var d struct {
			Variables []Variable `json:"variables"`
		}
		if json.Unmarshal(b, &d) == nil {
			a.elegidas = d.Variables
		}
	}
	if b, err := os.ReadFile(a.ruta("exploracion.json")); err == nil {
		var e Exploracion
		if json.Unmarshal(b, &e) == nil && len(e.Variables) > 0 {
			a.explorado = &e
		}
	}
	if b, err := os.ReadFile(a.ruta("propuesta.enviada")); err == nil {
		a.propuestaEnviada = strings.TrimSpace(string(b))
	}
}

// Empareja lo que publica el PLC con la lista de partida: devuelve, para cada
// hallada, el índice de su variable en la lista (o -1).
func emparejar(halladas []Hallada, base []Variable) []int {
	porNodo, porClave := map[string]int{}, map[string]int{}
	for i, b := range base {
		if b.Nodo != "" {
			porNodo[b.Nodo] = i
		} else if !sinNombreEnPLC(b) {
			porClave[claveSiemens(b.Nombre)] = i
		}
	}
	out := make([]int, len(halladas))
	for k, h := range halladas {
		out[k] = -1
		if i, ok := porNodo[h.Nodo]; ok {
			out[k] = i
		} else if i, ok := porClave[claveDe(h)]; ok && h.Nodo != "" {
			out[k] = i
		}
	}
	return out
}

// La parte de texto del nodo de una hallada (lo que va tras «s=»).
func claveDe(h Hallada) string {
	if h.cadena != "" {
		return h.cadena
	}
	if i := strings.Index(h.Nodo, ";s="); i >= 0 {
		return h.Nodo[i+3:]
	}
	return strings.TrimPrefix(h.Nodo, "s=")
}

type filaHallada struct {
	Hallada
	Grupo       string `json:"g,omitempty"`
	Descripcion string `json:"d,omitempty"`
	Unidad      string `json:"u,omitempty"`
	DeLaLista   bool   `json:"p"` // está en la lista de partida
	Marcada     bool   `json:"m"` // se está leyendo ahora
}

// Lo que enseña la página tras buscar.
func (a *App) resumenBusqueda() map[string]any {
	v := a.vigente()
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.explorado == nil {
		return map[string]any{"hay": false}
	}
	e, base := a.explorado, a.listaBase()
	pares := emparejar(e.Variables, base)
	leyendo := emparejar(e.Variables, v.Variables)
	encontrada := make([]bool, len(base))
	filas := make([]filaHallada, len(e.Variables))
	for k, h := range e.Variables {
		f := filaHallada{Hallada: h, Marcada: leyendo[k] >= 0}
		if i := pares[k]; i >= 0 {
			b := base[i]
			encontrada[i] = true
			f.Nombre, f.Grupo, f.Descripcion, f.Unidad, f.DeLaLista = b.Nombre, b.Grupo, b.Descripcion, b.Unidad, true
		}
		filas[k] = f
	}
	faltan, sinNombre := []string{}, []string{}
	for i, b := range base {
		if sinNombreEnPLC(b) {
			sinNombre = append(sinNombre, b.Nombre)
		} else if !encontrada[i] {
			faltan = append(faltan, b.Nombre)
		}
	}
	return map[string]any{
		"hay": true, "cuando": e.Cuando, "plc": e.PLC, "simulado": e.Simulado, "archivo": e.Archivo,
		"variables": filas, "lista": len(base), "faltan": faltan, "sinNombre": sinNombre,
	}
}

// Deja como lista de lectura las variables marcadas (por su nodo).
func (a *App) elegir(nodos []string) (int, error) {
	quiere := map[string]bool{}
	for _, n := range nodos {
		quiere[n] = true
	}
	a.mu.Lock()
	if a.explorado == nil {
		a.mu.Unlock()
		return 0, errors.New("primero hay que buscar las variables en el PLC")
	}
	base := a.listaBase()
	pares := emparejar(a.explorado.Variables, base)
	var lista []Variable
	for k, h := range a.explorado.Variables {
		// Una estructura o una lista entera no se lee bien: se leen sus partes.
		if !quiere[h.Nodo] || h.Bloqueo != "" {
			continue
		}
		if i := pares[k]; i >= 0 {
			lista = append(lista, base[i])
			continue
		}
		x := Variable{Nombre: h.Nombre, Tipo: h.Tipo, Grupo: strings.SplitN(h.Nombre, ".", 2)[0]}
		if !h.Deducible {
			x.Nodo = h.Nodo
		}
		lista = append(lista, x)
	}
	if len(lista) == 0 {
		a.mu.Unlock()
		return 0, errors.New("no hay ninguna variable marcada")
	}
	b, _ := json.Marshal(map[string]any{"variables": lista})
	if err := escribirEntero(a.ruta("elegidas.json"), b, 0o644); err != nil {
		a.mu.Unlock()
		return 0, err
	}
	a.elegidas = lista
	a.mu.Unlock()
	a.registrar("Lista elegida aquí: %d variables.", len(lista))
	a.avisarCambio()
	a.despertar()
	return len(lista), nil
}

func (a *App) quitarElegidas(motivo string) {
	a.mu.Lock()
	habia := len(a.elegidas) > 0
	a.elegidas = nil
	_ = os.Remove(a.ruta("elegidas.json"))
	a.mu.Unlock()
	if habia {
		a.registrar("%s", motivo)
		a.avisarCambio()
	}
}

func (a *App) despertar() {
	select {
	case a.despierta <- struct{}{}:
	default:
	}
}

// Lo que publica el PLC simulado: la lista de partida y, además, lo elegido.
func (a *App) paraSimular(leyendo []Variable) []Variable {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := append([]Variable(nil), a.listaBase()...)
	hay := map[string]bool{}
	for _, v := range out {
		hay[v.Nombre] = true
	}
	for _, v := range leyendo {
		if !hay[v.Nombre] {
			out = append(out, v)
		}
	}
	return out
}

func huellaLista(vars []Variable) string {
	h := sha256.New()
	for _, v := range vars {
		h.Write([]byte(v.Nombre + "\x00" + v.Nodo + "\n"))
	}
	return hex.EncodeToString(h.Sum(nil)[:12])
}

// Cuenta a Gradiox qué lista se está leyendo cuando no es la del panel, para
// que allí se pueda aceptar. Solo se envía cuando cambia.
func (a *App) proponer(ctx context.Context) error {
	v := a.vigente()
	if v.Origen != "elegidas" && v.Origen != "archivo" {
		return nil
	}
	huella := v.Origen + ":" + huellaLista(v.Variables)
	a.mu.Lock()
	enviada := a.propuestaEnviada
	a.mu.Unlock()
	if huella == enviada {
		return nil
	}
	resp, err := a.pedir(ctx, http.MethodPost, "/api/pasarela/propuesta", map[string]any{"origen": v.Origen, "variables": v.Variables})
	if err != nil {
		var en *errorNube
		if errors.As(err, &en) && (en.codigo == 404 || en.codigo == 405) {
			return nil // un servidor que aún no sabe de propuestas: no es un fallo
		}
		return err
	}
	resp.Body.Close()
	a.mu.Lock()
	a.propuestaEnviada = huella
	a.mu.Unlock()
	_ = os.WriteFile(a.ruta("propuesta.enviada"), []byte(huella), 0o644)
	a.registrar("Propuesta a Gradiox: la lista de %d variables que se está leyendo aquí.", len(v.Variables))
	return nil
}

// Cuando en el panel ya se ha decidido sobre la lista propuesta (aceptada o
// descartada), deja de mandar la elegida aquí y vuelve a regir la del panel.
func (a *App) atenderDecision(r *Remota) {
	a.mu.Lock()
	decidida := len(a.elegidas) > 0 && !r.Propuesta && a.propuestaEnviada == "elegidas:"+huellaLista(a.elegidas)
	a.mu.Unlock()
	if decidida {
		a.quitarElegidas("En Gradiox ya se ha decidido la lista: vuelve a regir la del panel.")
	}
}
