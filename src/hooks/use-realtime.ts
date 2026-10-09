import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribes to all restaurant tables and refreshes cached queries on any change. */
export function useRealtime(onComandaNueva?: () => void) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("restaurante-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "mesas" }, () => qc.invalidateQueries())
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas" }, () => qc.invalidateQueries())
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, (p) => {
        if (p.eventType === "INSERT") onComandaNueva?.();
        qc.invalidateQueries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comanda_items" }, () => qc.invalidateQueries())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc]);
}
