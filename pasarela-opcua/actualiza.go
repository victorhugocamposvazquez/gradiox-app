package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// Actualización del propio programa.
//
// Gradiox anuncia la última versión para esta plataforma con su tamaño, su
// huella (sha256) y una firma. El programa solo se cambia por otro si la firma
// corresponde a la clave pública que lleva dentro: aunque alguien entrase en el
// servidor, no podría colar un programa distinto. Antes de cambiarse comprueba
// que el nuevo arranca, y si no llega a funcionar un minuto en dos intentos,
// vuelve al anterior y no lo intenta más con esa versión.
//
// Las versiones nuevas no se escriben donde está instalado el programa (en un
// Mac esa carpeta suele ser de solo lectura: la aplicación de Descargas, la
// imagen de disco o Aplicaciones), sino en la carpeta de datos, en «programa».
// El programa instalado hace de lanzador: al abrirse, si ahí hay una versión
// posterior con su firma correcta, le pasa el testigo.

type anuncio struct {
	Version string `json:"version"`
	Tamano  int64  `json:"tamano"`
	Sha256  string `json:"sha256"`
	Firma   string `json:"firma"`
	Partes  int    `json:"partes"`
}

type marca struct {
	Version  string `json:"version"`  // la que se acaba de instalar
	Anterior string `json:"anterior"` // la que había
	Intentos int    `json:"intentos"`
}

// La versión guardada en la carpeta de datos, con lo necesario para volver a comprobarla al arrancar.
type instalada struct {
	Version string `json:"version"`
	Sha256  string `json:"sha256"`
	Firma   string `json:"firma"`
	Archivo string `json:"archivo"`
}

func carpetaVersiones(datos string) string { return filepath.Join(datos, "programa") }

func nombreVersion(v string) string {
	n := "gradiox-pasarela-" + v
	if runtime.GOOS == "windows" {
		n += ".exe"
	}
	return n
}

func clavePublica() ed25519.PublicKey {
	if claveFirma == "" {
		return nil // compilación de pruebas: sin clave no se actualiza
	}
	b, err := base64.StdEncoding.DecodeString(claveFirma)
	if err != nil || len(b) != ed25519.PublicKeySize {
		return nil
	}
	return ed25519.PublicKey(b)
}

func huellaArchivo(ruta string) (string, error) {
	f, err := os.Open(ruta)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func descartadaEn(datos, v string) bool {
	b, _ := os.ReadFile(filepath.Join(datos, "versiones-descartadas.txt"))
	for _, l := range strings.Split(string(b), "\n") {
		if strings.TrimSpace(l) == v {
			return true
		}
	}
	return false
}

// versionGuardada dice qué programa de la carpeta de datos hay que usar en lugar
// de este, si hay uno posterior, no descartado y cuya firma y huella cuadran.
func versionGuardada(datos string) string {
	publica := clavePublica()
	if publica == nil {
		return ""
	}
	b, err := os.ReadFile(filepath.Join(carpetaVersiones(datos), "actual.json"))
	if err != nil {
		return ""
	}
	var g instalada
	if json.Unmarshal(b, &g) != nil || !mayor(g.Version, version) || descartadaEn(datos, g.Version) || g.Archivo != nombreVersion(g.Version) {
		return ""
	}
	firma, err := base64.StdEncoding.DecodeString(g.Firma)
	if err != nil || !ed25519.Verify(publica, textoFirmado(plataforma(), g.Version, g.Sha256), firma) {
		return ""
	}
	ruta := filepath.Join(carpetaVersiones(datos), g.Archivo)
	if h, err := huellaArchivo(ruta); err != nil || h != strings.ToLower(g.Sha256) {
		return ""
	}
	return ruta
}

// ¿Este proceso es una versión guardada en la carpeta de datos?
func (a *App) desdeDatos(exe string) bool {
	dir := carpetaVersiones(a.datos)
	if real, err := filepath.EvalSymlinks(dir); err == nil {
		dir = real
	}
	return filepath.Dir(exe) == dir
}

// Lo que se firma: plataforma, versión y huella. Así una firma no vale para otra plataforma ni para otra versión.
func textoFirmado(plat, ver, sha string) []byte {
	return []byte("gradiox-pasarela\n" + plat + "\n" + ver + "\n" + strings.ToLower(sha) + "\n")
}

func numeros(v string) []int {
	var out []int
	for _, p := range strings.Split(strings.TrimPrefix(v, "v"), ".") {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil
		}
		out = append(out, n)
	}
	return out
}

// mayor dice si la versión a es posterior a la b. Nunca se instala una igual o anterior.
func mayor(a, b string) bool {
	x, y := numeros(a), numeros(b)
	if x == nil || y == nil {
		return false
	}
	for i := 0; i < len(x) || i < len(y); i++ {
		var p, q int
		if i < len(x) {
			p = x[i]
		}
		if i < len(y) {
			q = y[i]
		}
		if p != q {
			return p > q
		}
	}
	return false
}

