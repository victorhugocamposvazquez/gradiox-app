import { afterAll, describe, expect, it } from "vitest";
import { clientesEnMemoria, clientesPostgres, type AlmacenClientes } from "../src/clientes/almacen";
import { opcionesBase } from "../src/conexion/base";
import { motivoBase } from "../src/clientes/rutas";
import { esEnlace, faltaTecnica, fraseConexion, nuevoEnlace, senalesDeTexto, tecnicaVacia, validarTecnica } from "../src/clientes/tecnica";
import { aplicarExterno, conservarExterno, enviarExterno, instalacionDeEnlace, vistaExterna } from "../src/clientes/externo";
import { avisos, cambios, faltan, clienteVacio, completar, instalacionVacia, puntoVacio, resumir, validarCliente, validarDatosFoto, type DatosCliente } from "../src/clientes/modelo";

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
      expect((await a.listar()).map(({ cliente: c }) => [c.nombre, c.instalaciones.flatMap((i) => i.puntos).length, c.instalaciones.length])).toEqual([["Frutas Uno SL", 3, 1], ["Carnes Dos", 0, 0]]);
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
      expect((await a.listar()).find((x) => x.cliente.id === c.id)?.fotos).toBe(2);
      expect(await a.borrarFoto(f1!.id)).toBe(true);
      expect(await a.borrarFoto(f1!.id)).toBe(false);
      expect(await a.borrar(c.id)).toBe(true);
      expect(await a.imagen(f2!.id)).toBeNull();
      expect(await a.borrar(c.id)).toBe(false);
    });

    it("encuentra un cliente por el enlace de una de sus fichas técnicas, y solo con el enlace exacto", async () => {
      const a = await crear();
      const enlace = nuevoEnlace();
      const i = instalacionVacia("Nave");
      i.tecnica = { ...tecnicaVacia(), enlace };
      const c = await a.crear({ ...datos("Con enlace"), instalaciones: [i] });
      await a.crear(datos("Sin enlace"));
      expect((await a.porEnlace(enlace))?.id).toBe(c.id);
      expect(await a.porEnlace(nuevoEnlace())).toBeNull();
      await a.guardar(c.id, { ...datos("Con enlace"), instalaciones: [{ ...i, tecnica: { ...i.tecnica, enlace: "" } }] });
      expect(await a.porEnlace(enlace)).toBeNull();
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
    for (const c of await a.listar()) await a.borrar(c.cliente.id);
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

describe("control de las instalaciones", () => {
  const T = Date.parse("2026-11-18T10:00:00+01:00");
  const base = (): DatosCliente => ({ ...clienteVacio(), nombre: "Frío Sur", estado: "visitado", proximo: { texto: "Enviar propuesta", fecha: "2026-11-20" }, instalaciones: [{ ...instalacionVacia("Nave"), fase: "visitada" }] });

  it("apunta solo los cambios de estado, de fase y de instalaciones", () => {
    const antes = base();
    const ahora: DatosCliente = { ...antes, estado: "propuesta", instalaciones: [{ ...antes.instalaciones[0], fase: "leyendo", aparato: { ...antes.instalaciones[0].aparato, pasarela: "gx-0001" } }, instalacionVacia("Tienda")] };
    expect(cambios(antes, ahora, T).map((a) => [a.texto, a.auto, a.t])).toEqual([
      ["El cliente pasa de «Visitado» a «Propuesta enviada».", true, T],
      ["«Nave» pasa de «Visitada» a «Instalada y leyendo».", true, T],
      ["«Nave» queda enlazada al aparato gx-0001.", true, T],
      ["Se añade la instalación «Tienda».", true, T],
    ]);
    expect(cambios(ahora, antes, T).map((a) => a.texto)).toContain("Se quita la instalación «Tienda».");
    expect(cambios(antes, { ...antes, notas: "otra cosa" }, T)).toEqual([]);
  });

  it("avisa de lo que falla antes que de lo que conviene mirar", () => {
    const c = base();
    expect(avisos(c, 0, {}, T)).toEqual([{ nivel: "mirar", texto: "Sin fotos de la visita" }]);
    expect(avisos(c, 3, {}, T)).toEqual([]);
    const leyendo: DatosCliente = { ...c, proximo: { texto: "Llamar", fecha: "2026-11-17" }, instalaciones: [{ ...c.instalaciones[0], fase: "leyendo", aparato: { ...c.instalaciones[0].aparato, pasarela: "gx-0001" } }] };
    expect(avisos(leyendo, 3, {}, T).map((a) => a.texto)).toEqual(["Nave: el aparato no ha entregado ninguna lectura", "Paso atrasado: Llamar"]);
    expect(avisos(leyendo, 3, { "gx-0001": { ultima: T - 5 * 60_000, equipos: 4 } }, T).map((a) => a.texto)).toEqual(["Paso atrasado: Llamar"]);
    expect(avisos(leyendo, 3, { "gx-0001": { ultima: T - 3 * 3_600_000, equipos: 4 } }, T)[0]).toEqual({ nivel: "mal", texto: "Nave: sin lecturas desde hace 3 h" });
    expect(avisos({ ...c, proximo: { texto: "Visita", fecha: "2026-11-18" } }, 1, {}, T)).toEqual([{ nivel: "mirar", texto: "Para hoy: Visita" }]);
    expect(avisos({ ...c, proximo: { texto: "", fecha: "" } }, 1, {}, T)).toEqual([{ nivel: "mirar", texto: "Sin próximo paso apuntado" }]);
    expect(avisos({ ...c, estado: "baja", proximo: { texto: "", fecha: "" } }, 0, {}, T)).toEqual([]);
    expect(avisos({ ...c, instalaciones: [{ ...c.instalaciones[0], fase: "incidencia" }] }, 1, {}, T)[0]).toEqual({ nivel: "mal", texto: "Nave: con incidencia" });
  });

  it("completa las fichas guardadas antes de existir estos campos y limpia el aparato", () => {
    const vieja = completar({ nombre: "Antigua", instalaciones: [{ nombre: "Nave", puntos: [] }] });
    expect(vieja.proximo).toEqual({ texto: "", fecha: "" });
    expect(vieja.historial).toEqual([]);
    expect(vieja.instalaciones[0]).toMatchObject({ fase: "sinvisitar", aparato: { pasarela: "", conexion: "" } });
    const v = completar({ nombre: "x", historial: [{ t: 5, texto: " hola " }, { texto: "sin hora" }, "nada"], instalaciones: [{ fase: "volando", aparato: { pasarela: " gx 00 01 ", instalado: "ayer", conexion: "movil" } }] });
    expect(v.historial.map((a) => [a.t, a.texto, a.auto])).toEqual([[5, "hola", false]]);
    expect(v.instalaciones[0]).toMatchObject({ fase: "sinvisitar", aparato: { pasarela: "gx0001", instalado: "", conexion: "movil" } });
    expect(resumir({ ...v, id: "i", creado: 1, actualizado: 2 }, 0, {}, T)).toMatchObject({ fases: ["sinvisitar"], instalaciones: 1 });
  });
});

describe("por qué falla la base de datos", () => {
  it("lo explica sin enseñar la dirección", () => {
    expect(motivoBase({ code: "28P01", message: 'password authentication failed for user "postgres"' })).toMatch(/contraseña/);
    expect(motivoBase(new Error("getaddrinfo ENOTFOUND aws-0.pooler.supabase.com"))).toMatch(/no existe/);
    expect(motivoBase(new Error("Tenant or user not found"))).toMatch(/Transaction pooler/);
    expect(motivoBase(new Error("timeout exceeded when trying to connect"))).toMatch(/6543/);
    expect(motivoBase(new Error("self-signed certificate in certificate chain"))).toMatch(/cifrado/);
    expect(motivoBase({ code: "XX000", message: "postgres://u:secreto@h/b raro" })).toBe("fallo sin identificar (código XX000).");
    expect(motivoBase(undefined)).toBe("fallo sin identificar.");
  });
});

describe("lo que falta por recoger en la visita", () => {
  it("mira la ficha y las fotos, y dice dónde se apunta cada cosa", () => {
    const vacio = faltan({ ...clienteVacio(), nombre: "x" }, []);
    expect(vacio.map((f) => f.paso)).toEqual(["empresa", "empresa", "instalacion", "visita", "visita"]);
    const p = { ...puntoVacio(), nombre: "Cámara 1", guarda: "Pescado", temperatura: "-20", controlador: "Marca X" };
    const i = { ...instalacionVacia("Nave"), internet: "cable" as const, cobertura: "4 rayas", informatica: "Ellos", sistemaActual: "No", sitioAparato: "Junto al cuadro", puntos: [p, { ...puntoVacio(), nombre: "Cámara 2" }] };
    const c: DatosCliente = { ...clienteVacio(), nombre: "x", contacto: { nombre: "A", cargo: "", telefono: "6", correo: "" }, mantenedor: { nombre: "B", telefono: "7" }, visita: { fecha: "", preocupa: "a", comoSeEntera: "b", soloLectura: "si", otras: "" }, instalaciones: [i] };
    const fotos = [{ instalacion: i.id, punto: p.id, tipo: "controlador" as const }, { instalacion: i.id, punto: p.id, tipo: "etiqueta" as const }];
    expect(faltan(c, fotos).map((f) => [f.texto, f.punto === i.puntos[1].id])).toEqual([
      ["Cámara 2: falta qué guarda, su temperatura, marca y modelo del controlador", true],
      ["Cámara 2: foto de frente del controlador", true],
      ["Cámara 2: foto de la etiqueta del controlador", true],
      ["foto del sitio del aparato", false],
    ]);
    const completo = { ...c, instalaciones: [{ ...i, puntos: [p] }] };
    expect(faltan(completo, [...fotos, { instalacion: i.id, punto: "", tipo: "sitio" as const }])).toEqual([]);
  });
});

describe("ficha técnica de una instalación", () => {
  it("una ficha guardada antes de existir la ficha técnica se abre con ella vacía", () => {
    const vieja = { ...clienteVacio(), nombre: "Antiguo", instalaciones: [{ id: instalacionVacia().id, nombre: "Nave" }] };
    const c = completar(vieja);
    expect(c.instalaciones[0].tecnica).toEqual(tecnicaVacia());
    expect(c.instalaciones[0].automata).toBe("");
  });

  it("descarta lo que no es válido y conserva las señales", () => {
    const t = validarTecnica({ via: "opcua", gobierno: "nave espacial", acceso: "usuario", senales: [{ nombre: "  Camara1_Temp ", tipo: "temperatura", escribe: "sí" }, { nombre: "X", tipo: "rara" }] });
    expect(t.via).toBe("opcua");
    expect(t.gobierno).toBe("");
    expect(t.senales.map((s) => [s.nombre, s.tipo, s.escribe])).toEqual([["Camara1_Temp", "temperatura", false], ["X", "otra", false]]);
  });

  it("pide solo lo que hace falta según lo que haya", () => {
    const vacia = instalacionVacia("Nave");
    expect(faltaTecnica(vacia).map((f) => f.campo)).toEqual(["gobierno", "via", "permiso", "enchufar", "internet"]);

    const conAutomata = { ...vacia, tecnica: { ...tecnicaVacia(), gobierno: "automata" as const, via: "opcua" as const } };
    expect(faltaTecnica(conAutomata).map((f) => f.campo)).toEqual(["automata", "cpu", "programador", "direccion", "acceso", "usuario", "senales", "permiso", "enchufar", "internet"]);

    const completa = {
      ...vacia,
      automata: "Siemens S7-1500",
      programador: "Persona de ejemplo",
      internet: "cable" as const,
      tecnica: { ...tecnicaVacia(), gobierno: "automata" as const, cpu: "CPU 1513", via: "opcua" as const, direccion: "192.168.0.10", acceso: "usuario" as const, usuario: "creado" as const, permiso: "leer" as const, enchufar: "si" as const, senales: senalesDeTexto("Camara1_Temperatura") },
    };
    expect(faltaTecnica(completa)).toEqual([]);
    expect(fraseConexion(completa)).toBe("Gradiox lee del autómata Siemens S7-1500 por OPC UA, por la red de la planta.");

    const sueltos = { ...vacia, internet: "movil" as const, puntos: [{ ...puntoVacio(), nombre: "Cámara 1" }], tecnica: { ...tecnicaVacia(), gobierno: "controladores" as const, via: "modbus-rtu" as const, permiso: "leer" as const, enchufar: "si" as const } };
    expect(faltaTecnica(sueltos).map((f) => f.campo)).toEqual(["camaras"]);
  });

  it("convierte una lista pegada en señales y adivina qué es cada una", () => {
    const s = senalesDeTexto("Camara1_Temperatura\tREAL\n\nCamara1_Alarma;BOOL\nCamara1_Consigna\nCompresor2_Marcha\nOtraCosa");
    expect(s.map((x) => [x.nombre, x.tipo])).toEqual([["Camara1_Temperatura", "temperatura"], ["Camara1_Alarma", "alarma"], ["Camara1_Consigna", "consigna"], ["Compresor2_Marcha", "estado"], ["OtraCosa", "otra"]]);
  });

  it("el resumen del cliente lleva el estado de cada ficha técnica", () => {
    const c = { ...clienteVacio(), nombre: "Ejemplo", instalaciones: [instalacionVacia("Nave")], id: "x", creado: 0, actualizado: 0 };
    expect(resumir(c, 0).tecnicas).toEqual([{ id: c.instalaciones[0].id, nombre: "Nave", via: "", gobierno: "", faltan: 5, senales: 0, puntos: 0, enviada: 0 }]);
  });
});

describe("enlace para rellenar una ficha técnica desde fuera", () => {
  const enlace = nuevoEnlace();
  const base = () => {
    const i = { ...instalacionVacia("Nave"), notas: "interno", puntos: [{ ...puntoVacio(), nombre: "Cámara 1" }] };
    i.tecnica = { ...tecnicaVacia(), enlace, notas: "nota interna" };
    const c = { ...clienteVacio(), nombre: "Ejemplo", notas: "secreto comercial", instalaciones: [i, instalacionVacia("Otra")], id: "x", creado: 0, actualizado: 0 };
    return { c, i };
  };

  it("la clave es larga, distinta cada vez y con forma reconocible", () => {
    expect(esEnlace(enlace)).toBe(true);
    expect(nuevoEnlace()).not.toBe(enlace);
    expect(esEnlace("corta")).toBe(false);
    expect(validarTecnica({ enlace: "<script>" }).enlace).toBe("");
  });

  it("enseña solo los datos técnicos de esa instalación", () => {
    const { c, i } = base();
    expect(instalacionDeEnlace(c, enlace)?.id).toBe(i.id);
    expect(instalacionDeEnlace(c, "")).toBeUndefined();
    const vista = JSON.stringify(vistaExterna(c, i));
    expect(vista).not.toContain("secreto comercial");
    expect(vista).not.toContain("nota interna");
    expect(vista).not.toContain("interno");
    expect(vista).not.toContain(enlace);
    expect(vista).not.toContain("Otra");
    expect(Object.keys(vistaExterna(c, i)).sort()).toEqual(["automata", "camaras", "cambiada", "empresa", "enviada", "informatica", "instalacion", "internet", "programador", "tecnica"]);
  });

  it("lo que llega del enlace no puede tocar nada más", () => {
    const { i } = base();
    const camara = i.puntos[0].id;
    const n = aplicarExterno(i, { nombre: "Cambiada", notas: "x", fase: "leyendo", puntos: [], automata: "Siemens S7-1500", internet: "inventado", tecnica: { via: "opcua", enlace: nuevoEnlace(), notas: "pisada", externa: 5, observaciones: "ok", senales: [{ nombre: "A", punto: camara }, { nombre: "B", punto: crypto.randomUUID() }] } }, 1000);
    expect([n.nombre, n.notas, n.fase, n.puntos.length, n.internet]).toEqual(["Nave", "interno", "sinvisitar", 1, ""]);
    expect([n.automata, n.tecnica.via, n.tecnica.observaciones]).toEqual(["Siemens S7-1500", "opcua", "ok"]);
    expect([n.tecnica.enlace, n.tecnica.notas, n.tecnica.externa]).toEqual([enlace, "nota interna", 1000]);
    expect(n.tecnica.senales.map((s) => s.punto)).toEqual([camara, ""]);
  });

  it("enviar desde el enlace deja la hora del envío y se sabe si después se ha cambiado algo", () => {
    const { c, i } = base();
    const enviada = enviarExterno(i, { automata: "Siemens S7-1500", tecnica: { via: "opcua" } }, 3000);
    expect([enviada.automata, enviada.tecnica.via, enviada.tecnica.externa, enviada.tecnica.enviada]).toEqual(["Siemens S7-1500", "opcua", 3000, 3000]);
    const vista = (x: typeof i) => vistaExterna(c, x);
    expect([vista(enviada).enviada, vista(enviada).cambiada]).toEqual([3000, false]);
    const despues = aplicarExterno(enviada, { automata: "Siemens S7-1500", tecnica: { via: "opcua", cpu: "CPU 1513" } }, 4000);
    expect([despues.tecnica.enviada, vista(despues).cambiada]).toEqual([3000, true]);
    // El panel, con la ficha abierta desde antes del envío, no borra el aviso al guardar.
    expect(conservarExterno(i, enviada).instalacion.tecnica.enviada).toBe(3000);
  });

  it("el panel no pisa lo rellenado desde el enlace si tenía la ficha abierta de antes", () => {
    const { i } = base();
    const rellenada = aplicarExterno(i, { automata: "Siemens S7-1500", tecnica: { via: "opcua" } }, 2000);
    const delPanel = { ...i, nombre: "Nave nueva", automata: "", tecnica: { ...i.tecnica, notas: "nota nueva" } };
    const r = conservarExterno(delPanel, rellenada);
    expect(r.desfasada).toBe(true);
    expect([r.instalacion.nombre, r.instalacion.automata, r.instalacion.tecnica.via, r.instalacion.tecnica.notas, r.instalacion.tecnica.externa]).toEqual(["Nave nueva", "Siemens S7-1500", "opcua", "nota nueva", 2000]);
    expect(conservarExterno({ ...rellenada, automata: "Otro" }, rellenada)).toEqual({ instalacion: { ...rellenada, automata: "Otro" }, desfasada: false });
  });
});
