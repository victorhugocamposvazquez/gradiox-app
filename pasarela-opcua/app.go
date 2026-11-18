package main

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Lo que se guarda en este ordenador. La contraseña del PLC no sale nunca de aquí.
type Config struct {
	PLC          string `json:"plc"`
	Usuario      string `json:"usuario"`
	Clave        string `json:"clave"`
	Seguridad    string `json:"seguridad"` // auto | ninguna | cifrada
	CadaSegundos int    `json:"cadaSegundos"`
	Nube         string `json:"nube"`
	Token        string `json:"token"`
	Simulado     bool   `json:"simulado"`
}

type Variable struct {
	Nombre      string `json:"n"`
	Grupo       string `json:"g,omitempty"`
	Tipo        string `json:"tipo,omitempty"`
	Descripcion string `json:"d,omitempty"`
	Unidad      string `json:"u,omitempty"`
	// Identificador en el servidor OPC UA. Vacío: se deduce del nombre.
	Nodo string `json:"nodo,omitempty"`
}

// Lo que manda el panel de Gradiox para esta instalación.
type Remota struct {
	Nombre       string     `json:"nombre"`
	PLC          string     `json:"plc"`
	CadaSegundos int        `json:"cadaSegundos"`
	Perfil       string     `json:"perfil"`
	Variables    []Variable `json:"variables"`
	Caduca       int64      `json:"caduca"`
	Revision     string     `json:"revision"`
	// Hay en el panel una lista propuesta por este programa, pendiente de decidir.
	Propuesta  bool  `json:"propuesta"`
	Descargada int64 `json:"descargada"`
}

type Valor struct {
	X any    `json:"x"`
	C string `json:"c"` // "" si la lectura es buena; si no, el motivo
	T int64  `json:"t"`
}

type Lectura struct {
	V string `json:"v"`
	T int64  `json:"t"`
	X any    `json:"x"`
	C string `json:"c,omitempty"`
}

type EstadoPLC struct {
	Estado    string `json:"estado"` // parado | conectando | conectado | error
	Detalle   string `json:"detalle"`
	Direccion string `json:"direccion"`
	Seguridad string `json:"seguridad"`
	Ultima    int64  `json:"ultima"`
	Leidas    int    `json:"leidas"`
	Total     int    `json:"total"`
}

type EstadoNube struct {
	Estado     string `json:"estado"` // sin-token | bien | error | sin-permiso
	Detalle    string `json:"detalle"`
	Ultima     int64  `json:"ultima"`
	Pendientes int    `json:"pendientes"`
	Entregadas int64  `json:"entregadas"`
}

type App struct {
	base, datos string

	mu        sync.Mutex
	cfg       Config
	remota    *Remota
	locales   []Variable
	elegidas  []Variable   // lista elegida aquí con «Buscar variables»
	explorado *Exploracion // última búsqueda en el PLC
	// Huella de la última lista propuesta a Gradiox.
	propuestaEnviada string
	valores          map[string]Valor
	plc              EstadoPLC
	nube             EstadoNube
	registro         []string
	cola             []Lectura
	enviados         map[string]any
	fotoEn           time.Time
	aviso            string // aviso de actualización para la página
	clavePag         string
	cambio           chan struct{} // se avisa cuando cambia la configuración
	despierta        chan struct{} // se avisa cuando hay algo que entregar

	parar        func()
	reiniciarCon string
	cierraSim    func()
}

func nuevaApp(base string) (*App, error) {
	a := &App{base: base, datos: filepath.Join(base, "gradiox-datos"), valores: map[string]Valor{}, enviados: map[string]any{}, cambio: make(chan struct{}, 1), despierta: make(chan struct{}, 1)}
	if err := os.MkdirAll(filepath.Join(a.datos, "lecturas"), 0o755); err != nil {
		return nil, fmt.Errorf("No se puede escribir en %s. Copie el programa a una carpeta suya (por ejemplo, el Escritorio) y vuelva a abrirlo", base)
	}
	a.cfg = Config{Seguridad: "auto", Nube: "https://gradiox.com"}
	if b, err := os.ReadFile(a.ruta("config.json")); err == nil {
		if err := json.Unmarshal(b, &a.cfg); err != nil {
			a.registrar("config.json no se entiende y se ha dejado de lado: %v", err)
		}
	}
	a.cfg = normalizar(a.cfg)
	if b, err := os.ReadFile(a.ruta("remota.json")); err == nil {
		var r Remota
		if json.Unmarshal(b, &r) == nil {
			a.remota = &r
		}
	}
	// La clave de la página se conserva para que siga valiendo tras una actualización.
	if b, err := os.ReadFile(a.ruta("pagina.clave")); err == nil && len(b) == 32 {
		a.clavePag = string(b)
	} else {
		k := make([]byte, 16)
		if _, err := rand.Read(k); err != nil {
			return nil, err
		}
		a.clavePag = hex.EncodeToString(k)
		_ = os.WriteFile(a.ruta("pagina.clave"), []byte(a.clavePag), 0o600)
	}
	a.locales = a.leerVariablesLocales()
	a.cargarElegidas()
	a.cargarPendientes()
	return a, nil
}

