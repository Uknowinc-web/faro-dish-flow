import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { hoyMonterrey, mxn } from "@/lib/catalogo";
import { efectivoNeto } from "@/lib/pagos";

export function Corte() {
  const [fecha, setFecha] = useState(hoyMonterrey());
  const q = useQuery({
    queryKey: ["corte", fecha],
    queryFn: async () => {
      const cs = (await supabase.from("cuentas").select("id,estado,metodo_pago,total,propina,comandas(mesero,comanda_items(nombre,cantidad,precio_unitario))").eq("fecha_operativa", fecha).in("estado", ["pagada", "anulada"])).data ?? [];
      const ids = cs.filter((c) => c.estado === "pagada").map((c) => c.id);
      const ps = ids.length
        ? (await supabase.from("pagos").select("cuenta_id,metodo,monto").in("cuenta_id", ids)).data ?? []
        : [];
      const fondo = (await supabase.from("caja_fondos").select("monto").eq("fecha", fecha).maybeSingle()).data?.monto ?? 0;
      return { cuentas: cs, pagos: ps, fondo: Number(fondo) };
    },
  });
  const cuentas = q.data?.cuentas ?? [];
  const pagadas = cuentas.filter((c) => c.estado === "pagada");
  const anuladas = cuentas.length - pagadas.length;
  const total = pagadas.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const propinas = pagadas.reduce((s, c) => s + Number(c.propina ?? 0), 0);
  const porMetodo = (m: string) => (q.data?.pagos ?? []).filter((p) => p.metodo === m).reduce((s, p) => s + Number(p.monto), 0);
  const top = new Map<string, { cant: number; monto: number }>();
  pagadas.flatMap((c) => c.comandas.flatMap((k) => k.comanda_items)).forEach((i) => {
    const t = top.get(i.nombre) ?? { cant: 0, monto: 0 };
    t.cant += i.cantidad; t.monto += i.cantidad * Number(i.precio_unitario);
    top.set(i.nombre, t);
  });
  const efectivo = efectivoNeto(pagadas.map((c) => ({ id: c.id, total: Number(c.total ?? 0), propina: Number(c.propina ?? 0) })), q.data?.pagos ?? []);
  const fondo = q.data?.fondo ?? 0;
  const ranking = [...top.entries()].sort((a, b) => b[1].cant - a[1].cant).slice(0, 10);

  const kpis = [
    { l: "Total vendido", v: mxn(total) },
    { l: "Propinas", v: mxn(propinas) },
    { l: "Efectivo cobrado", v: mxn(porMetodo("efectivo")) },
    { l: "Clip cobrado", v: mxn(porMetodo("clip")) },
    { l: "Fondo inicial", v: mxn(fondo) },
    { l: "Dinero en caja (efectivo)", v: mxn(fondo + efectivo) },
    { l: "Ticket promedio", v: mxn(pagadas.length ? total / pagadas.length : 0) },
    { l: "Cuentas cobradas", v: String(pagadas.length) },
    { l: "Anuladas", v: String(anuladas) },
  ];

  return (
    <div className="mt-4 space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Fecha operativa (Monterrey)</label>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.l} className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{k.l}</p>
            <p className="font-display text-4xl">{k.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display text-3xl mb-3">Top productos</h3>
        {ranking.length === 0 ? <p className="text-muted-foreground">Sin ventas en esta fecha.</p> : (
          <table className="w-full text-left">
            <thead className="text-sm text-muted-foreground"><tr><th>Producto</th><th className="text-right">Piezas</th><th className="text-right">Monto</th></tr></thead>
            <tbody>{ranking.map(([n, t]) => (
              <tr key={n} className="border-t"><td className="py-2">{n}</td><td className="text-right">{t.cant}</td><td className="text-right tabular-nums">{mxn(t.monto)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
