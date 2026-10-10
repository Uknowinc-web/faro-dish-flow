CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.empleados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('mesero','cocina','caja','admin')),
  pin_hash text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, nombre, rol, activo, created_at) ON public.empleados TO anon, authenticated;
GRANT ALL ON public.empleados TO service_role;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.empleados FOR SELECT USING (true);

CREATE TABLE public.turnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.empleados(id),
  entrada timestamptz NOT NULL DEFAULT now(),
  salida timestamptz
);
GRANT SELECT ON public.turnos TO anon, authenticated;
GRANT ALL ON public.turnos TO service_role;
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.turnos FOR SELECT USING (true);

CREATE TABLE public.bitacora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid,
  empleado_nombre text,
  accion text NOT NULL,
  detalle text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bitacora_created_idx ON public.bitacora(created_at DESC);
GRANT SELECT, INSERT ON public.bitacora TO anon, authenticated;
GRANT ALL ON public.bitacora TO service_role;
ALTER TABLE public.bitacora ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.bitacora FOR SELECT USING (true);
CREATE POLICY "staff insert" ON public.bitacora FOR INSERT WITH CHECK (true);

CREATE TABLE public.producto_ajustes (
  producto_id text PRIMARY KEY,
  precio numeric,
  agotado boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.producto_ajustes TO anon, authenticated;
GRANT ALL ON public.producto_ajustes TO service_role;
ALTER TABLE public.producto_ajustes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.producto_ajustes FOR SELECT USING (true);

CREATE TABLE public.caja_fondos (
  fecha date PRIMARY KEY,
  monto numeric NOT NULL DEFAULT 0
);
GRANT SELECT ON public.caja_fondos TO anon, authenticated;
GRANT ALL ON public.caja_fondos TO service_role;
ALTER TABLE public.caja_fondos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read" ON public.caja_fondos FOR SELECT USING (true);

ALTER TABLE public.mesas ADD COLUMN activo boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public._empleado_por_pin(p_pin text)
RETURNS public.empleados LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
  select * from empleados where activo and pin_hash = extensions.crypt(p_pin, pin_hash) limit 1
$$;
REVOKE ALL ON FUNCTION public._empleado_por_pin(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._admin(p_pin text)
RETURNS public.empleados LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare e empleados;
begin
  e := _empleado_por_pin(p_pin);
  if e.id is null or e.rol <> 'admin' then raise exception 'PIN de administrador inválido'; end if;
  return e;
end $$;
REVOKE ALL ON FUNCTION public._admin(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verificar_pin(p_pin text)
RETURNS TABLE(id uuid, nombre text, rol text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare e empleados;
begin
  e := _empleado_por_pin(p_pin);
  if e.id is null then raise exception 'PIN incorrecto'; end if;
  insert into bitacora(empleado_id, empleado_nombre, accion) values (e.id, e.nombre, 'Inicio de sesión');
  return query select e.id, e.nombre, e.rol;
end $$;

CREATE OR REPLACE FUNCTION public.registrar_turno(p_pin text, p_tipo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare e empleados; v_turno uuid;
begin
  e := _empleado_por_pin(p_pin);
  if e.id is null then raise exception 'PIN incorrecto'; end if;
  select t.id into v_turno from turnos t where t.empleado_id = e.id and t.salida is null order by entrada desc limit 1;
  if p_tipo = 'entrada' then
    if v_turno is not null then raise exception 'Ya tienes una entrada abierta'; end if;
    insert into turnos(empleado_id) values (e.id);
  elsif p_tipo = 'salida' then
    if v_turno is null then raise exception 'No tienes entrada registrada'; end if;
    update turnos set salida = now() where turnos.id = v_turno;
  else raise exception 'Tipo inválido'; end if;
  insert into bitacora(empleado_id, empleado_nombre, accion) values (e.id, e.nombre, case when p_tipo='entrada' then 'Entrada de turno' else 'Salida de turno' end);
end $$;

CREATE OR REPLACE FUNCTION public.admin_guardar_empleado(p_admin_pin text, p_id uuid, p_nombre text, p_rol text, p_pin text, p_activo boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare a empleados; otro empleados; v_id uuid;
begin
  a := _admin(p_admin_pin);
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
    if p_id = a.id and (p_rol <> 'admin' or not p_activo) then raise exception 'No puedes quitarte el acceso de administrador'; end if;
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
  a := _admin(p_admin_pin);
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
  a := _admin(p_admin_pin);
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
  a := _admin(p_admin_pin);
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
  a := _admin(p_admin_pin);
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
  a := _admin(p_admin_pin);
  if p_monto < 0 then raise exception 'Monto inválido'; end if;
  insert into caja_fondos(fecha, monto) values (p_fecha, p_monto) on conflict (fecha) do update set monto = excluded.monto;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Fondo de caja', p_fecha::text || ': $' || p_monto::text);
end $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.bitacora, public.turnos, public.producto_ajustes, public.empleados, public.caja_fondos;