CREATE TABLE public.rol_permisos (
  rol text PRIMARY KEY CHECK (rol IN ('mesero','cocina','caja')),
  permisos text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rol_permisos TO anon, authenticated;
GRANT ALL ON public.rol_permisos TO service_role;
ALTER TABLE public.rol_permisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.rol_permisos FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public._permiso(p_pin text, p_permiso text)
RETURNS public.empleados LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare e empleados;
begin
  e := _empleado_por_pin(p_pin);
  if e.id is null then raise exception 'PIN inválido'; end if;
  if e.rol = 'admin' then return e; end if;
  if not exists (select 1 from rol_permisos where rol = e.rol and p_permiso = any(permisos)) then
    raise exception 'Sin permiso para esta acción';
  end if;
  return e;
end $$;
REVOKE ALL ON FUNCTION public._permiso(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_guardar_permisos(p_admin_pin text, p_rol text, p_permisos text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a empleados;
begin
  a := _admin(p_admin_pin);
  insert into rol_permisos(rol, permisos, updated_at) values (p_rol, coalesce(p_permisos,'{}'), now())
  on conflict (rol) do update set permisos = excluded.permisos, updated_at = now();
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Cambio de permisos', p_rol || ': ' || array_to_string(p_permisos, ', '));
end $$;

CREATE OR REPLACE FUNCTION public.admin_guardar_empleado(p_admin_pin text, p_id uuid, p_nombre text, p_rol text, p_pin text, p_activo boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare a empleados; otro empleados; v_id uuid;
begin
  a := _permiso(p_admin_pin, 'admin.empleados');
  if p_rol = 'admin' and a.rol <> 'admin' then raise exception 'Solo un administrador puede asignar ese rol'; end if;
  if p_id is not null and a.rol <> 'admin' and exists (select 1 from empleados where id = p_id and rol = 'admin') then raise exception 'Solo un administrador puede editar a otro administrador'; end if;
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Nombre requerido'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{4,6}$' then raise exception 'El PIN debe tener de 4 a 6 dígitos'; end if;
  if p_pin is not null then
    otro := _empleado_por_pin(p_pin);
    if otro.id is not null and otro.id is distinct from p_id then raise exception 'Ese PIN ya lo usa otro empleado'; end if;
  end if;
  if p_id is null then
    if p_pin is null then raise exception 'PIN requerido'; end if;
    insert into empleados(nombre, rol, pin_hash, activo) values (trim(p_nombre), p_rol, crypt(p_pin, gen_salt('bf')), coalesce(p_activo,true)) returning id into v_id;
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Alta de empleado', trim(p_nombre) || ' (' || p_rol || ')');
  else
    if p_id = a.id and a.rol = 'admin' and (p_rol <> 'admin' or not p_activo) then raise exception 'No puedes quitarte el acceso de administrador'; end if;
    update empleados set nombre = trim(p_nombre), rol = p_rol, activo = p_activo,
      pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end
    where id = p_id returning id into v_id;
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Edición de empleado',
      trim(p_nombre) || ' (' || p_rol || case when p_activo then '' else ', inactivo' end || case when p_pin is null then '' else ', PIN cambiado' end || ')');
  end if;
  return v_id;
end $$;

CREATE OR REPLACE FUNCTION public.admin_ajustar_producto(p_admin_pin text, p_producto text, p_nombre text, p_precio numeric, p_agotado boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a empleados;
begin
  a := _permiso(p_admin_pin, 'admin.productos');
  if p_precio is not null and p_precio < 0 then raise exception 'Precio inválido'; end if;
  insert into producto_ajustes(producto_id, precio, agotado, updated_at) values (p_producto, p_precio, coalesce(p_agotado,false), now())
  on conflict (producto_id) do update set precio = excluded.precio, agotado = excluded.agotado, updated_at = now();
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Ajuste de producto',
    p_nombre || ': ' || coalesce('$' || p_precio::text, 'precio de catálogo') || case when p_agotado then ', agotado' else ', disponible' end);
end $$;

CREATE OR REPLACE FUNCTION public.admin_guardar_mesa(p_admin_pin text, p_id uuid, p_nombre text, p_activo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a empleados;
begin
  a := _permiso(p_admin_pin, 'admin.mesas');
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Nombre requerido'; end if;
  if p_id is null then
    insert into mesas(nombre, orden) values (trim(p_nombre), 50);
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Alta de mesa', trim(p_nombre));
  else
    if not p_activo and exists (select 1 from cuentas where mesa_id = p_id and estado in ('abierta','por_cobrar')) then
      raise exception 'La mesa tiene una cuenta abierta';
    end if;
    update mesas set nombre = trim(p_nombre), activo = p_activo where id = p_id;
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Edición de mesa', trim(p_nombre) || case when p_activo then '' else ' (desactivada)' end);
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.admin_cancelar_item(p_admin_pin text, p_item uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a empleados; v_nombre text; v_cant int; v_mesa text;
begin
  a := _permiso(p_admin_pin, 'admin.cuentas');
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Motivo requerido'; end if;
  select i.nombre, i.cantidad, m.nombre into v_nombre, v_cant, v_mesa
  from comanda_items i join comandas c on c.id = i.comanda_id join cuentas k on k.id = c.cuenta_id join mesas m on m.id = k.mesa_id
  where i.id = p_item and k.estado in ('abierta','por_cobrar');
  if v_nombre is null then raise exception 'Solo se pueden cancelar productos de cuentas abiertas'; end if;
  delete from comanda_items where id = p_item;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Cancelación de producto', v_mesa || ': ' || v_cant || '× ' || v_nombre || ' — ' || p_motivo);
end $$;

CREATE OR REPLACE FUNCTION public.admin_reabrir_cuenta(p_admin_pin text, p_cuenta uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a empleados; v_mesa uuid; v_nombre text;
begin
  a := _permiso(p_admin_pin, 'admin.cuentas');
  if coalesce(trim(p_motivo),'') = '' then raise exception 'Motivo requerido'; end if;
  select k.mesa_id, m.nombre into v_mesa, v_nombre from cuentas k join mesas m on m.id = k.mesa_id where k.id = p_cuenta and k.estado in ('pagada','anulada') for update;
  if v_mesa is null then raise exception 'La cuenta no está cerrada'; end if;
  if exists (select 1 from cuentas where mesa_id = v_mesa and estado in ('abierta','por_cobrar')) then
    raise exception 'La mesa ya tiene otra cuenta abierta';
  end if;
  delete from pagos where cuenta_id = p_cuenta;
  update cuentas set estado = 'por_cobrar', metodo_pago = null, total = null, propina = 0, cerrada_at = null, fecha_operativa = null, motivo_anulacion = null where id = p_cuenta;
  update mesas set estado = 'por_cobrar' where id = v_mesa;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Reapertura de cuenta', v_nombre || ' — ' || p_motivo);
end $$;

CREATE OR REPLACE FUNCTION public.admin_fondo_caja(p_admin_pin text, p_fecha date, p_monto numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare a empleados;
begin
  a := _permiso(p_admin_pin, 'admin.fondo');
  if p_monto < 0 then raise exception 'Monto inválido'; end if;
  insert into caja_fondos(fecha, monto) values (p_fecha, p_monto) on conflict (fecha) do update set monto = excluded.monto;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Fondo de caja', p_fecha::text || ': $' || p_monto::text);
end $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rol_permisos;