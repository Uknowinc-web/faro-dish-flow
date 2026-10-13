import { ticketTexto, type DatosTicket } from "@/lib/ticket";

/** Ticket de cocina. Oculto en pantalla; solo se ve al imprimir (ver estilos de impresión). */
export function TicketComanda({ datos }: { datos: DatosTicket | null }) {
  if (!datos) return null;
  return (
    <div id="ticket-impresion" aria-hidden="true">
      <pre>{ticketTexto(datos, 42)}</pre>
    </div>
  );
}
