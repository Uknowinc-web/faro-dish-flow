-- 0005: sin barra en el local.
-- - Cocina recibe solo comida (estación "cocina"); las bebidas (estación "bebida") solo se cobran en caja.
-- - Imprimir el ticket de comanda en cocina la pasa a "preparacion" (validado en el servidor).

-- 1) La barra no existe en el local: la mesa "Barra" se oculta (se puede reactivar en Administración).
update public.mesas set activo = false where nombre = 'Barra';

-- 2) Las bebidas dejan de usar la estación "barra".
update public.comanda_items set estacion = 'bebida' where estacion = 'barra';

-- 3) Ticket de comanda para cocina.
create or replace function public.cocina_imprimir_comanda(p_pin text, p_comanda uuid)
returns text language plpgsql security definer set search_path = public as $$
declare a empleados; v_numero int; v_estado text; v_mesa text; v_detalle text;
begin
  a := _permiso(p_pin, 'estacion.cocina');
  select c.numero, c.estado, m.nombre into v_numero, v_estado, v_mesa
  from comandas c join mesas m on m.id = c.mesa_id where c.id = p_comanda;
  if v_numero is null then raise exception 'Comanda no encontrada'; end if;
  if v_estado = 'pendiente' then
    update comandas set estado = 'preparacion' where id = p_comanda;
    v_estado := 'preparacion';
    v_detalle := '#' || v_numero || ' · ' || coalesce(v_mesa, '') || ' · en preparación';
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
    values (a.id, a.nombre, 'Ticket impreso', v_detalle);
  else
    v_detalle := '#' || v_numero || ' · ' || coalesce(v_mesa, '') || ' · ' || case when v_estado = 'listo' then 'listo' else 'en preparación' end;
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
    values (a.id, a.nombre, 'Ticket reimpreso', v_detalle);
  end if;
  return v_estado;
end $$;

revoke execute on function public.cocina_imprimir_comanda(text, uuid) from public, anon, authenticated;
grant execute on function public.cocina_imprimir_comanda(text, uuid) to anon, authenticated;
