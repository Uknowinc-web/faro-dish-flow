import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/use-realtime";
import { useCatalogo } from "@/hooks/use-catalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Corte } from "@/components/corte";
import { CATEGORIAS, PRODUCTOS, horaMty, hoyMonterrey, mxn } from "@/lib/catalogo";
import { ETIQUETA_ROL, PinGate, SesionBar, useRolPermisos, useSesion, type Rol } from "@/lib/sesion";
import { GRUPOS_PERMISOS, ROLES_CONFIGURABLES, bitacoraCsv } from "@/lib/permisos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administración — Tacos el Faro" },
      { name: "description", content: "Panel de administración: productos, mesas, empleados, cuentas, turnos y bitácora." },
      { property: "og:title", content: "Administración — Tacos el Faro" },
      { property: "og:description", content: "Panel de administración: productos, mesas, empleados, cuentas, turnos y bitácora." },
    ],
  }),
  component: () => <PinGate estacion="administración" permiso="estacion.admin" guardaPin><Admin /></PinGate>,
});

/** Calls an admin database function with the signed-in admin's PIN. */
function useAdminRpc() {
  const { pin } = useSesion();
  const qc = useQueryClient();
  return async (fn: string, args: Record<string, unknown>, ok: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.rpc(fn as any, { p_admin_pin: pin, ...args } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success(ok);
    qc.invalidateQueries();
    return true;
  };
}

const SECCIONES = [
  { v: "resumen", l: "Resumen", p: "admin.resumen", C: () => <Resumen /> },
  { v: "cuentas", l: "Cuentas", p: "admin.cuentas", C: () => <Cuentas /> },
  { v: "productos", l: "Productos", p: "admin.productos", C: () => <Productos /> },
  { v: "mesas", l: "Mesas", p: "admin.mesas", C: () => <Mesas /> },
  { v: "empleados", l: "Empleados", p: "admin.empleados", C: () => <Empleados /> },
  { v: "turnos", l: "Turnos", p: "admin.turnos", C: () => <Turnos /> },
  { v: "bitacora", l: "Bitácora", p: "admin.bitacora", C: () => <Bitacora /> },
  { v: "permisos", l: "Permisos", p: "solo-admin", C: () => <Permisos /> },
] as const;

function Admin() {
  useRealtime();
  const { puede, empleado } = useSesion();
  const visibles = SECCIONES.filter((s) => (s.p === "solo-admin" ? empleado.rol === "admin" : puede(s.p)));
  return (
    <main className="min-h-dvh p-4 md:p-6">
      <header className="flex items-center gap-3 mb-4">
        <Link to="/" aria-label="Inicio"><ArrowLeft /></Link>
        <h1 className="font-display text-4xl sm:text-5xl flex-1">Administración</h1>
        <SesionBar />
      </header>
      {visibles.length === 0 ? <p className="text-muted-foreground">No tienes secciones asignadas.</p> : (
        <Tabs defaultValue={visibles[0]!.v}>
          <TabsList className="flex-wrap h-auto">
            {visibles.map((s) => <TabsTrigger key={s.v} value={s.v} className="py-2">{s.l}</TabsTrigger>)}
          </TabsList>
          {visibles.map((s) => <TabsContent key={s.v} value={s.v}><s.C /></TabsContent>)}
        </Tabs>
      )}
    </main>
  );
}

const card = "rounded-2xl border bg-card p-5";

function Resumen() {
  const rpc = useAdminRpc();
  const { puede } = useSesion();
  const [fondo, setFondo] = useState("");
  const fecha = hoyMonterrey();
  const vm = useQuery({
    queryKey: ["ventas-mesero", fecha],
    queryFn: async () =>
      (await supabase.from("cuentas").select("id,propina,comandas(mesero,created_at,comanda_items(cantidad,precio_unitario))").eq("fecha_operativa", fecha).eq("estado", "pagada")).data ?? [],
  });
  const porMesero = new Map<string, { comandas: number; ventas: number; propinas: number }>();
  vm.data?.forEach((c) => {
    const ks = [...c.comandas].sort((a, b) => a.created_at.localeCompare(b.created_at));
    ks.forEach((k, idx) => {
      const n = k.mesero ?? "Sin nombre";
      const t = porMesero.get(n) ?? { comandas: 0, ventas: 0, propinas: 0 };
      t.comandas += 1;
      t.ventas += k.comanda_items.reduce((s, i) => s + i.cantidad * Number(i.precio_unitario), 0);
      if (idx === 0) t.propinas += Number(c.propina ?? 0);
      porMesero.set(n, t);
    });
  });

  return (
    <div className="space-y-6 mt-4">
      {puede("admin.fondo") && <div className={cn(card, "flex flex-wrap items-center gap-3")}>
        <span className="text-sm text-muted-foreground">Fondo inicial de caja de hoy</span>
        <Input type="number" min="0" className="w-40" value={fondo} onChange={(e) => setFondo(e.target.value)} placeholder="$0" />
        <Button disabled={fondo === ""} onClick={async () => { if (await rpc("admin_fondo_caja", { p_fecha: fecha, p_monto: Number(fondo) }, "Fondo guardado")) setFondo(""); }}><Save /> Guardar fondo</Button>
      </div>}
      <Corte />
      <div className={card}>
        <h3 className="font-display text-3xl mb-3">Ventas por mesero (hoy)</h3>
        {porMesero.size === 0 ? <p className="text-muted-foreground">Sin ventas cobradas hoy.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left">
            <thead className="text-sm text-muted-foreground"><tr><th>Mesero</th><th className="text-right">Comandas</th><th className="text-right">Ventas</th><th className="text-right">Propinas</th></tr></thead>
            <tbody>{[...porMesero.entries()].sort((a, b) => b[1].ventas - a[1].ventas).map(([n, t]) => (
              <tr key={n} className="border-t"><td className="py-2">{n}</td><td className="text-right">{t.comandas}</td><td className="text-right tabular-nums">{mxn(t.ventas)}</td><td className="text-right tabular-nums">{mxn(t.propinas)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <p className="text-xs text-muted-foreground mt-2">La propina se asigna al mesero que abrió la cuenta.</p>
      </div>
    </div>
  );
}

function Cuentas() {
  const rpc = useAdminRpc();
  const [fecha, setFecha] = useState(hoyMonterrey());
  const q = useQuery({
    queryKey: ["admin-cuentas", fecha],
    queryFn: async () => {
      const sel = "id,estado,total,propina,metodo_pago,motivo_anulacion,abierta_at,mesas(nombre),comandas(numero,mesero,comanda_items(id,nombre,cantidad,precio_unitario))";
      const [abiertas, cerradas] = await Promise.all([
        supabase.from("cuentas").select(sel).in("estado", ["abierta", "por_cobrar"]).order("abierta_at"),
        supabase.from("cuentas").select(sel).eq("fecha_operativa", fecha).in("estado", ["pagada", "anulada"]).order("cerrada_at", { ascending: false }),
      ]);
      return [...(abiertas.data ?? []), ...(cerradas.data ?? [])];
    },
  });

  function pedirMotivo(txt: string) {
    const m = window.prompt(txt);
    return m && m.trim() ? m.trim() : null;
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Cuentas cerradas del día</label>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
      </div>
      {q.data?.length === 0 && <p className="text-muted-foreground">Sin cuentas.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {q.data?.map((c) => {
          const abierta = c.estado === "abierta" || c.estado === "por_cobrar";
          const items = c.comandas.flatMap((k) => k.comanda_items);
          const total = items.reduce((s, i) => s + i.cantidad * Number(i.precio_unitario), 0);
          return (
            <div key={c.id} className={card}>
              <div className="flex justify-between items-baseline">
                <h3 className="font-display text-3xl">{(c.mesas as { nombre: string } | null)?.nombre}</h3>
                <span className={cn("text-xs rounded-full px-2 py-1", abierta ? "bg-primary/20" : c.estado === "anulada" ? "bg-destructive/20" : "bg-success/20")}>{c.estado.replace("_", " ")}</span>
              </div>
              <p className="text-xs text-muted-foreground">Abierta {horaMty(c.abierta_at)} · {[...new Set(c.comandas.map((k) => k.mesero).filter(Boolean))].join(", ") || "—"}</p>
              <div className="mt-2 space-y-1">
                {items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-sm border-b border-border/50 py-1">
                    <span>{i.cantidad}× {i.nombre}</span>
                    <span className="flex items-center gap-1 tabular-nums">{mxn(i.cantidad * Number(i.precio_unitario))}
                      {abierta && (
                        <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label="Cancelar producto" onClick={() => {
                          const m = pedirMotivo(`Motivo para cancelar ${i.cantidad}× ${i.nombre}`);
                          if (m) rpc("admin_cancelar_item", { p_item: i.id, p_motivo: m }, "Producto cancelado");
                        }}><Trash2 className="size-4" /></Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 font-semibold"><span>Total</span><span>{mxn(abierta ? total : Number(c.total ?? 0))}</span></div>
              {!abierta && c.estado === "pagada" && <p className="text-xs text-muted-foreground">{c.metodo_pago} · propina {mxn(Number(c.propina ?? 0))}</p>}
              {c.motivo_anulacion && <p className="text-xs text-destructive">Motivo: {c.motivo_anulacion}</p>}
              {!abierta && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                  const m = pedirMotivo("Motivo para reabrir la cuenta (se borrarán sus pagos)");
                  if (m) rpc("admin_reabrir_cuenta", { p_cuenta: c.id, p_motivo: m }, "Cuenta reabierta");
                }}><RotateCcw /> Reabrir cuenta</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Productos() {
  const rpc = useAdminRpc();
  const catalogo = useCatalogo();
  const [precios, setPrecios] = useState<Record<string, string>>({});
  return (
    <div className="mt-4 space-y-6">
      {CATEGORIAS.map((cat) => (
        <div key={cat} className={card}>
          <h3 className="font-display text-3xl mb-2">{cat}</h3>
          {catalogo.filter((p) => p.categoria === cat).map((p) => {
            const base = PRODUCTOS.find((x) => x.id === p.id)!.precio;
            const v = precios[p.id] ?? String(p.precio);
            const guardar = (agotado: boolean, precio: number | null) =>
              rpc("admin_ajustar_producto", { p_producto: p.id, p_nombre: p.nombre, p_precio: precio === base ? null : precio, p_agotado: agotado }, "Producto actualizado");
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2 py-2 border-t">
                <span className={cn("flex-1 min-w-40", p.agotado && "line-through text-muted-foreground")}>{p.nombre}</span>
                {p.precio !== base && <span className="text-xs text-warning">catálogo {mxn(base)}</span>}
                <Input type="number" min="0" className="w-28" value={v} onChange={(e) => setPrecios((s) => ({ ...s, [p.id]: e.target.value }))} />
                <Button size="sm" disabled={v === "" || Number(v) === p.precio} onClick={async () => { if (await guardar(p.agotado, Number(v))) setPrecios((s) => { const n = { ...s }; delete n[p.id]; return n; }); }}><Save /></Button>
                <Button size="sm" variant={p.agotado ? "default" : "secondary"} onClick={() => guardar(!p.agotado, p.precio)}>{p.agotado ? "Marcar disponible" : "Agotado"}</Button>
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Los cambios de precio aplican a comandas nuevas; las cuentas ya registradas conservan su precio.</p>
    </div>
  );
}

function Mesas() {
  const rpc = useAdminRpc();
  const [nueva, setNueva] = useState("");
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["admin-mesas"],
    queryFn: async () => (await supabase.from("mesas").select("id,nombre,estado,activo").order("orden").order("nombre")).data ?? [],
  });
  return (
    <div className={cn(card, "mt-4 max-w-2xl")}>
      <div className="flex gap-2 mb-4">
        <Input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Nueva mesa (ej. Terraza 1)" />
        <Button disabled={!nueva.trim()} onClick={async () => { if (await rpc("admin_guardar_mesa", { p_id: null, p_nombre: nueva, p_activo: true }, "Mesa agregada")) setNueva(""); }}><Plus /> Agregar</Button>
      </div>
      {q.data?.map((m) => {
        const v = nombres[m.id] ?? m.nombre;
        return (
          <div key={m.id} className="flex items-center gap-2 py-2 border-t">
            <Input value={v} onChange={(e) => setNombres((s) => ({ ...s, [m.id]: e.target.value }))} className={cn(!m.activo && "opacity-50")} />
            <span className="text-xs text-muted-foreground w-24 capitalize">{m.estado.replace("_", " ")}</span>
            <Button size="sm" disabled={v === m.nombre} onClick={() => rpc("admin_guardar_mesa", { p_id: m.id, p_nombre: v, p_activo: m.activo }, "Mesa renombrada")}><Save /></Button>
            <Button size="sm" variant="secondary" onClick={() => rpc("admin_guardar_mesa", { p_id: m.id, p_nombre: m.nombre, p_activo: !m.activo }, m.activo ? "Mesa desactivada" : "Mesa activada")}>{m.activo ? "Desactivar" : "Activar"}</Button>
          </div>
        );
      })}
    </div>
  );
}

const ROLES: Rol[] = ["mesero", "cocina", "caja", "admin"];

function Empleados() {
  const rpc = useAdminRpc();
  const [nuevo, setNuevo] = useState({ nombre: "", rol: "mesero" as Rol, pin: "" });
  const [pins, setPins] = useState<Record<string, string>>({});
  const q = useQuery({
    queryKey: ["empleados"],
    queryFn: async () => (await supabase.from("empleados").select("id,nombre,rol,activo").order("nombre")).data ?? [],
  });
  const selRol = (v: Rol, on: (r: Rol) => void) => (
    <select value={v} onChange={(e) => on(e.target.value as Rol)} className="h-11 md:h-9 rounded-md border bg-background px-2 text-base md:text-sm">
      {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
    </select>
  );
  return (
    <div className={cn(card, "mt-4 max-w-3xl")}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input className="flex-1 min-w-40" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre" />
        {selRol(nuevo.rol, (rol) => setNuevo({ ...nuevo, rol }))}
        <Input className="w-28" inputMode="numeric" maxLength={6} value={nuevo.pin} onChange={(e) => setNuevo({ ...nuevo, pin: e.target.value.replace(/\D/g, "") })} placeholder="PIN" />
        <Button disabled={!nuevo.nombre.trim() || nuevo.pin.length < 4} onClick={async () => {
          if (await rpc("admin_guardar_empleado", { p_id: null, p_nombre: nuevo.nombre, p_rol: nuevo.rol, p_pin: nuevo.pin, p_activo: true }, "Empleado agregado")) setNuevo({ nombre: "", rol: "mesero", pin: "" });
        }}><Plus /> Agregar</Button>
      </div>
      {q.data?.map((e) => {
        const guardar = (cambios: Partial<{ rol: Rol; activo: boolean; pin: string }>, ok: string) =>
          rpc("admin_guardar_empleado", { p_id: e.id, p_nombre: e.nombre, p_rol: cambios.rol ?? e.rol, p_pin: cambios.pin ?? null, p_activo: cambios.activo ?? e.activo }, ok);
        return (
          <div key={e.id} className={cn("flex flex-wrap items-center gap-2 py-2 border-t", !e.activo && "opacity-50")}>
            <span className="flex-1 min-w-32 font-semibold">{e.nombre}</span>
            {selRol(e.rol as Rol, (rol) => guardar({ rol }, "Rol actualizado"))}
            <Input className="w-28" inputMode="numeric" maxLength={6} value={pins[e.id] ?? ""} onChange={(ev) => setPins((s) => ({ ...s, [e.id]: ev.target.value.replace(/\D/g, "") }))} placeholder="Nuevo PIN" />
            <Button size="sm" disabled={(pins[e.id] ?? "").length < 4} onClick={async () => { if (await guardar({ pin: pins[e.id] ?? "" }, "PIN cambiado")) setPins((s) => ({ ...s, [e.id]: "" })); }}><Save /></Button>
            <Button size="sm" variant="secondary" onClick={() => guardar({ activo: !e.activo }, e.activo ? "Empleado dado de baja" : "Empleado reactivado")}>{e.activo ? "Dar de baja" : "Reactivar"}</Button>
          </div>
        );
      })}
    </div>
  );
}

const horas = (a: string, b: string | null) => ((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 3600_000;

function Turnos() {
  const [fecha, setFecha] = useState(hoyMonterrey());
  const q = useQuery({
    queryKey: ["turnos", fecha],
    queryFn: async () => {
      const desde = new Date(`${fecha}T00:00:00-06:00`).toISOString();
      const hasta = new Date(new Date(desde).getTime() + 86400_000).toISOString();
      return (await supabase.from("turnos").select("id,entrada,salida,empleados(nombre,rol)").gte("entrada", desde).lt("entrada", hasta).order("entrada")).data ?? [];
    },
  });
  return (
    <div className={cn(card, "mt-4 max-w-3xl")}>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-muted-foreground">Fecha</label>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
      </div>
      {q.data?.length === 0 ? <p className="text-muted-foreground">Sin entradas registradas.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-left">
          <thead className="text-sm text-muted-foreground"><tr><th>Empleado</th><th>Entrada</th><th>Salida</th><th className="text-right">Horas</th></tr></thead>
          <tbody>{q.data?.map((t) => {
            const e = t.empleados as { nombre: string; rol: Rol } | null;
            return (
              <tr key={t.id} className="border-t">
                <td className="py-2">{e?.nombre} <span className="text-xs text-muted-foreground">{e ? ETIQUETA_ROL[e.rol] : ""}</span></td>
                <td>{horaMty(t.entrada)}</td>
                <td>{t.salida ? horaMty(t.salida) : <span className="text-success">En turno</span>}</td>
                <td className="text-right tabular-nums">{horas(t.entrada, t.salida).toFixed(1)}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}

function Permisos() {
  const rpc = useAdminRpc();
  const q = useRolPermisos();
  const [edit, setEdit] = useState<Record<string, string[]>>({});
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      {ROLES_CONFIGURABLES.map((rol) => {
        const actuales = q.data?.find((r) => r.rol === rol)?.permisos ?? [];
        const sel = edit[rol] ?? actuales;
        const cambiado = edit[rol] !== undefined && [...sel].sort().join() !== [...actuales].sort().join();
        const toggle = (k: string) => setEdit((e) => ({ ...e, [rol]: sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k] }));
        return (
          <div key={rol} className={card}>
            <h3 className="font-display text-3xl">{ETIQUETA_ROL[rol]}</h3>
            {GRUPOS_PERMISOS.map((g) => (
              <div key={g.nombre} className="mt-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{g.nombre}</p>
                {g.permisos.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                    <input type="checkbox" className="size-4 accent-primary" checked={sel.includes(p.key)} onChange={() => toggle(p.key)} />
                    {p.label}
                  </label>
                ))}
              </div>
            ))}
            <Button className="w-full mt-4" disabled={!cambiado} onClick={async () => {
              if (await rpc("admin_guardar_permisos", { p_rol: rol, p_permisos: sel }, `Permisos de ${ETIQUETA_ROL[rol]} guardados`)) setEdit((e) => { const n = { ...e }; delete n[rol]; return n; });
            }}><Save /> Guardar</Button>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground md:col-span-3">El Administrador siempre tiene todos los permisos. Los cambios aplican al momento en todas las pantallas.</p>
    </div>
  );
}

/** Monterrey has no daylight saving: local midnight is 06:00 UTC. */
const inicioMty = (fecha: string) => new Date(`${fecha}T00:00:00-06:00`).toISOString();

function Bitacora() {
  const hoy = hoyMonterrey();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [empleado, setEmpleado] = useState("");
  const [accion, setAccion] = useState("");
  const [texto, setTexto] = useState("");
  const empleados = useQuery({
    queryKey: ["empleados"],
    queryFn: async () => (await supabase.from("empleados").select("id,nombre,rol,activo").order("nombre")).data ?? [],
  });
  const q = useQuery({
    queryKey: ["bitacora", desde, hasta, empleado],
    queryFn: async () => {
      let r = supabase.from("bitacora").select("id,empleado_nombre,accion,detalle,created_at")
        .gte("created_at", inicioMty(desde))
        .lt("created_at", new Date(new Date(inicioMty(hasta)).getTime() + 86400_000).toISOString())
        .order("created_at", { ascending: false }).limit(5000);
      if (empleado) r = r.eq("empleado_id", empleado);
      return (await r).data ?? [];
    },
  });
  const acciones = [...new Set((q.data ?? []).map((b) => b.accion))].sort();
  const t = texto.toLowerCase();
  const filas = (q.data ?? []).filter((b) => (!accion || b.accion === accion) && (!t || [b.empleado_nombre, b.detalle].some((x) => x?.toLowerCase().includes(t))));

  function exportar() {
    const blob = new Blob([bitacoraCsv(filas)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bitacora_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sel = "h-11 md:h-9 rounded-md border bg-background px-2 text-base md:text-sm";
  return (
    <div className={cn(card, "mt-4")}>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <label className="text-xs text-muted-foreground">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-auto" /></label>
        <label className="text-xs text-muted-foreground">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-auto" /></label>
        <label className="text-xs text-muted-foreground flex flex-col">Empleado
          <select className={sel} value={empleado} onChange={(e) => setEmpleado(e.target.value)} aria-label="Empleado">
            <option value="">Todos</option>
            {empleados.data?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground flex flex-col">Acción
          <select className={sel} value={accion} onChange={(e) => setAccion(e.target.value)} aria-label="Acción">
            <option value="">Todas</option>
            {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar en detalle (ej. Mesa 3)" className="max-w-xs" />
        <Button variant="secondary" disabled={filas.length === 0} onClick={exportar}><Download /> Exportar CSV</Button>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{filas.length} registros</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead className="text-muted-foreground"><tr><th>Hora</th><th>Empleado</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>{filas.map((b) => (
          <tr key={b.id} className="border-t align-top">
            <td className="py-2 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString("es-MX", { timeZone: "America/Monterrey", day: "2-digit", month: "short" })} {horaMty(b.created_at)}</td>
            <td className="font-semibold">{b.empleado_nombre ?? "—"}</td>
            <td>{b.accion}</td>
            <td className="text-muted-foreground">{b.detalle}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
