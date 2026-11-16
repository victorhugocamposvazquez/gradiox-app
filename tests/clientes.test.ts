import { afterAll, describe, expect, it } from "vitest";
import { clientesEnMemoria, clientesPostgres, type AlmacenClientes } from "../src/clientes/almacen";
import { opcionesBase } from "../src/conexion/base";
import { clienteVacio, instalacionVacia, puntoVacio, validarCliente, validarDatosFoto, type DatosCliente } from "../src/clientes/modelo";

// Las mismas pruebas para los dos almacenes. El de base de datos solo se prueba
// si GRADIOX_PRUEBA_BASE_URL apunta a un Postgres de pruebas: nunca a uno real.
const urlPrueba = process.env.GRADIOX_PRUEBA_BASE_URL;
const datos = (nombre: string, puntos = 0): DatosCliente => ({ ...clienteVacio(), nombre, instalaciones: puntos ? [{ ...instalacionVacia("Nave"), puntos: Array.from({ length: puntos }, puntoVacio) }] : [] });
const imagen = (n: number) => ({ mime: "image/jpeg", bytes: new Uint8Array([255, 216, 255, n, 0, 7]) });

function contrato(nombre: string, crear: () => Promise<AlmacenClientes>) {
  describe(`clientes en ${nombre}`, () => {
    it("crea, lee, guarda y lista con el más reciente primero", async () => {
      const a = await crear();
      const uno = await a.crear(datos("Frutas Uno", 2));
      const dos = await a.crear(datos("Carnes Dos"));
      expect(await a.leer(uno.id)).toEqual(uno);
      const cambiado = await a.guardar(uno.id, { ...datos("Frutas Uno SL", 3), estado: "visitado" });
      expect(cambiado).toMatchObject({ id: uno.id, nombre: "Frutas Uno SL", estado: "visitado", creado: uno.creado });
      expect((await a.listar()).map((c) => [c.nombre, c.puntos, c.instalaciones])).toEqual([["Frutas Uno SL", 3, 1], ["Carnes Dos", 0, 0]]);
      expect(await a.guardar("00000000-0000-4000-8000-000000000000", datos("Nadie"))).toBeNull();
      expect(await a.leer("00000000-0000-4000-8000-000000000000")).toBeNull();
      expect(dos.id).not.toBe(uno.id);
    });

    it("guarda las fotos con su imagen, las cambia y las borra con el cliente", async () => {
      const a = await crear();
      const c = await a.crear(datos("Con fotos"));
      const otro = await a.crear(datos("Sin fotos"));
      const f1 = await a.anadirFoto(c.id, validarDatosFoto({ tipo: "etiqueta", pie: "Cámara 1" }), imagen(1));
      const f2 = await a.anadirFoto(c.id, validarDatosFoto({}), imagen(2));
      expect(f1).toMatchObject({ cliente: c.id, tipo: "etiqueta", pie: "Cámara 1", mime: "image/jpeg", tamano: 6 });
      expect(await a.anadirFoto("00000000-0000-4000-8000-000000000000", validarDatosFoto({}), imagen(3))).toBeNull();
      expect((await a.fotos(c.id)).map((f) => f.id)).toEqual([f1!.id, f2!.id]);
      expect(await a.fotos(otro.id)).toEqual([]);
      const leida = await a.imagen(f2!.id);
      expect(leida?.mime).toBe("image/jpeg");
      expect([...leida!.bytes]).toEqual([255, 216, 255, 2, 0, 7]);
      expect(await a.cambiarFoto(f2!.id, validarDatosFoto({ tipo: "sitio", pie: "Junto al cuadro" }))).toMatchObject({ id: f2!.id, tipo: "sitio", pie: "Junto al cuadro" });
      expect((await a.listar()).find((x) => x.id === c.id)?.fotos).toBe(2);
      expect(await a.borrarFoto(f1!.id)).toBe(true);
      expect(await a.borrarFoto(f1!.id)).toBe(false);
      expect(await a.borrar(c.id)).toBe(true);
      expect(await a.imagen(f2!.id)).toBeNull();
      expect(await a.borrar(c.id)).toBe(false);
    });
  });
}

let reloj = 1000;
contrato("memoria", async () => clientesEnMemoria(() => reloj++));

if (urlPrueba) {
  const abiertos: { cerrar(): Promise<void> }[] = [];
  afterAll(() => Promise.all(abiertos.map((a) => a.cerrar())));
  contrato("Postgres", async () => {
    const a = clientesPostgres(urlPrueba, () => reloj++);
    abiertos.push(a);
    await a.listar();
    for (const c of await a.listar()) await a.borrar(c.id);
    return a;
  });
} else {
  describe.skip("clientes en Postgres (falta GRADIOX_PRUEBA_BASE_URL)", () => it("se salta", () => undefined));
}

describe("validación de la ficha", () => {
  it("exige el nombre y recorta lo que no conoce", () => {
    expect(validarCliente({})).toEqual({ error: "Falta el nombre del cliente" });
    expect(validarCliente("texto")).toEqual({ error: "Falta el nombre del cliente" });
    const v = validarCliente({ nombre: "  Frío Sur  ", estado: "inventado", admin: true, contacto: { telefono: 600 }, visita: { fecha: "mañana", soloLectura: "si" }, instalaciones: [{ nombre: "Nave 1", internet: "fibra", puntos: [{ nombre: "Cámara 1", temperatura: "-20 °C", raro: 1 }, "x"] }] });
    if ("error" in v) throw new Error(v.error);
    expect(v).toMatchObject({ nombre: "Frío Sur", estado: "posible", contacto: { telefono: "" }, visita: { fecha: "", soloLectura: "si" } });
    expect("admin" in v).toBe(false);
    expect(v.instalaciones[0]).toMatchObject({ nombre: "Nave 1", internet: "" });
    expect(v.instalaciones[0].puntos.map((p) => p.nombre)).toEqual(["Cámara 1", ""]);
    expect(v.instalaciones[0].puntos[0]).not.toHaveProperty("raro");
    expect(v.instalaciones[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("conserva los identificadores válidos y limita los largos", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const v = validarCliente({ nombre: "x".repeat(500), instalaciones: [{ id, puntos: [{ id }] }] });
    if ("error" in v) throw new Error(v.error);
    expect(v.nombre.length).toBe(120);
    expect(v.instalaciones[0].id).toBe(id);
    expect(v.instalaciones[0].puntos[0].id).toBe(id);
    expect(validarDatosFoto({ tipo: "selfi", instalacion: "../x", pie: "a".repeat(999) })).toEqual({ instalacion: "", punto: "", tipo: "otra", pie: "a".repeat(240) });
  });
});

describe("conexión con la base de datos", () => {
  it("cifra siempre fuera de este ordenador y quita el modo que venga en la dirección", () => {
    const fuera = opcionesBase("postgres://u:c@ejemplo.pooler.supabase.com:6543/postgres?sslmode=require&otra=1", {});
    expect(fuera.ssl).toEqual({ rejectUnauthorized: false });
    expect(fuera.connectionString).toBe("postgres://u:c@ejemplo.pooler.supabase.com:6543/postgres?otra=1");
    expect(opcionesBase("postgres://u@ejemplo.com/b", { GRADIOX_BASE_CA: " CERT " }).ssl).toEqual({ ca: "CERT", rejectUnauthorized: true });
    expect(opcionesBase("postgres://postgres@127.0.0.1:5544/postgres", {}).ssl).toBe(false);
    expect(opcionesBase("postgres://postgres@localhost/postgres", { GRADIOX_BASE_CA: "CERT" }).ssl).toBe(false);
  });
});
