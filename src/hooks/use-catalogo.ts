import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTOS, aplicarAjustes } from "@/lib/catalogo";

/** Catalog with today's admin overrides (price, sold out) applied. */
export function useCatalogo() {
  const q = useQuery({
    queryKey: ["producto-ajustes"],
    queryFn: async () => (await supabase.from("producto_ajustes").select("producto_id,precio,agotado")).data ?? [],
  });
  return aplicarAjustes(PRODUCTOS, q.data ?? []);
}
