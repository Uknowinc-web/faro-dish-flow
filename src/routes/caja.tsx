import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Banknote, CreditCard, Plus, Receipt, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { horaMty, mxn } from "@/lib/catalogo";
import { resumenPago } from "@/lib/pagos";
import { Corte } from "@/components/corte";
import { PinGate, SesionBar, useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/caja")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Caja — Tacos el Faro" },
      { name: "description", content: "Cuentas activas, cobro y corte de caja diario." },
      { property: "og:title", content: "Caja — Tacos el Faro" },
      { property: "og:description", content: "Cuentas activas, cobro y corte de caja diario." },
    ],
  }),
  component: () => <PinGate estacion="caja" permiso="estacion.caja"><Caja /></PinGate>,
});

const estiloMesa: Record<string, string> = {
  disponible: "border-border text-muted-foreground",
  ocupada: "border-primary bg-primary/10",
  por_cobrar: "border-warning bg-warning/15",
};

function Caja() {
  useRealtime();
  const { puede } = useSesion();
  return (
    <main className="min-h-screen p-4 md:p-6">
      <header className="flex items-center gap-3 mb-4">
        <Link to="/" aria-label="Inicio"><ArrowLeft /></Link>
        <h1 className="font-display text-5xl flex-1">Caja</h1>
        <SesionBar />
      </header>
      <Tabs defaultValue="mesas">
        <TabsList><TabsTrigger value="mesas">Mesas activas</TabsTrigger>{puede("caja.corte") && <TabsTrigger value="corte">Corte de caja</TabsTrigger>}</TabsList>
        <TabsContent value="mesas"><Mesas /></TabsContent>
        {puede("caja.corte") && <TabsContent value="corte"><Corte /></TabsContent>}
      </Tabs>
    </main>
  );
}

function Mesas() {
  const { puede, pin } = useSesion();
  const [sel, setSel] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const mesas = useQuery({
    queryKey: ["caja-mesas"],
    queryFn: async () => {
      const [{ data: ms }, { data: cs }] = await Promise.all([
        supabase.from("mesas").select("id,nombre,estado,orden").eq("activo", true).order("orden").order("nombre"),
        supabase.from("cuentas").select("id,mesa_id,comandas(comanda_items(cantidad,precio_unitario))").in("estado", ["abierta", "por_cobrar"]),
      ]);
      return (ms ?? []).map((m) => {
        const c = cs?.find((x) => x.mesa_id === m.id);
        const total = c?.comandas.flatMap((k) => k.comanda_items).reduce((s, i) => s + i.cantidad * Number(i.precio_unitario), 0) ?? 0;
        return { ...m, cuentaId: c?.id ?? null, total };
      });
    },
  });

  async function agregarMesa() {
    if (!nueva.trim()) return;
    const { error } = await supabase.rpc("caja_agregar_mesa", { p_pin: pin ?? "", p_nombre: nueva.trim() });
    if (error) { toast.error(error.code === "23505" ? "Ya existe esa mesa" : error.message); return; }
    setNueva("");
    mesas.refetch();
  }

  const actual = mesas.data?.find((m) => m.id === sel);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px] mt-4">
      <div>
        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-3">
          {mesas.data?.map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} className={cn("rounded-xl border-2 bg-card p-4 h-28 text-left transition", estiloMesa[m.estado], sel === m.id && "ring-2 ring-ring")}>
              <p className="font-display text-2xl text-foreground">{m.nombre}</p>
              <p className="text-xs capitalize">{m.estado.replace("_", " ")}</p>
              {m.cuentaId && <p className="font-semibold text-foreground mt-1">{mxn(m.total)}</p>}
            </button>
          ))}
        </div>
        {puede("caja.agregar_mesa") && <div className="flex gap-2 mt-4 max-w-sm">
          <Input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva mesa (ej. Terraza 1)" />
          <Button onClick={agregarMesa}><Plus /> Agregar</Button>
        </div>}
      </div>
      <aside className="rounded-2xl border bg-card p-5 h-fit lg:sticky lg:top-4">
        {actual?.cuentaId ? <Cuenta cuentaId={actual.cuentaId} mesa={actual.nombre} estado={actual.estado} onDone={() => setSel(null)} />
          : <p className="text-muted-foreground text-center py-12">{actual ? `${actual.nombre} está disponible.` : "Selecciona una mesa con cuenta abierta."}</p>}
      </aside>
    </div>
  );
}

