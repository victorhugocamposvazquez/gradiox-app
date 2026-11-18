package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	// Autoridades de certificación de reserva, por si el ordenador de planta tiene las suyas sin actualizar.
	_ "golang.org/x/crypto/x509roots/fallback"
)

var clienteHTTP = &http.Client{Timeout: 40 * time.Second}

type errorNube struct {
	codigo  int
	mensaje string
}

func (e *errorNube) Error() string { return e.mensaje }

// El token solo viaja cifrado. Sin cifrar se admite únicamente hacia este mismo ordenador, para pruebas.
func nubeValida(nube string) error {
	u, err := url.Parse(nube)
	if err != nil || u.Host == "" {
		return errors.New("la dirección de Gradiox no es válida")
	}
	if u.Scheme == "https" {
		return nil
	}
	if u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost") {
		return nil
	}
	return errors.New("la dirección de Gradiox tiene que empezar por https://")
}

// Una petición a Gradiox con la identificación de esta instalación.
func (a *App) pedir(ctx context.Context, metodo, ruta string, cuerpo any) (*http.Response, error) {
	a.mu.Lock()
	c := a.cfg
	a.mu.Unlock()
	if c.Token == "" {
		return nil, errSinToken
	}
	if err := nubeValida(c.Nube); err != nil {
		return nil, err
	}
	var lector io.Reader
	if cuerpo != nil {
		b, err := json.Marshal(cuerpo)
		if err != nil {
			return nil, err
		}
		lector = bytes.NewReader(b)
	}
	pet, err := http.NewRequestWithContext(ctx, metodo, c.Nube+ruta, lector)
	if err != nil {
		return nil, err
	}
	pet.Header.Set("Authorization", "Bearer "+c.Token)
	pet.Header.Set("X-Gradiox-Protocolo", strconv.Itoa(protocolo))
	pet.Header.Set("X-Gradiox-Programa", version)
	pet.Header.Set("X-Gradiox-Plataforma", plataforma())
	pet.Header.Set("User-Agent", "gradiox-pasarela/"+version)
	if cuerpo != nil {
		pet.Header.Set("Content-Type", "application/json")
	}
	resp, err := clienteHTTP.Do(pet)
	if err != nil {
		return nil, errors.New("no se llega a Gradiox: no hay internet en este ordenador o un cortafuegos lo impide")
	}
	if resp.StatusCode >= 300 && resp.StatusCode != http.StatusNotModified {
		defer resp.Body.Close()
		var d struct {
			Error string `json:"error"`
		}
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		_ = json.Unmarshal(b, &d)
		if d.Error == "" {
			d.Error = fmt.Sprintf("Gradiox ha respondido %d", resp.StatusCode)
		}
		return nil, &errorNube{resp.StatusCode, d.Error}
	}
	return resp, nil
}

func (a *App) ponerNube(estado, detalle string) {
	a.mu.Lock()
	cambia := a.nube.Estado != estado || a.nube.Detalle != detalle
	a.nube.Estado, a.nube.Detalle = estado, detalle
	a.mu.Unlock()
	if cambia && detalle != "" {
		a.registrar("Gradiox: %s", detalle)
	}
}

func (a *App) falloNube(err error) {
	var en *errorNube
	switch {
	case errors.Is(err, errSinToken):
		a.ponerNube("sin-token", "")
	case errors.As(err, &en) && (en.codigo == 401 || en.codigo == 403):
		a.ponerNube("sin-permiso", en.mensaje)
	case errors.As(err, &en) && en.codigo == http.StatusUpgradeRequired:
		a.ponerNube("error", en.mensaje)
		a.buscarActualizacion(context.Background())
	default:
		a.ponerNube("error", mayuscula(err.Error()))
	}
}

