import { useSyncExternalStore } from "react";
import { obtenerCola, suscribirCola, type Operacion } from "@/lib/cola";

function suscribirConexion(f: () => void) {
  window.addEventListener("online", f);
  window.addEventListener("offline", f);
  return () => {
    window.removeEventListener("online", f);
    window.removeEventListener("offline", f);
  };
}

/** true si el navegador tiene conexión. */
export function useConexion(): boolean {
  return useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);
}

/** Operaciones guardadas en este dispositivo esperando conexión o revisión. */
export function useCola(): Operacion[] {
  return useSyncExternalStore(suscribirCola, obtenerCola, () => []);
}
