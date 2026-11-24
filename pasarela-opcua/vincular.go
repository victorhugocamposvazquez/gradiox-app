package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"time"
)

var codigoValido = regexp.MustCompile(`^\d{6}$`)

// Cambia el código de conexión de 6 cifras (sacado en el panel) por el token
// de la instalación. Así nadie tiene que copiar ni pegar el token a mano.
func (a *App) vincular(ctx context.Context, codigo string) (string, error) {
	if !codigoValido.MatchString(codigo) {
		return "", errors.New("el código de conexión tiene 6 cifras")
	}
	a.mu.Lock()
	c := a.cfg
	anterior := ""
	if a.remota != nil {
		anterior = a.remota.Nombre
	}
	a.mu.Unlock()
	if err := nubeValida(c.Nube); err != nil {
		return "", err
	}
	b, _ := json.Marshal(map[string]string{"codigo": codigo})
	pet, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Nube+"/api/pasarela/vincular", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	pet.Header.Set("Content-Type", "application/json")
	pet.Header.Set("X-Gradiox-Protocolo", strconv.Itoa(protocolo))
	pet.Header.Set("X-Gradiox-Programa", version)
	pet.Header.Set("X-Gradiox-Plataforma", plataforma())
	pet.Header.Set("User-Agent", "gradiox-pasarela/"+version)
	resp, err := clienteHTTP.Do(pet)
	if err != nil {
		return "", errors.New("no se llega a Gradiox: este equipo no tiene acceso a internet o un cortafuegos lo impide")
	}
	defer resp.Body.Close()
	var d struct {
		Token  string `json:"token"`
		Nombre string `json:"nombre"`
		Error  string `json:"error"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&d)
	if resp.StatusCode == http.StatusNotFound && d.Error == "" {
		return "", errors.New("la plataforma todavía no admite códigos de conexión: use el token de acceso")
	}
	if resp.StatusCode != http.StatusOK || d.Token == "" {
		if d.Error == "" {
			d.Error = fmt.Sprintf("Gradiox ha respondido %d", resp.StatusCode)
		}
		return "", errors.New(d.Error)
	}
	// Otra instalación: lo elegido aquí para la anterior no se le propone a esta.
	if anterior != "" && anterior != d.Nombre {
		a.quitarElegidas("Vinculada a otra instalación: se deja la selección de la anterior.")
		a.mu.Lock()
		a.remota = nil
		a.mu.Unlock()
	}
	c.Token = d.Token
	if err := a.guardarConfig(c); err != nil {
		return "", errors.New("no se ha podido guardar en este equipo")
	}
	a.registrar("Vinculada a «%s» con código de conexión.", d.Nombre)
	a.despertar()
	return d.Nombre, nil
}

// Escritura de prueba desde la propia pasarela (apartado «Probar»). Pasa por
// las mismas comprobaciones que una orden del panel: las dos autorizaciones,
// la lista de variables escribibles y sus límites. Si se pide, vuelve sola al
// valor de antes pasados unos minutos.
func (a *App) escribirPrueba(ctx context.Context, nombre string, valor any, volverMin int) (resultadoOrden, error) {
	aqui, panel, _ := a.llaves()
	if !panel {
		return resultadoOrden{}, errors.New("la escritura no está autorizada en la plataforma para esta instalación")
	}
	if !aqui {
		return resultadoOrden{}, errors.New("falta la autorización de escritura en este equipo (apartado «Órdenes»)")
	}
	if volverMin < 0 || volverMin > 240 {
		return resultadoOrden{}, errors.New("el retorno automático va de 1 a 240 minutos")
	}
	o := ordenRecibida{ID: fmt.Sprintf("local-%d", time.Now().UnixNano()), Nombre: nombre, Valor: valor, Pedida: time.Now().UnixMilli()}
	r := a.ejecutar(ctx, []ordenRecibida{o})
	if len(r) != 1 {
		return resultadoOrden{}, errors.New("no se ha podido escribir")
	}
	res := r[0]
	if res.Estado != "hecha" {
		return res, nil
	}
	antes, ok := comoValorOrden(res.Antes)
	a.mu.Lock()
	defer a.mu.Unlock()
	if t := a.retornos[nombre]; t != nil {
		t.Stop()
		delete(a.retornos, nombre)
	}
	if a.antesPrueba == nil {
		a.antesPrueba = map[string]any{}
	}
	// Si ya había una prueba sin devolver, el valor al que se vuelve sigue siendo el original.
	if _, hay := a.antesPrueba[nombre]; !hay && ok {
		a.antesPrueba[nombre] = antes
	}
	if volverMin == 0 {
		return res, nil
	}
	if a.retornos == nil {
		a.retornos = map[string]*time.Timer{}
	}
	a.retornos[nombre] = time.AfterFunc(time.Duration(volverMin)*time.Minute, func() {
		ctxR, fin := context.WithTimeout(context.Background(), time.Minute)
		defer fin()
		a.registrar("Retorno automático de %s al valor de antes.", nombre)
		_, _ = a.restaurarPrueba(ctxR, nombre)
	})
	return res, nil
}

// Devuelve una variable al valor que tenía antes de las escrituras de prueba.
// Sigue pidiendo las dos llaves, pero no los límites: ese valor era el del autómata.
func (a *App) restaurarPrueba(ctx context.Context, nombre string) (resultadoOrden, error) {
	a.mu.Lock()
	antes, hay := a.antesPrueba[nombre]
	if t := a.retornos[nombre]; t != nil {
		t.Stop()
		delete(a.retornos, nombre)
	}
	a.mu.Unlock()
	if !hay {
		return resultadoOrden{}, errors.New("no hay ninguna escritura de prueba que deshacer en esta variable")
	}
	aqui, panel, _ := a.llaves()
	if !panel || !aqui {
		return resultadoOrden{}, errors.New("la escritura ya no está autorizada: el valor se queda como está")
	}
	o := ordenRecibida{ID: fmt.Sprintf("local-retorno-%d", time.Now().UnixNano()), Nombre: nombre, Valor: antes, Pedida: time.Now().UnixMilli(), restaura: true}
	r := a.ejecutar(ctx, []ordenRecibida{o})
	if len(r) != 1 {
		return resultadoOrden{}, errors.New("no se ha podido escribir")
	}
	if r[0].Estado == "hecha" {
		a.mu.Lock()
		delete(a.antesPrueba, nombre)
		a.mu.Unlock()
	}
	return r[0], nil
}

// Pasa un valor leído del autómata a lo que entiende una orden: sí/no o número.
func comoValorOrden(x any) (any, bool) {
	switch v := x.(type) {
	case bool:
		return v, true
	case float64:
		return v, !math.IsNaN(v) && !math.IsInf(v, 0)
	case float32:
		return float64(v), true
	case int:
		return float64(v), true
	case int8:
		return float64(v), true
	case int16:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint8:
		return float64(v), true
	case uint16:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	}
	return nil, false
}