func (a *App) rutaMarca() string     { return a.ruta("actualizacion.json") }
func (a *App) rutaDescartes() string { return a.ruta("versiones-descartadas.txt") }

func (a *App) descartada(v string) bool { return descartadaEn(a.datos, v) }

func ejecutable() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}
	return exe, nil
}

// Al arrancar: si esta versión viene de una actualización que todavía no se ha
// dado por buena, cuenta el intento; al segundo intento fallido vuelve a la anterior.
func (a *App) vueltaAtrasSiHaceFalta() bool {
	b, err := os.ReadFile(a.rutaMarca())
	if err != nil {
		return false
	}
	var m marca
	if json.Unmarshal(b, &m) != nil || m.Version != version {
		_ = os.Remove(a.rutaMarca())
		return false
	}
	m.Intentos++
	if m.Intentos <= 2 {
		nb, _ := json.Marshal(m)
		_ = escribirEntero(a.rutaMarca(), nb, 0o644)
		return false
	}
	exe, err := ejecutable()
	if err != nil {
		return false
	}
	if a.desdeDatos(exe) {
		// Se descarta esta versión y se vuelve al programa instalado, que ya no le pasará el testigo.
		a.registrar("La versión %s no ha llegado a funcionar. Se vuelve a la %s.", version, m.Anterior)
		a.descartar(version)
		_ = os.Remove(filepath.Join(carpetaVersiones(a.datos), "actual.json"))
		_ = os.Remove(a.rutaMarca())
		if lanzador := os.Getenv("GRADIOX_LANZADOR"); lanzador != "" {
			reiniciar(lanzador)
		}
		return true
	}
	anterior := exe + ".anterior"
	if _, err := os.Stat(anterior); err != nil {
		_ = os.Remove(a.rutaMarca())
		return false
	}
	a.registrar("La versión %s no ha llegado a funcionar. Se vuelve a la %s.", version, m.Anterior)
	a.descartar(version)
	fallida := exe + ".fallida"
	_ = os.Remove(fallida)
	if err := os.Rename(exe, fallida); err != nil {
		a.registrar("No se ha podido volver atrás: %v", err)
		return false
	}
	if err := os.Rename(anterior, exe); err != nil {
		_ = os.Rename(fallida, exe)
		a.registrar("No se ha podido volver atrás: %v", err)
		return false
	}
	_ = os.Remove(a.rutaMarca())
	reiniciar(exe)
	return true
}

func (a *App) descartar(v string) {
	if f, err := os.OpenFile(a.rutaDescartes(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
		fmt.Fprintln(f, v)
		f.Close()
	}
}

// Tras un minuto funcionando, la versión se da por buena.
func (a *App) confirmarVersion() {
	if _, err := os.Stat(a.rutaMarca()); err == nil {
		_ = os.Remove(a.rutaMarca())
		a.registrar("La versión %s funciona y queda instalada.", version)
	}
	if exe, err := ejecutable(); err == nil {
		_ = os.Remove(exe + ".fallida")
		if viejos, err := filepath.Glob(exe + ".viejo-*"); err == nil {
			for _, v := range viejos {
				_ = os.Remove(v)
			}
		}
		// En la carpeta de datos solo se guarda la versión en uso.
		if a.desdeDatos(exe) {
			if otros, err := filepath.Glob(filepath.Join(carpetaVersiones(a.datos), "gradiox-pasarela-*")); err == nil {
				for _, o := range otros {
					if o != exe {
						_ = os.Remove(o)
					}
				}
			}
		}
	}
}

func (a *App) cicloActualizacion(ctx context.Context) {
	espera := 20 * time.Second
	for {
		select {
		case <-ctx.Done():
			return
		case <-time.After(espera):
		}
		a.buscarActualizacion(ctx)
		espera = 6 * time.Hour
	}
}

func (a *App) ponerAviso(s string) {
	a.mu.Lock()
	a.aviso = s
	a.mu.Unlock()
}

func (a *App) buscarActualizacion(ctx context.Context) {
	publica := clavePublica()
	if publica == nil {
		return
	}
	a.mu.Lock()
	if a.actualizando {
		a.mu.Unlock()
		return
	}
	a.actualizando = true
	a.mu.Unlock()
	defer func() {
		a.mu.Lock()
		a.actualizando = false
		a.mu.Unlock()
	}()
	resp, err := a.pedir(ctx, http.MethodGet, "/api/pasarela/programa?plataforma="+url.QueryEscape(plataforma()), nil)
	if err != nil {
		return // sin token o sin internet: se sigue con la versión que hay
	}
	var an anuncio
	err = json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&an)
	resp.Body.Close()
	if err != nil || an.Version == "" || !mayor(an.Version, version) || a.descartada(an.Version) {
		a.mu.Lock()
		a.nuevaVersion, a.falloVersion = "", ""
		a.mu.Unlock()
		return
	}
	a.mu.Lock()
	a.nuevaVersion, a.falloVersion = an.Version, ""
	a.mu.Unlock()
	if err := a.actualizar(ctx, an, publica); err != nil {
		a.registrar("No se ha podido actualizar a la versión %s: %v. Se sigue con la %s.", an.Version, err, version)
		a.mu.Lock()
		a.falloVersion = mayuscula(err.Error())
		a.mu.Unlock()
		return
	}
}

