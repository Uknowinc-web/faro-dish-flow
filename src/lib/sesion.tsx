import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Delete, LogIn, LogOut, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type Rol = "mesero" | "cocina" | "caja" | "admin";
export type Empleado = { id: string; nombre: string; rol: Rol };
type Sesion = { empleado: Empleado; pin: string | null; salir: () => void };

const Ctx = createContext<Sesion | null>(null);

export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSesion fuera de PinGate");
  return s;
}

/** Writes one line to the action log under the signed-in employee. */
export function useBitacora() {
  const { empleado } = useSesion();
  return useCallback(
    (accion: string, detalle?: string) => {
      void supabase.from("bitacora").insert({ empleado_id: empleado.id, empleado_nombre: empleado.nombre, accion, detalle: detalle ?? null });
    },
    [empleado],
  );
}

export const ETIQUETA_ROL: Record<Rol, string> = { mesero: "Mesero", cocina: "Cocina", caja: "Caja", admin: "Administrador" };

/** Admin can enter every station; others only stations listing their role. */
export function puedeEntrar(rol: Rol, permitidos: Rol[]) {
  return rol === "admin" || permitidos.includes(rol);
}

export function PinGate({ estacion, roles, children }: { estacion: string; roles: Rol[]; children: ReactNode }) {
  const key = `faro-sesion-${estacion}`;
  const guardaPin = roles.length === 1 && roles[0] === "admin";
  const [sesion, setSesion] = useState<{ empleado: Empleado; pin: string | null } | null | undefined>(undefined);

  useEffect(() => {
    const raw = (guardaPin ? sessionStorage : localStorage).getItem(key);
    setSesion(raw ? JSON.parse(raw) : null);
  }, [key, guardaPin]);

  const salir = useCallback(() => {
    (guardaPin ? sessionStorage : localStorage).removeItem(key);
    setSesion(null);
  }, [key, guardaPin]);

  if (sesion === undefined) return null;
  if (!sesion) {
    return (
      <PinPad
        titulo={estacion}
        onEntrar={(empleado, pin) => {
          if (!puedeEntrar(empleado.rol, roles)) { toast.error(`${empleado.nombre} no tiene acceso a ${estacion}`); return; }
          const s = { empleado, pin: guardaPin ? pin : null };
          (guardaPin ? sessionStorage : localStorage).setItem(key, JSON.stringify(s));
          setSesion(s);
        }}
      />
    );
  }
  return <Ctx.Provider value={{ ...sesion, salir }}>{children}</Ctx.Provider>;
}

export function SesionBar() {
  const { empleado, salir } = useSesion();
  return (
    <div className="flex items-center gap-2 text-sm">
      <UserRound className="size-4 text-primary" />
      <span className="font-semibold">{empleado.nombre}</span>
      <Button size="sm" variant="ghost" onClick={salir} aria-label="Cambiar usuario"><LogOut className="size-4" /></Button>
    </div>
  );
}

function PinPad({ titulo, onEntrar }: { titulo: string; onEntrar: (e: Empleado, pin: string) => void }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function verificar(): Promise<Empleado | null> {
    const { data, error } = await supabase.rpc("verificar_pin", { p_pin: pin });
    if (error || !data?.[0]) { toast.error("PIN incorrecto"); setPin(""); return null; }
    return data[0] as Empleado;
  }
  async function entrar() {
    setBusy(true);
    const e = await verificar();
    setBusy(false);
    if (e) onEntrar(e, pin);
  }
  async function turno(tipo: "entrada" | "salida") {
    setBusy(true);
    const { error } = await supabase.rpc("registrar_turno", { p_pin: pin, p_tipo: tipo });
    setBusy(false);
    setPin("");
    if (error) { toast.error(error.message); return; }
    toast.success(tipo === "entrada" ? "Entrada registrada" : "Salida registrada");
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <Link to="/" className="self-start flex items-center gap-1 text-muted-foreground mb-6"><ArrowLeft className="size-4" /> Inicio</Link>
      <p className="text-sm tracking-[0.3em] uppercase text-primary">Tacos el Faro</p>
      <h1 className="font-display text-6xl capitalize">{titulo}</h1>
      <p className="text-muted-foreground mt-1">Ingresa tu PIN</p>
      <div className="flex gap-3 my-6 h-6">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={`size-4 rounded-full border-2 border-primary ${i < pin.length ? "bg-primary" : ""}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {teclas.map((t, i) => t === "" ? <span key={i} /> : (
          <Button key={i} variant="secondary" className="h-16 text-2xl" aria-label={t === "⌫" ? "Borrar" : t}
            onClick={() => setPin((p) => (t === "⌫" ? p.slice(0, -1) : p.length < 6 ? p + t : p))}>
            {t === "⌫" ? <Delete /> : t}
          </Button>
        ))}
      </div>
      <Button className="w-full max-w-xs h-14 mt-4" disabled={pin.length < 4 || busy} onClick={entrar}><LogIn /> Entrar</Button>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs mt-3">
        <Button variant="outline" disabled={pin.length < 4 || busy} onClick={() => turno("entrada")}>Registrar entrada</Button>
        <Button variant="outline" disabled={pin.length < 4 || busy} onClick={() => turno("salida")}>Registrar salida</Button>
      </div>
    </main>
  );
}