func (a *App) ruta(nombre ...string) string {
	return filepath.Join(append([]string{a.datos}, nombre...)...)
}

func normalizar(c Config) Config {
	c.PLC = strings.TrimSpace(c.PLC)
	if c.PLC != "" && !strings.Contains(c.PLC, "://") {
		c.PLC = "opc.tcp://" + c.PLC
	}
	if c.PLC != "" && !strings.Contains(strings.TrimPrefix(c.PLC, "opc.tcp://"), ":") {
		c.PLC += ":4840"
	}
	c.Usuario = strings.TrimSpace(c.Usuario)
	c.Token = strings.TrimSpace(c.Token)
	c.Nube = strings.TrimRight(strings.TrimSpace(c.Nube), "/")
	if c.Nube == "" {
		c.Nube = "https://gradiox.com"
	}
	switch c.Seguridad {
	case "auto", "ninguna", "cifrada":
	default:
		c.Seguridad = "auto"
	}
	if c.CadaSegundos < 0 || c.CadaSegundos > 3600 {
		c.CadaSegundos = 10
	}
	return c
}

func (a *App) guardarConfig(c Config) error {
	c = normalizar(c)
	b, _ := json.MarshalIndent(c, "", "  ")
	if err := escribirEntero(a.ruta("config.json"), b, 0o600); err != nil {
		return err
	}
	a.mu.Lock()
	if a.cfg.Simulado != c.Simulado {
		// Lo leído del simulador y lo leído del PLC no se mezclan nunca en una entrega.
		a.cola = nil
		a.enviados = map[string]any{}
		a.fotoEn = time.Time{}
		a.guardarPendientes()
	}
	a.cfg = c
	a.mu.Unlock()
	a.avisarCambio()
	return nil
}

func (a *App) avisarCambio() {
	select {
	case a.cambio <- struct{}{}:
	default:
	}
}

// Escribe un archivo de una vez: o queda el nuevo entero o sigue el anterior.
func escribirEntero(ruta string, b []byte, modo os.FileMode) error {
	tmp := ruta + ".tmp"
	if err := os.WriteFile(tmp, b, modo); err != nil {
		return err
	}
	return os.Rename(tmp, ruta)
}

// Lo que rige ahora: lo de este ordenador manda sobre lo del panel en la
// dirección y el ritmo (para poder corregir en planta sin internet); la lista
// de variables es la elegida aquí con «Buscar variables» si la hay; si no, la
// del panel, y si tampoco, la de variables.csv.
type Vigente struct {
	Config
	Variables []Variable
	Origen    string // elegidas | panel | archivo | ninguna
	Perfil    string
}

func (a *App) vigente() Vigente {
	a.mu.Lock()
	defer a.mu.Unlock()
	v := Vigente{Config: a.cfg, Origen: "ninguna"}
	if a.remota != nil {
		if v.PLC == "" {
			v.PLC = normalizar(Config{PLC: a.remota.PLC}).PLC
		}
		if v.CadaSegundos == 0 {
			v.CadaSegundos = a.remota.CadaSegundos
		}
		if len(a.remota.Variables) > 0 {
			v.Variables, v.Origen, v.Perfil = a.remota.Variables, "panel", a.remota.Perfil
		}
	}
	if v.Origen == "ninguna" && len(a.locales) > 0 {
		v.Variables, v.Origen = a.locales, "archivo"
	}
	// Lo elegido en la planta manda sobre las dos.
	if len(a.elegidas) > 0 {
		v.Variables, v.Origen, v.Perfil = a.elegidas, "elegidas", ""
	}
	if v.PLC == "" {
		v.PLC = plcPorDefecto
	}
	if v.CadaSegundos <= 0 {
		v.CadaSegundos = 10
	}
	if v.CadaSegundos < 2 {
		v.CadaSegundos = 2
	}
	return v
}