// Trae del panel la configuración de esta instalación: dirección del PLC, ritmo y perfil de variables.
func (a *App) traerConfiguracion(ctx context.Context) error {
	a.mu.Lock()
	rev := ""
	if a.remota != nil {
		rev = a.remota.Revision
	}
	a.mu.Unlock()
	resp, err := a.pedir(ctx, http.MethodGet, "/api/pasarela/configuracion?revision="+url.QueryEscape(rev), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotModified {
		a.mu.Lock()
		if a.remota != nil {
			a.remota.Descargada = time.Now().UnixMilli()
		}
		a.mu.Unlock()
		return nil
	}
	var r Remota
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(&r); err != nil {
		return errors.New("la configuración recibida no se entiende")
	}
	if len(r.Variables) > 20000 {
		return errors.New("la configuración recibida trae demasiadas variables")
	}
	r.Descargada = time.Now().UnixMilli()
	b, _ := json.Marshal(r)
	_ = escribirEntero(a.ruta("remota.json"), b, 0o600)
	a.mu.Lock()
	a.remota = &r
	a.mu.Unlock()
	a.registrar("Configuración recibida del panel de Gradiox: «%s», %d variables.", r.Nombre, len(r.Variables))
	a.atenderDecision(&r)
	a.avisarCambio()
	return nil
}

const porEntrega = 2000

// Entrega lo pendiente por tandas. Lo que no llega se conserva y se reintenta.
func (a *App) entregar(ctx context.Context) error {
	for {
		a.mu.Lock()
		n := min(len(a.cola), porEntrega)
		tanda := append([]Lectura(nil), a.cola[:n]...)
		estado := map[string]any{
			"plc": a.plc.Estado, "detalle": a.plc.Detalle, "leidas": a.plc.Leidas, "total": a.plc.Total,
			"ultima": a.plc.Ultima, "simulado": a.cfg.Simulado, "pendientes": len(a.cola),
		}
		simulado := a.cfg.Simulado
		a.mu.Unlock()
		resp, err := a.pedir(ctx, http.MethodPost, "/api/pasarela/lecturas", map[string]any{"estado": estado, "simulado": simulado, "lecturas": tanda})
		if err != nil {
			return err
		}
		var d struct {
			Revision string `json:"revision"`
		}
		_ = json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&d)
		resp.Body.Close()
		a.mu.Lock()
		// Mientras se entregaba pueden haber entrado más por detrás, o haberse recortado por delante.
		if n > 0 && len(a.cola) >= n && a.cola[0] == tanda[0] && a.cfg.Simulado == simulado {
			a.cola = append([]Lectura(nil), a.cola[n:]...)
		}
		a.nube.Entregadas += int64(n)
		a.nube.Pendientes = len(a.cola)
		a.nube.Ultima = time.Now().UnixMilli()
		quedan := len(a.cola)
		rev := ""
		if a.remota != nil {
			rev = a.remota.Revision
		}
		a.guardarPendientes()
		a.mu.Unlock()
		if d.Revision != "" && d.Revision != rev {
			if err := a.traerConfiguracion(ctx); err != nil {
				return err
			}
		}
		if quedan == 0 {
			return nil
		}
	}
}

func (a *App) cicloNube(ctx context.Context) {
	var ultimaConfig, ultimoGuardado time.Time
	tokenAntes := ""
	for {
		a.mu.Lock()
		token := a.cfg.Token
		if token != tokenAntes {
			// Con otro token es otra instalación: lo recibido con el anterior ya no vale.
			if tokenAntes != "" || token == "" {
				a.remota = nil
			}
			ultimaConfig = time.Time{}
		}
		a.mu.Unlock()
		tokenAntes = token
		if token == "" {
			a.ponerNube("sin-token", "")
		} else {
			var err error
			if time.Since(ultimaConfig) > 5*time.Minute {
				if err = a.traerConfiguracion(ctx); err == nil {
					ultimaConfig = time.Now()
				}
			}
			if err == nil {
				err = a.proponer(ctx)
			}
			if err == nil {
				err = a.entregar(ctx)
			}
			if err != nil {
				a.falloNube(err)
			} else {
				a.ponerNube("bien", "")
			}
		}
		if time.Since(ultimoGuardado) > time.Minute {
			a.mu.Lock()
			a.guardarPendientes()
			a.mu.Unlock()
			ultimoGuardado = time.Now()
		}
		espera := 30 * time.Second
		a.mu.Lock()
		if a.nube.Estado == "sin-permiso" {
			espera = 5 * time.Minute
		}
		a.mu.Unlock()
		limite := time.Now().Add(espera)
	esperar:
		for time.Now().Before(limite) {
			select {
			case <-ctx.Done():
				return
			case <-a.despierta:
				if espera > time.Minute {
					continue // sin permiso no se insiste a cada lectura
				}
				// Se deja juntar un poco para no entregar a cada lectura.
				select {
				case <-ctx.Done():
					return
				case <-time.After(5 * time.Second):
				}
				break esperar
			case <-time.After(2 * time.Second):
				a.mu.Lock()
				otro := a.cfg.Token != tokenAntes
				a.mu.Unlock()
				if otro {
					break esperar
				}
			}
		}
	}
}

func textoCorto(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return s[:n]
	}
	return s
}
