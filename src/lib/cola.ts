import { supabase } from "@/integrations/supabase/client";

/** Operación pendiente: una función de base de datos que se ejecutará cuando haya conexión. */
export type Operacion = {
  id: string;
  fn: string;
  args: Record<string, unknown>;
  etiqueta: string;
  resumen?: string | undefined;
  creada: string;
  /** Si el servidor la rechazó (no por falta de red), el motivo queda aquí para revisarla. */
  error?: string | undefined;
};

export type ResultadoEjecucion =
  | { estado: "ok"; valor: unknown }
  | { estado: "encolada" }
  | { estado: "error"; mensaje: string };

const CLAVE = "faro-cola-operaciones";
const oyentes = new Set<() => void>();
let memoria: Operacion[] | null = null;

function leer(): Operacion[] {
  if (memoria) return memoria;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CLAVE) : null;
    memoria = raw ? (JSON.parse(raw) as Operacion[]) : [];
  } catch {
    memoria = [];
  }
  return memoria;
}

function escribir(ops: Operacion[]) {
  memoria = ops;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ops));
  } catch {
    /* Almacenamiento lleno: la cola sigue en memoria mientras la pestaña esté abierta. */
  }
  oyentes.forEach((f) => f());
}

export function suscribirCola(f: () => void): () => void {
  oyentes.add(f);
  return () => {
    oyentes.delete(f);
  };
}

export function obtenerCola(): Operacion[] {
  return leer();
}

const estaOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

/** Errores de conexión (no de reglas de negocio): la operación se conserva para reintentar. */
export function esErrorDeRed(error: { message?: string } | null | undefined): boolean {
  if (estaOffline()) return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|network/i.test(error?.message ?? "");
}

type Opciones = { etiqueta: string; resumen?: string };

function encolar(fn: string, args: Record<string, unknown>, o: Opciones) {
  escribir([
    ...leer(),
    { id: crypto.randomUUID(), fn, args, etiqueta: o.etiqueta, resumen: o.resumen, creada: new Date().toISOString() },
  ]);
}

/**
 * Ejecuta una función de base de datos. Si no hay conexión, la guarda en la cola local.
 * Las comandas llevan un token único, así que reenviarlas no duplica pedidos.
 */
export async function ejecutar(fn: string, args: Record<string, unknown>, o: Opciones): Promise<ResultadoEjecucion> {
  if (estaOffline()) {
    encolar(fn, args, o);
    return { estado: "encolada" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (!error) return { estado: "ok", valor: data };
  if (esErrorDeRed(error)) {
    encolar(fn, args, o);
    return { estado: "encolada" };
  }
  return { estado: "error", mensaje: error.message };
}

let sincronizando = false;

/** Envía en orden las operaciones pendientes. Se detiene si vuelve a caer la conexión. */
export async function sincronizarCola(): Promise<void> {
  if (sincronizando || estaOffline() || leer().length === 0) return;
  sincronizando = true;
  try {
    for (const op of leer().filter((o) => !o.error)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.rpc(op.fn as any, op.args as any);
      if (error && esErrorDeRed(error)) break;
      escribir(
        error
          ? leer().map((o) => (o.id === op.id ? { ...o, error: error.message } : o))
          : leer().filter((o) => o.id !== op.id),
      );
    }
  } finally {
    sincronizando = false;
  }
}

export function descartarOperacion(id: string) {
  escribir(leer().filter((o) => o.id !== id));
}

export function reintentarOperacion(id: string) {
  escribir(leer().map((o) => (o.id === id ? { ...o, error: undefined } : o)));
  void sincronizarCola();
}

/** Sincroniza al reconectar y cada 15 segundos. Devuelve la función para detenerlo. */
export function iniciarSincronizacion(): () => void {
  const alCambiar = () => void sincronizarCola();
  window.addEventListener("online", alCambiar);
  const t = window.setInterval(alCambiar, 15_000);
  alCambiar();
  return () => {
    window.removeEventListener("online", alCambiar);
    window.clearInterval(t);
  };
}
