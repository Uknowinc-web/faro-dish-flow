import { useState } from "react";
import { AlertTriangle, CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { descartarOperacion, reintentarOperacion } from "@/lib/cola";
import { useCola, useConexion } from "@/hooks/use-conexion";
import { cn } from "@/lib/utils";

/** Aviso visible en todas las pantallas cuando no hay internet o hay operaciones sin enviar. */
export function EstadoConexion() {
  const online = useConexion();
  const cola = useCola();
  const [revisar, setRevisar] = useState(false);
  const pendientes = cola.filter((o) => !o.error).length;
  const fallidas = cola.filter((o) => o.error).length;

  if (online && cola.length === 0) return null;

  const texto = !online
    ? `Sin conexión. Lo que hagas se guarda en este dispositivo y se envía al reconectar${pendientes ? ` (${pendientes} pendiente${pendientes === 1 ? "" : "s"})` : ""}. Los cobros requieren internet.`
    : fallidas
      ? `${fallidas} operación${fallidas === 1 ? "" : "es"} no se aplicó${fallidas === 1 ? "" : "ron"}. Revísala para continuar.`
      : `Sincronizando ${pendientes} operación${pendientes === 1 ? "" : "es"} pendiente${pendientes === 1 ? "" : "s"}…`;

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-3 px-4 py-2 text-sm",
          !online ? "bg-warning text-warning-foreground" : fallidas ? "bg-destructive text-destructive-foreground" : "bg-info text-info-foreground",
        )}
      >
        {online ? <AlertTriangle className="size-4 shrink-0" /> : <CloudOff className="size-4 shrink-0" />}
        <p className="flex-1 min-w-0">{texto}</p>
        {cola.length > 0 && (
          <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setRevisar(true)}>
            Ver cola ({cola.length})
          </Button>
        )}
      </div>

      <Dialog open={revisar} onOpenChange={setRevisar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Operaciones pendientes</DialogTitle>
          </DialogHeader>
          {cola.length === 0 ? (
            <p className="text-muted-foreground">No hay operaciones pendientes.</p>
          ) : (
            <ul className="space-y-2 max-h-[60dvh] overflow-y-auto">
              {cola.map((o) => (
                <li key={o.id} className="rounded-lg border p-3">
                  <p className="font-semibold">{o.etiqueta}</p>
                  {o.resumen && <p className="text-sm text-muted-foreground">{o.resumen}</p>}
                  {o.error && <p className="text-sm text-destructive">No se aplicó: {o.error}</p>}
                  <div className="mt-2 flex gap-2">
                    {o.error && (
                      <Button size="sm" onClick={() => reintentarOperacion(o.id)}><RefreshCw /> Reintentar</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => descartarOperacion(o.id)}><Trash2 /> Descartar</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
