package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gopcua/opcua/ua"
)

// Órdenes de Gradiox al PLC. Hacen falta dos llaves: la escritura activada para
// esta instalación en el panel de Gradiox y «Permitir órdenes» marcado aquí, en
// el propio ordenador de la planta. Con cualquiera de las dos quitada, el
// programa no escribe nada. Cada orden se vuelve a comprobar aquí contra la
// lista y los límites recibidos del panel, se escribe solo esa variable y se
// lee después para saber si el PLC la ha aceptado.

type Escribible struct {
	Nombre string   `json:"n"`
	SiNo   bool     `json:"sino"`
	Min    *float64 `json:"min,omitempty"`
	Max    *float64 `json:"max,omitempty"`
}

type Escritura struct {
	Activa    bool         `json:"activa"`
	Variables []Escribible `json:"variables"`
}

type ordenRecibida struct {
	ID     string `json:"id"`
	Nombre string `json:"n"`
	Valor  any    `json:"valor"`
	Pedida int64  `json:"pedida"`
	// Solo desde este equipo: vuelve al valor que tenía el autómata antes de una
	// escritura de prueba. Puede quedar fuera de los límites, porque era el suyo.
	restaura bool
}

type resultadoOrden struct {
	ID       string `json:"id"`
	Estado   string `json:"estado"` // hecha | rechazada
	Motivo   string `json:"motivo,omitempty"`
	Antes    any    `json:"antes,omitempty"`
	Leido    any    `json:"leido,omitempty"`
	Simulada bool   `json:"simulada,omitempty"`
}

// Una orden que llega más tarde que esto no se ejecuta: lo que se pidió puede no tener ya sentido.
const ordenVieja = 5 * time.Minute

// Las dos llaves y la lista con la que se comprueba cada orden.
func (a *App) llaves() (bool, bool, []Escribible) {
	a.mu.Lock()
	defer a.mu.Unlock()
	aqui := a.cfg.Ordenes
	panel := a.remota != nil && a.remota.Escritura.Activa
	var lista []Escribible
	if a.remota != nil {
		lista = a.remota.Escritura.Variables
	}
	return aqui, panel, lista
}

func (a *App) cicloOrdenes(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
		aqui, panel, _ := a.llaves()
		a.mu.Lock()
		hayToken, conectado := a.cfg.Token != "", a.plc.Estado == "conectado"
		a.mu.Unlock()
		if !aqui || !panel || !hayToken || !conectado {
			continue
		}
		if err := a.atenderOrdenes(ctx); err != nil && ctx.Err() == nil {
			a.registrar("Órdenes: %s", err)
		}
	}
}

func (a *App) atenderOrdenes(ctx context.Context) error {
	resp, err := a.pedir(ctx, http.MethodGet, "/api/pasarela/ordenes", nil)
	if err != nil {
		var en *errorNube
		if errors.As(err, &en) && (en.codigo == 404 || en.codigo == 405) {
			return nil
		}
		return err
	}
	var d struct {
		Activa  bool            `json:"activa"`
		Ordenes []ordenRecibida `json:"ordenes"`
	}
	err = json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&d)
	resp.Body.Close()
	if err != nil || !d.Activa || len(d.Ordenes) == 0 {
		return nil
	}
	if len(d.Ordenes) > 20 {
		d.Ordenes = d.Ordenes[:20]
	}
	resultados := a.ejecutar(ctx, d.Ordenes)
	resp, err = a.pedir(ctx, http.MethodPost, "/api/pasarela/ordenes", map[string]any{"resultados": resultados})
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// Comprueba una orden contra lo que este ordenador sabe del panel. Devuelve el motivo si no vale.
func comprobarOrden(o ordenRecibida, lista []Escribible, vigentes []Variable, ahora time.Time) (Escribible, string) {
	var e *Escribible
	for i := range lista {
		if lista[i].Nombre == o.Nombre {
			e = &lista[i]
		}
	}
	if e == nil {
		return Escribible{}, "No está entre las variables que se pueden cambiar"
	}
	leida := false
	for _, v := range vigentes {
		if v.Nombre == o.Nombre {
			leida = true
		}
	}
	if !leida {
		return *e, "No está en la lista que lee este programa"
	}
	if o.Pedida > 0 && ahora.Sub(time.UnixMilli(o.Pedida)) > ordenVieja {
		return *e, "Ha llegado demasiado tarde"
	}
	switch x := o.Valor.(type) {
	case bool:
		if !e.SiNo {
			return *e, "Esa variable es un número"
		}
	case float64:
		if e.SiNo {
			return *e, "Esa variable es de sí o no"
		}
		if math.IsNaN(x) || math.IsInf(x, 0) || (!o.restaura && ((e.Min != nil && x < *e.Min) || (e.Max != nil && x > *e.Max))) {
			return *e, "Fuera de los límites"
		}
	default:
		return *e, "El valor no se entiende"
	}
	return *e, ""
}