func (a *App) actualizar(ctx context.Context, an anuncio, publica ed25519.PublicKey) error {
	if an.Tamano <= 0 || an.Tamano > 200<<20 || an.Partes <= 0 || an.Partes > 500 {
		return errors.New("el anuncio no es válido")
	}
	firma, err := base64.StdEncoding.DecodeString(an.Firma)
	if err != nil || !ed25519.Verify(publica, textoFirmado(plataforma(), an.Version, an.Sha256), firma) {
		return errors.New("la firma del anuncio no es de Gradiox")
	}
	exe, err := ejecutable()
	if err != nil {
		return err
	}
	a.registrar("Hay una versión nueva (%s). Se descarga.", an.Version)
	a.ponerAviso("Descargando la versión " + an.Version + "…")
	defer a.ponerAviso("")
	// El archivo viaja comprimido y en partes; cada parte se intenta hasta tres veces.
	var comprimido bytes.Buffer
	for i := 0; i < an.Partes; i++ {
		ruta := fmt.Sprintf("/api/pasarela/programa?plataforma=%s&version=%s&parte=%d", url.QueryEscape(plataforma()), url.QueryEscape(an.Version), i)
		var parte []byte
		for intento := 0; ; intento++ {
			var resp *http.Response
			if resp, err = a.pedir(ctx, http.MethodGet, ruta, nil); err == nil {
				parte, err = io.ReadAll(io.LimitReader(resp.Body, 16<<20))
				resp.Body.Close()
			}
			if err == nil || intento == 2 || ctx.Err() != nil {
				break
			}
			time.Sleep(3 * time.Second)
		}
		if err != nil {
			return err
		}
		comprimido.Write(parte)
	}
	gz, err := gzip.NewReader(&comprimido)
	if err != nil {
		return errors.New("lo descargado no se puede abrir")
	}
	dir := carpetaVersiones(a.datos)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return errors.New("no se puede escribir en la carpeta de datos")
	}
	destino := filepath.Join(dir, nombreVersion(an.Version))
	nuevo := destino + ".nuevo"
	f, err := os.OpenFile(nuevo, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return errors.New("no se puede escribir en la carpeta de datos")
	}
	h := sha256.New()
	total, err := io.Copy(io.MultiWriter(f, h), io.LimitReader(gz, an.Tamano+1))
	if cierre := f.Close(); err == nil {
		err = cierre
	}
	// Lo descargado tiene que ser exactamente lo que se firmó.
	if err != nil || total != an.Tamano || hex.EncodeToString(h.Sum(nil)) != strings.ToLower(an.Sha256) {
		os.Remove(nuevo)
		return errors.New("lo descargado no coincide con lo firmado")
	}
	// Antes de cambiarse, se comprueba que el nuevo arranca en este ordenador y dice ser la versión anunciada.
	ctxP, cancelar := context.WithTimeout(ctx, 20*time.Second)
	salida, err := exec.CommandContext(ctxP, nuevo, "-comprobar").Output()
	cancelar()
	if err != nil || !strings.Contains(string(salida), "gradiox-pasarela "+an.Version+" "+plataforma()) {
		os.Remove(nuevo)
		return errors.New("la versión nueva no arranca en este ordenador")
	}
	_ = os.Remove(destino)
	if err := os.Rename(nuevo, destino); err != nil {
		os.Remove(nuevo)
		return errors.New("no se puede guardar la versión nueva en la carpeta de datos")
	}
	g, _ := json.Marshal(instalada{Version: an.Version, Sha256: strings.ToLower(an.Sha256), Firma: an.Firma, Archivo: nombreVersion(an.Version)})
	if err := escribirEntero(filepath.Join(dir, "actual.json"), g, 0o644); err != nil {
		return errors.New("no se puede guardar la versión nueva en la carpeta de datos")
	}
	// Quien arranca la versión nueva tiene que saber cuál es el programa instalado, para volver a él si falla.
	lanzador := os.Getenv("GRADIOX_LANZADOR")
	if lanzador == "" && !a.desdeDatos(exe) {
		lanzador = exe
	}
	_ = os.Setenv("GRADIOX_LANZADOR", lanzador)
	_ = os.Setenv("GRADIOX_CARPETA", a.base)
	b, _ := json.Marshal(marca{Version: an.Version, Anterior: version})
	_ = escribirEntero(a.rutaMarca(), b, 0o644)
	a.registrar("Versión %s instalada. El programa se reinicia solo.", an.Version)
	a.mu.Lock()
	a.reiniciarCon = destino
	a.mu.Unlock()
	if a.parar != nil {
		a.parar()
	}
	return nil
}
