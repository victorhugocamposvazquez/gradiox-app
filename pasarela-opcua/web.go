package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

//go:embed pagina.html
var pagina string

const puertoFijo = "127.0.0.1:4841"
const paginaFija = "http://" + puertoFijo + "/"

// Dice si ya hay una pasarela abierta en este ordenador.
func yaEnMarcha() bool {
	c := &http.Client{Timeout: 1500 * time.Millisecond}
	resp, err := c.Get(paginaFija + "api/quien")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var d struct {
		Programa string `json:"programa"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 1024)).Decode(&d)
	return d.Programa == "gradiox-pasarela"
}

// La página solo se sirve a este mismo ordenador.
func (a *App) servirPagina(ctx context.Context) (string, error) {
	var l net.Listener
	var err error
	// Puerto fijo para que la dirección sea siempre la misma; si está ocupado, uno libre.
	for _, dir := range []string{puertoFijo, "127.0.0.1:0"} {
		if l, err = net.Listen("tcp", dir); err == nil {
			break
		}
	}
	if err != nil {
		return "", err
	}
	anfitrion := l.Addr().String()
	puerto := anfitrion[strings.LastIndex(anfitrion, ":"):]
	mux := http.NewServeMux()
	// Solo se atiende si se pide por la dirección local, y las órdenes solo con la clave que lleva la página.
	guardia := func(conClave bool, h http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if r.Host != "127.0.0.1"+puerto && r.Host != "localhost"+puerto {
				http.Error(w, "No", http.StatusForbidden)
				return
			}
			if conClave && r.Header.Get("X-Gradiox-Clave") != a.clavePag {
				http.Error(w, "No", http.StatusForbidden)
				return
			}
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			h(w, r)
		}
	}
	mux.HandleFunc("GET /{$}", guardia(false, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Security-Policy", "default-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
		fmt.Fprint(w, strings.Replace(pagina, "{{CLAVE}}", a.clavePag, 1))
	}))
	mux.HandleFunc("GET /api/estado", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		responder(w, a.estado())
	}))
	mux.HandleFunc("POST /api/config", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		var d struct {
			PLC          *string `json:"plc"`
			Usuario      *string `json:"usuario"`
			Clave        *string `json:"clave"`
			Seguridad    *string `json:"seguridad"`
			CadaSegundos *int    `json:"cadaSegundos"`
			Token        *string `json:"token"`
			Simulado     *bool   `json:"simulado"`
			Ordenes      *bool   `json:"ordenes"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&d); err != nil {
			http.Error(w, "No se entiende", http.StatusBadRequest)
			return
		}
		a.mu.Lock()
		c := a.cfg
		a.mu.Unlock()
		// Lo que no viene se deja como estaba: así la página no tiene que conocer la contraseña ni el token.
		if d.PLC != nil {
			c.PLC = *d.PLC
		}
		if d.Usuario != nil {
			c.Usuario = *d.Usuario
		}
		if d.Clave != nil {
			c.Clave = *d.Clave
		}
		if d.Seguridad != nil {
			c.Seguridad = *d.Seguridad
		}
		if d.CadaSegundos != nil {
			c.CadaSegundos = *d.CadaSegundos
		}
		if d.Token != nil {
			c.Token = *d.Token
		}
		if d.Simulado != nil {
			c.Simulado = *d.Simulado
		}
		if d.Ordenes != nil && *d.Ordenes != c.Ordenes {
			c.Ordenes = *d.Ordenes
			a.registrar("Órdenes de Gradiox %s en este ordenador.", map[bool]string{true: "permitidas", false: "no permitidas"}[c.Ordenes])
		}
		if err := a.guardarConfig(c); err != nil {
			http.Error(w, "No se ha podido guardar", http.StatusInternalServerError)
			return
		}
		responder(w, a.estado())
	}))
	mux.HandleFunc("POST /api/explorar", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		ctxE, cancelar := context.WithTimeout(r.Context(), 3*time.Minute)
		defer cancelar()
		if _, err := a.explorar(ctxE); err != nil {
			responder(w, map[string]any{"error": mayuscula(err.Error())})
			return
		}
		responder(w, a.resumenBusqueda())
	}))
	mux.HandleFunc("GET /api/exploracion", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		responder(w, a.resumenBusqueda())
	}))
	mux.HandleFunc("POST /api/elegir", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		var d struct {
			Nodos  []string `json:"nodos"`
			Quitar bool     `json:"quitar"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&d); err != nil {
			http.Error(w, "No se entiende", http.StatusBadRequest)
			return
		}
		if d.Quitar {
			a.quitarElegidas("Se deja la lista elegida aquí: vuelve a regir la de Gradiox o la del archivo.")
			responder(w, map[string]any{"elegidas": 0})
			return
		}
		n, err := a.elegir(d.Nodos)
		if err != nil {
			responder(w, map[string]any{"error": mayuscula(err.Error())})
			return
		}
		responder(w, map[string]any{"elegidas": n})
	}))
	mux.HandleFunc("GET /api/quien", guardia(false, func(w http.ResponseWriter, r *http.Request) {
		responder(w, map[string]any{"programa": "gradiox-pasarela"})
	}))
	mux.HandleFunc("POST /api/cerrar", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		responder(w, map[string]any{"cerrando": true})
		a.registrar("Se ha pedido cerrar el programa desde la página.")
		go func() {
			time.Sleep(300 * time.Millisecond)
			a.parar()
		}()
	}))
	mux.HandleFunc("POST /api/actualizar", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		a.mu.Lock()
		hayToken := a.cfg.Token != ""
		a.mu.Unlock()
		if !hayToken {
			http.Error(w, "Hace falta el token de Gradiox para actualizar.", http.StatusConflict)
			return
		}
		a.registrar("Se ha pedido actualizar desde la página.")
		go a.buscarActualizacion(context.Background())
		responder(w, map[string]any{"buscando": true})
	}))
	mux.HandleFunc("POST /api/arranque", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		var d struct {
			Activo bool `json:"activo"`
		}
		if json.NewDecoder(io.LimitReader(r.Body, 1024)).Decode(&d) != nil {
			http.Error(w, "No se entiende.", http.StatusBadRequest)
			return
		}
		if err := ponerArranque(d.Activo); err != nil {
			http.Error(w, mayuscula(err.Error())+".", http.StatusConflict)
			return
		}
		if d.Activo {
			a.registrar("El programa se abrirá solo al encender el ordenador.")
		} else {
			a.registrar("El programa ya no se abrirá solo al encender el ordenador.")
		}
		responder(w, map[string]any{"activo": d.Activo})
	}))
	mux.HandleFunc("POST /api/carpeta", guardia(true, func(w http.ResponseWriter, r *http.Request) {
		abrirCarpeta(a.datos)
		responder(w, map[string]any{"carpeta": a.datos})
	}))
	srv := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() { _ = srv.Serve(l) }()
	go func() {
		<-ctx.Done()
		cierre, cancelar := context.WithTimeout(context.Background(), 2*time.Second)
		_ = srv.Shutdown(cierre)
		cancelar()
	}()
	return "http://" + anfitrion + "/", nil
}

func responder(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

type filaEstado struct {
	Variable
	Valor
}

func (a *App) estado() map[string]any {
	v := a.vigente()
	a.mu.Lock()
	defer a.mu.Unlock()
	filas := make([]filaEstado, 0, len(v.Variables))
	for _, x := range v.Variables {
		x.Nodo = ""
		filas = append(filas, filaEstado{x, a.valores[x.Nombre]})
	}
	instalacion, delPanel := "", map[string]any{}
	if a.remota != nil {
		instalacion = a.remota.Nombre
		delPanel = map[string]any{"plc": a.remota.PLC, "cadaSegundos": a.remota.CadaSegundos, "caduca": a.remota.Caduca, "descargada": a.remota.Descargada}
	}
	nube := a.nube
	nube.Pendientes = len(a.cola)
	return map[string]any{
		"version": version, "plataforma": plataforma(), "ahora": time.Now().UnixMilli(),
		"plc": a.plc, "nube": nube, "aviso": a.aviso, "carpeta": a.datos,
		"arranque": map[string]any{"posible": rutaArranque() != "", "activo": arranqueActivo()},
		"actualizacion": map[string]any{"nueva": a.nuevaVersion, "fallo": a.falloVersion, "enCurso": a.actualizando},
		"instalacion": instalacion, "panel": delPanel, "origen": v.Origen, "perfil": v.Perfil,
		"config": map[string]any{
			"plc": a.cfg.PLC, "plcVigente": v.PLC, "usuario": a.cfg.Usuario, "hayClave": a.cfg.Clave != "",
			"seguridad": a.cfg.Seguridad, "cadaSegundos": a.cfg.CadaSegundos, "cadaVigente": v.CadaSegundos,
			"hayToken": a.cfg.Token != "", "simulado": a.cfg.Simulado, "ordenes": a.cfg.Ordenes,
		},
		"variables": filas,
		"elegidas":  len(a.elegidas), "propuesta": a.propuestaEnviada != "" && v.Origen != "panel",
		"busqueda":     a.explorado != nil,
		"ordenesPanel": a.remota != nil && a.remota.Escritura.Activa, "escribibles": escribibles(a.remota),
		"registro": append([]string(nil), a.registro...),
	}
}

func abrirNavegador(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func abrirCarpeta(ruta string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", ruta)
	case "windows":
		cmd = exec.Command("explorer", ruta)
	default:
		cmd = exec.Command("xdg-open", ruta)
	}
	_ = cmd.Start()
}

func escribibles(r *Remota) int {
	if r == nil {
		return 0
	}
	return len(r.Escritura.Variables)
}