// Pone el valor pedido con el mismo tipo que tiene la variable en el PLC: un S7-1500 no convierte.
func comoEnPLC(actual *ua.Variant, valor any) (any, error) {
	if actual == nil {
		return nil, errors.New("no se sabe de qué tipo es en el PLC")
	}
	if b, ok := valor.(bool); ok {
		if _, ok := actual.Value().(bool); ok {
			return b, nil
		}
		return nil, errors.New("en el PLC no es de sí o no")
	}
	x := valor.(float64)
	entero := func(min, max float64) (float64, error) {
		if x != math.Trunc(x) {
			return 0, errors.New("en el PLC es un número entero")
		}
		if x < min || x > max {
			return 0, errors.New("no cabe en la variable del PLC")
		}
		return x, nil
	}
	switch actual.Value().(type) {
	case float32:
		return float32(x), nil
	case float64:
		return x, nil
	case int16:
		n, err := entero(math.MinInt16, math.MaxInt16)
		return int16(n), err
	case int32:
		n, err := entero(math.MinInt32, math.MaxInt32)
		return int32(n), err
	case uint16:
		n, err := entero(0, math.MaxUint16)
		return uint16(n), err
	case uint32:
		n, err := entero(0, math.MaxUint32)
		return uint32(n), err
	case int8:
		n, err := entero(math.MinInt8, math.MaxInt8)
		return int8(n), err
	case uint8:
		n, err := entero(0, math.MaxUint8)
		return uint8(n), err
	}
	return nil, fmt.Errorf("este programa no sabe escribir ese tipo (%T)", actual.Value())
}