function Cuenta({ cuentaId, mesa, estado, onDone }: { cuentaId: string; mesa: string; estado: string; onDone: () => void }) {
  const { puede, pin } = useSesion();
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [propina, setPropina] = useState("");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoClip, setMontoClip] = useState("");
  const q = useQuery({
    queryKey: ["cuenta", cuentaId],
    queryFn: async () =>
      (await supabase.from("comandas").select("id,numero,created_at,comanda_items(id,nombre,cantidad,precio_unitario,modificadores)").eq("cuenta_id", cuentaId).order("created_at")).data ?? [],
  });
  const items = q.data?.flatMap((c) => c.comanda_items) ?? [];
  const total = items.reduce((s, i) => s + i.cantidad * Number(i.precio_unitario), 0);

  // La validación de permiso y el registro en bitácora ocurren en el servidor.
  async function rpc(fn: "caja_solicitar_cuenta" | "caja_anular_cuenta", args: Record<string, string>, ok: string) {
    setBusy(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc(fn, { p_pin: pin ?? "", ...args } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(ok);
    if (fn !== "caja_solicitar_cuenta") onDone();
  }

  return (
    <div>
      <div className="flex justify-between items-baseline">
        <h2 className="font-display text-4xl">{mesa}</h2>
        <span className="text-sm text-muted-foreground">{q.data?.length ?? 0} comandas</span>
      </div>
      <div className="mt-4 space-y-2 max-h-[45vh] overflow-y-auto">
        {q.data?.map((c) => (
          <div key={c.id}>
            <p className="text-xs text-muted-foreground">#{c.numero} · {horaMty(c.created_at)}</p>
            {c.comanda_items.map((i) => (
              <div key={i.id} className="flex justify-between py-1 border-b border-border/50">
                <div>
                  <p>{i.cantidad}× {i.nombre}</p>
                  {Array.isArray(i.modificadores) && i.modificadores.length > 0 && <p className="text-xs text-muted-foreground">{(i.modificadores as string[]).join(", ")}</p>}
                </div>
                <span className="tabular-nums">{mxn(i.cantidad * Number(i.precio_unitario))}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between items-baseline mt-4">
        <span className="text-muted-foreground">Total</span>
        <span className="font-display text-5xl text-primary">{mxn(total)}</span>
      </div>
      <div className="mt-4 space-y-3">
        {estado !== "por_cobrar" && puede("caja.por_cobrar") && (
          <Button variant="secondary" className="w-full h-12" disabled={busy} onClick={() => rpc("caja_solicitar_cuenta", { p_cuenta: cuentaId }, "Mesa marcada por cobrar")}><Receipt /> Marcar por cobrar</Button>
        )}
        {puede("caja.cobrar") && <div className="rounded-xl border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground w-24">Propina</label>
            <Input type="number" min="0" inputMode="decimal" value={propina} onChange={(e) => setPropina(e.target.value)} placeholder="$0" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground w-24 flex items-center gap-1"><Banknote className="size-4" /> Efectivo</label>
            <Input type="number" min="0" inputMode="decimal" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} placeholder={String(total + (Number(propina) || 0))} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground w-24 flex items-center gap-1"><CreditCard className="size-4" /> Clip</label>
            <Input type="number" min="0" inputMode="decimal" value={montoClip} onChange={(e) => setMontoClip(e.target.value)} placeholder="$0" />
          </div>
          {(() => {
            const r = resumenPago(total, Number(propina) || 0, [
              { metodo: "efectivo", monto: Number(montoEfectivo) || 0 },
              { metodo: "clip", monto: Number(montoClip) || 0 },
            ]);
            return (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">A cobrar (con propina)</span>
                  <span className="font-semibold tabular-nums">{mxn(r.objetivo)}</span>
                </div>
                {r.falta > 0 && r.suma > 0 && <p className="text-sm text-warning">Faltan {mxn(r.falta)}</p>}
                {r.cambio > 0 && <p className="text-sm text-info">Cambio: {mxn(r.cambio)}</p>}
                <Button
                  className="w-full h-14"
                  disabled={busy || !r.valido}
                  onClick={async () => {
                    setBusy(true);
                    const pagos = [
                      { metodo: "efectivo", monto: Number(montoEfectivo) || 0 },
                      { metodo: "clip", monto: Number(montoClip) || 0 },
                    ].filter((p) => p.monto > 0);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await supabase.rpc("caja_cobrar_cuenta", { p_pin: pin ?? "", p_cuenta: cuentaId, p_pagos: pagos, p_propina: Number(propina) || 0 } as any);
                    setBusy(false);
                    if (error) { toast.error(error.message); return; }
                    toast.success(r.mixto ? "Cobrado (pago mixto)" : "Cuenta cobrada");
                    onDone();
                  }}
                >
                  Cobrar {mxn(total + (Number(propina) || 0))}
                </Button>
              </>
            );
          })()}
        </div>}
        {puede("caja.anular") && <Button variant="ghost" className="w-full text-destructive" onClick={() => setAnular(true)}><XCircle /> Anular cuenta</Button>}
      </div>
      <Dialog open={anular} onOpenChange={setAnular}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anular cuenta de {mesa}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">La cuenta no se contará en ventas. Escribe el motivo.</p>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de anulación" />
          <DialogFooter>
            <Button variant="destructive" disabled={!motivo.trim() || busy} onClick={async () => { await rpc("caja_anular_cuenta", { p_cuenta: cuentaId, p_motivo: motivo }, "Cuenta anulada"); setAnular(false); setMotivo(""); }}>Confirmar anulación</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