// variables.csv, junto al programa: columnas con cabecera (grupo, variable, tipo,
// descripcion, unidad, nodo), separadas por punto y coma, coma o tabulador.
func (a *App) leerVariablesLocales() []Variable {
	b, err := os.ReadFile(filepath.Join(a.base, "variables.csv"))
	if err != nil {
		return nil
	}
	texto := strings.TrimPrefix(string(b), "\xef\xbb\xbf")
	sep := ';'
	primera := strings.SplitN(texto, "\n", 2)[0]
	if !strings.Contains(primera, ";") {
		if strings.Contains(primera, "\t") {
			sep = '\t'
		} else {
			sep = ','
		}
	}
	r := csv.NewReader(strings.NewReader(texto))
	r.Comma, r.FieldsPerRecord, r.LazyQuotes = sep, -1, true
	filas, err := r.ReadAll()
	if err != nil || len(filas) < 2 {
		a.registrar("variables.csv no se ha podido leer: %v", err)
		return nil
	}
	col := map[string]int{}
	for i, c := range filas[0] {
		c = strings.ToLower(strings.TrimSpace(c))
		switch {
		case strings.HasPrefix(c, "grupo"):
			col["g"] = i
		case strings.HasPrefix(c, "variable"), c == "nombre":
			col["n"] = i
		case strings.HasPrefix(c, "tipo"):
			col["t"] = i
		case strings.HasPrefix(c, "desc"), strings.HasPrefix(c, "qué"), strings.HasPrefix(c, "que"):
			col["d"] = i
		case strings.HasPrefix(c, "unidad"):
			col["u"] = i
		case strings.HasPrefix(c, "nodo"):
			col["nodo"] = i
		}
	}
	if _, ok := col["n"]; !ok {
		a.registrar("variables.csv no tiene una columna «variable».")
		return nil
	}
	celda := func(f []string, k string) string {
		i, ok := col[k]
		if !ok || i >= len(f) {
			return ""
		}
		return strings.TrimSpace(f[i])
	}
	var out []Variable
	vistas := map[string]bool{}
	for _, f := range filas[1:] {
		n := celda(f, "n")
		if n == "" || vistas[n] {
			continue
		}
		vistas[n] = true
		out = append(out, Variable{Nombre: n, Grupo: celda(f, "g"), Tipo: celda(f, "t"), Descripcion: celda(f, "d"), Unidad: celda(f, "u"), Nodo: celda(f, "nodo")})
	}
	return out
}

func (a *App) registrar(formato string, args ...any) {
	linea := time.Now().Format("15:04:05") + " " + fmt.Sprintf(formato, args...)
	fmt.Println(linea)
	a.mu.Lock()
	a.registro = append(a.registro, linea)
	if len(a.registro) > 200 {
		a.registro = a.registro[len(a.registro)-200:]
	}
	a.mu.Unlock()
	if f, err := os.OpenFile(a.ruta("registro.txt"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
		fmt.Fprintln(f, time.Now().Format("2006-01-02 ")+linea)
		f.Close()
	}
}

// --- Lo que queda por entregar a Gradiox ---

const maxPendientes = 200_000

func (a *App) cargarPendientes() {
	b, err := os.ReadFile(a.ruta("pendientes.jsonl"))
	if err != nil {
		return
	}
	for _, linea := range strings.Split(string(b), "\n") {
		var l Lectura
		if linea != "" && json.Unmarshal([]byte(linea), &l) == nil && l.V != "" {
			a.cola = append(a.cola, l)
		}
	}
	a.recortarCola()
}

func (a *App) recortarCola() {
	if len(a.cola) > maxPendientes {
		a.cola = append([]Lectura(nil), a.cola[len(a.cola)-maxPendientes:]...)
	}
}

// Con la llave echada.
func (a *App) guardarPendientes() {
	var sb strings.Builder
	for _, l := range a.cola {
		b, _ := json.Marshal(l)
		sb.Write(b)
		sb.WriteByte('\n')
	}
	_ = escribirEntero(a.ruta("pendientes.jsonl"), []byte(sb.String()), 0o600)
}

func (a *App) cerrar() {
	a.mu.Lock()
	a.guardarPendientes()
	sim := a.cierraSim
	a.mu.Unlock()
	if sim != nil {
		sim()
	}
}

const plcPorDefecto = "opc.tcp://50.50.0.1:4840"

var errSinToken = errors.New("sin token")