func (a *App) ejecutar(ctx context.Context, ordenes []ordenRecibida) []resultadoOrden {
	v := a.vigente()
	if v.Simulado {
		v.Variables = sinNodo(v.Variables)
	}
	_, _, lista := a.llaves()
	out := make([]resultadoOrden, 0, len(ordenes))
	rechazar := func(o ordenRecibida, motivo string) {
		out = append(out, resultadoOrden{ID: o.ID, Estado: "rechazada", Motivo: motivo, Simulada: v.Simulado})
		a.registrar("Orden rechazada: %s = %v. %s.", o.Nombre, o.Valor, motivo)
		a.apuntarOrden(o, "rechazada", motivo, nil, nil, v.Simulado)
	}
	var validas []ordenRecibida
	for _, o := range ordenes {
		if _, motivo := comprobarOrden(o, lista, v.Variables, time.Now()); motivo != "" {
			rechazar(o, motivo)
			continue
		}
		validas = append(validas, o)
	}
	if len(validas) == 0 {
		return out
	}
	if v.Simulado {
		a.mu.Lock()
		v.PLC = a.plc.Direccion
		a.mu.Unlock()
		v.Usuario, v.Clave, v.Seguridad = "", "", "ninguna"
	}
	ctxC, cancelar := context.WithTimeout(ctx, 30*time.Second)
	defer cancelar()
	c, _, err := a.conectar(ctxC, v)
	if err != nil {
		// Si la lectura se acaba de reconectar (cambio de configuración), se espera un poco y se prueba otra vez.
		select {
		case <-ctxC.Done():
		case <-time.After(4 * time.Second):
		}
		if v.Simulado {
			a.mu.Lock()
			v.PLC = a.plc.Direccion
			a.mu.Unlock()
		}
		c, _, err = a.conectar(ctxC, v)
	}
	if err != nil {
		for _, o := range validas {
			rechazar(o, "No se llega al PLC: "+err.Error())
		}
		return out
	}
	defer func() {
		cierre, fin := context.WithTimeout(context.Background(), 3*time.Second)
		_ = c.Close(cierre)
		fin()
	}()
	var ns uint16 = 3
	if l, err := c.NamespaceArray(ctxC); err == nil {
		for i, n := range l {
			if n == espacioSiemens {
				ns = uint16(i)
			}
		}
	}
	porNombre := map[string]Variable{}
	for _, x := range v.Variables {
		porNombre[x.Nombre] = x
	}
	leer := func(nodo *ua.NodeID) (*ua.Variant, error) {
		r, err := c.Read(ctxC, &ua.ReadRequest{NodesToRead: []*ua.ReadValueID{{NodeID: nodo, AttributeID: ua.AttributeIDValue}}, TimestampsToReturn: ua.TimestampsToReturnNeither})
		if err != nil {
			return nil, errors.New(explicar(err))
		}
		if len(r.Results) != 1 {
			return nil, errors.New("el PLC no ha respondido")
		}
		if q := calidad(r.Results[0].Status); q != "" {
			return nil, errors.New(q)
		}
		return r.Results[0].Value, nil
	}
	for _, o := range validas {
		x := porNombre[o.Nombre]
		if sinNombreEnPLC(x) {
			rechazar(o, "No tiene nombre en el PLC")
			continue
		}
		nodo, err := nodoDe(x, ns)
		if err != nil {
			rechazar(o, "Nodo mal escrito")
			continue
		}
		actual, err := leer(nodo)
		if err != nil {
			rechazar(o, "No se ha podido leer antes de escribir: "+err.Error())
			continue
		}
		antes, _ := simple(actual)
		valor, err := comoEnPLC(actual, o.Valor)
		if err != nil {
			rechazar(o, mayuscula(err.Error()))
			continue
		}
		variante, err := ua.NewVariant(valor)
		if err != nil {
			rechazar(o, "El valor no se puede enviar")
			continue
		}
		w, err := c.Write(ctxC, &ua.WriteRequest{NodesToWrite: []*ua.WriteValue{{
			NodeID: nodo, AttributeID: ua.AttributeIDValue,
			Value: &ua.DataValue{EncodingMask: ua.DataValueValue, Value: variante},
		}}})
		if err != nil {
			rechazar(o, "No se ha podido escribir: "+explicar(err))
			continue
		}
		if len(w.Results) != 1 || w.Results[0] != ua.StatusOK {
			motivo := "El PLC no la ha aceptado"
			if len(w.Results) == 1 {
				switch w.Results[0] {
				case ua.StatusBadNotWritable, ua.StatusBadUserAccessDenied:
					motivo = "El PLC no deja escribir esa variable"
				case ua.StatusBadTypeMismatch:
					motivo = "El PLC no acepta ese tipo de valor"
				case ua.StatusBadOutOfRange:
					motivo = "El PLC dice que está fuera de rango"
				default:
					motivo += ": " + strings.TrimPrefix(w.Results[0].Error(), "Status")
				}
			}
			rechazar(o, motivo)
			continue
		}
		despues, err := leer(nodo)
		var leido any
		if err == nil {
			leido, _ = simple(despues)
		}
		r := resultadoOrden{ID: o.ID, Estado: "hecha", Antes: antes, Leido: leido, Simulada: v.Simulado}
		out = append(out, r)
		a.registrar("Orden hecha: %s pasa de %v a %v%s.", o.Nombre, antes, leido, map[bool]string{true: " (PLC simulado)", false: ""}[v.Simulado])
		a.apuntarOrden(o, "hecha", "", antes, leido, v.Simulado)
	}
	return out
}

// Deja constancia en este ordenador de cada orden, se haga o no.
func (a *App) apuntarOrden(o ordenRecibida, estado, motivo string, antes, leido any, simulada bool) {
	nuevo := false
	ruta := a.ruta("ordenes.csv")
	if _, err := os.Stat(ruta); err != nil {
		nuevo = true
	}
	f, err := os.OpenFile(ruta, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	if nuevo {
		fmt.Fprint(f, "\xef\xbb\xbffecha;variable;pedido;antes;leído después;estado;motivo;simulado\r\n")
	}
	texto := func(x any) string {
		if x == nil {
			return ""
		}
		return fmt.Sprint(x)
	}
	fmt.Fprintf(f, "%s;%s;%s;%s;%s;%s;%s;%s\r\n", time.Now().Format("2006-01-02 15:04:05"), celdaCSV(o.Nombre), texto(o.Valor), texto(antes), texto(leido), estado, celdaCSV(motivo), siNo(simulada))
}
