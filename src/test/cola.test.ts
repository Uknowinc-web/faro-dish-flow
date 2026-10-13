import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

function setOnline(v: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => v });
}

// Cada prueba carga un módulo nuevo: la cola guarda una copia en memoria.
async function cargar() {
  vi.resetModules();
  return import("@/lib/cola");
}

describe("cola sin conexión", () => {
  beforeEach(() => {
    localStorage.clear();
    rpc.mockReset();
    setOnline(true);
  });

  it("reconoce errores de red y no los confunde con reglas de negocio", async () => {
    const { esErrorDeRed } = await cargar();
    expect(esErrorDeRed({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(esErrorDeRed({ message: "Demasiados intentos. Espera unos minutos." })).toBe(false);
  });

  it("guarda la comanda sin conexión y la envía al reconectar", async () => {
    const { ejecutar, obtenerCola, sincronizarCola } = await cargar();
    setOnline(false);
    const r = await ejecutar("enviar_comanda", { p_token: "t1" }, { etiqueta: "Comanda · Mesa 1" });
    expect(r.estado).toBe("encolada");
    expect(obtenerCola()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("faro-cola-operaciones")!)).toHaveLength(1);

    setOnline(true);
    rpc.mockResolvedValue({ data: "ok", error: null });
    await sincronizarCola();
    expect(rpc).toHaveBeenCalledWith("enviar_comanda", { p_token: "t1" });
    expect(obtenerCola()).toHaveLength(0);
  });

  it("si el servidor rechaza una operación, la conserva con el motivo", async () => {
    const { ejecutar, obtenerCola, sincronizarCola } = await cargar();
    setOnline(false);
    await ejecutar("cocina_cambiar_estado", { p_comanda: "c" }, { etiqueta: "Comanda #3" });
    setOnline(true);
    rpc.mockResolvedValue({ data: null, error: { message: "Transición de estado inválida" } });
    await sincronizarCola();
    expect(obtenerCola()).toHaveLength(1);
    expect(obtenerCola()[0]!.error).toBe("Transición de estado inválida");
  });

  it("un error de regla de negocio en línea no se guarda en la cola", async () => {
    const { ejecutar, obtenerCola } = await cargar();
    rpc.mockResolvedValue({ data: null, error: { message: "PIN inválido" } });
    const r = await ejecutar("cocina_imprimir_comanda", { p_pin: "x" }, { etiqueta: "Ticket" });
    expect(r).toEqual({ estado: "error", mensaje: "PIN inválido" });
    expect(obtenerCola()).toHaveLength(0);
  });

  it("si vuelve a caer la conexión durante el envío, conserva lo pendiente", async () => {
    const { ejecutar, obtenerCola, sincronizarCola } = await cargar();
    setOnline(false);
    await ejecutar("enviar_comanda", { p_token: "a" }, { etiqueta: "A" });
    await ejecutar("enviar_comanda", { p_token: "b" }, { etiqueta: "B" });
    setOnline(true);
    rpc.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    await sincronizarCola();
    expect(obtenerCola()).toHaveLength(2);
    expect(obtenerCola().every((o) => !o.error)).toBe(true);
  });
});
