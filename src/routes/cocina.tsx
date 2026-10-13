import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, BellOff, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { useConexion } from "@/hooks/use-conexion";
import { Button } from "@/components/ui/button";
import { TicketComanda } from "@/components/ticket-comanda";
import { cn } from "@/lib/utils";
import { PinGate, SesionBar, useSesion } from "@/lib/sesion";
import { ejecutar } from "@/lib/cola";
import { ticketDesdeComanda, type DatosTicket } from "@/lib/ticket";
import { horaMty } from "@/lib/catalogo";

export const Route = createFileRoute("/cocina")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Cocina KDS — Tacos el Faro" },
      { name: "description", content: "Pantalla de comandas de cocina en tiempo real." },
      { property: "og:title", content: "Cocina KDS — Tacos el Faro" },
      { property: "og:description", content: "Pantalla de comandas de cocina en tiempo real." },
    ],
  }),
  component: () => <PinGate estacion="cocina" permiso="estacion.cocina"><Cocina /></PinGate>,
});

const siguiente: Record<string, { estado: string; label: string; cls: string }> = {
  pendiente: { estado: "preparacion", label: "Empezar", cls: "bg-warning text-warning-foreground hover:bg-warning/90" },
  preparacion: { estado: "listo", label: "Listo", cls: "bg-success text-success-foreground hover:bg-success/90" },
};
const etiquetaEstado: Record<string, string> = { preparacion: "en preparación", listo: "listo" };

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + t);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.18);
    });
  } catch { /* audio no disponible */ }
}

function Cocina() {
  const [sonido, setSonido] = useState(false);
  const [flash, setFlash] = useState(false);
  const [ticket, setTicket] = useState<DatosTicket | null>(null);
  const { pin } = useSesion();
  const conectado = useConexion();
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;

  useRealtime(() => {
    if (sonidoRef.current) beep();
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  });

  const q = useQuery({
    queryKey: ["kds"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 12 * 3600_000).toISOString();
      const { data } = await supabase
        .from("comandas")
        .select("id,numero,estado,created_at,mesero,mesas(nombre),comanda_items(id,nombre,cantidad,modificadores,notas,estacion)")
        .in("estado", ["pendiente", "preparacion"])
        .gte("created_at", desde)
        .order("created_at");
      // Cocina solo muestra comida: las bebidas (estación "bebida") no llegan aquí.
      return (data ?? [])
        .map((c) => ({ ...c, comanda_items: c.comanda_items.filter((i) => i.estacion === "cocina") }))
        .filter((c) => c.comanda_items.length > 0);
    },
  });

  // Al terminar de imprimir se retira el ticket del DOM.
  useEffect(() => {
    const limpiar = () => setTicket(null);
    window.addEventListener("afterprint", limpiar);
    return () => window.removeEventListener("afterprint", limpiar);
  }, []);

  async function avanzar(id: string, numero: number, estado: string) {
    // El servidor valida el PIN, el permiso de cocina y la transición de estado.
    const r = await ejecutar("cocina_cambiar_estado", { p_pin: pin ?? "", p_comanda: id, p_estado: estado }, {
      etiqueta: `Comanda #${numero}`,
      resumen: `Cambiar a ${etiquetaEstado[estado] ?? estado}`,
    });
    if (r.estado === "error") toast.error(r.mensaje);
    else if (r.estado === "encolada") toast.info("Sin conexión: el cambio se aplicará al reconectar");
    q.refetch();
  }

  async function imprimir(c: NonNullable<typeof q.data>[number]) {
    const mesa = (c.mesas as { nombre: string } | null)?.nombre ?? "";
    const r = await ejecutar("cocina_imprimir_comanda", { p_pin: pin ?? "", p_comanda: c.id }, {
      etiqueta: `Ticket #${c.numero} · ${mesa}`,
      resumen: "Imprimir ticket y pasar a en preparación",
    });
    if (r.estado === "error") { toast.error(r.mensaje); return; }
    // La impresión es local: se imprime aunque no haya internet; el estado se actualiza al reconectar.
    setTicket(ticketDesdeComanda({
      numero: c.numero,
      created_at: c.created_at,
      mesero: c.mesero,
      mesa,
      items: c.comanda_items,
    }));
    if (r.estado === "encolada") toast.info("Sin conexión: se imprime y el estado se actualizará al reconectar");
    setTimeout(() => window.print(), 100);
  }

  return (
    <main className={cn("min-h-dvh p-4 md:p-6 transition-colors", flash && "bg-primary/20")}>
      <header className="flex flex-wrap items-center gap-3 mb-4">
        <Link to="/" aria-label="Inicio"><ArrowLeft /></Link>
        <h1 className="font-display text-4xl sm:text-5xl flex-1">Cocina</h1>
        <SesionBar />
        <span className="text-muted-foreground">{q.data?.length ?? 0} en cola</span>
        <Button variant={sonido ? "default" : "secondary"} onClick={() => { setSonido(!sonido); if (!sonido) beep(); }}>
          {sonido ? <Bell /> : <BellOff />} {sonido ? "Sonido activo" : "Activar sonido"}
        </Button>
      </header>
      {!conectado && <p className="mb-4 text-sm text-warning">Sin conexión: los cambios de estado se guardan y se envían al reconectar.</p>}
      {q.data?.length === 0 && <p className="text-center text-2xl text-muted-foreground py-24">Sin comandas pendientes 🔥</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {q.data?.map((c) => {
          const sig = siguiente[c.estado] ?? siguiente["preparacion"]!;
          return (
            <article key={c.id} className={cn("rounded-2xl border-4 bg-card flex flex-col", c.estado === "pendiente" ? "border-primary" : "border-warning")}>
              <div className="flex justify-between items-baseline p-4 border-b">
                <span className="font-display text-5xl">#{c.numero}</span>
                <div className="text-right">
                  <p className="font-display text-3xl">{(c.mesas as { nombre: string } | null)?.nombre}</p>
                  <p className="text-muted-foreground">{horaMty(c.created_at)}</p>
                </div>
              </div>
              <ul className="p-4 space-y-3 flex-1">
                {c.comanda_items.map((i) => (
                  <li key={i.id}>
                    <p className="text-2xl font-bold"><span className="text-primary">{i.cantidad}×</span> {i.nombre}</p>
                    {Array.isArray(i.modificadores) && i.modificadores.length > 0 && (
                      <p className="text-lg font-semibold text-warning">{(i.modificadores as string[]).join(" · ")}</p>
                    )}
                    {i.notas && <p className="text-lg font-semibold bg-destructive/20 text-foreground rounded px-2 mt-1">⚠ {i.notas}</p>}
                  </li>
                ))}
              </ul>
              <button onClick={() => imprimir(c)} className="h-12 flex items-center justify-center gap-2 border-t bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80">
                <Printer className="size-5" /> Imprimir ticket
              </button>
              <button onClick={() => avanzar(c.id, c.numero, sig.estado)} className={cn("h-16 text-2xl font-display rounded-b-xl", sig.cls)}>
                {c.estado === "pendiente" ? "Pendiente → " : "En preparación → "}{sig.label}
              </button>
            </article>
          );
        })}
      </div>
      <TicketComanda datos={ticket} />
    </main>
  );
}
