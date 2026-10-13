-- 0004: validación de permisos de caja y cocina en el servidor,
-- cierre de escrituras directas desde la API pública y límite de intentos de PIN.

-- ========== 1) Límite de intentos de PIN ==========
create table if not exists public.pin_intentos (
  clave text primary key,
  fallos int not null default 0,
  ventana_inicio timestamptz not null default now(),
  bloqueado_hasta timestamptz
);
alter table public.pin_intentos enable row level security;
revoke all on public.pin_intentos from public, anon, authenticated;

create or replace function public._pin_revisar_bloqueo(p_clave text)
returns void language plpgsql security definer set search_path = public as $$
declare f pin_intentos;
begin
  select * into f from pin_intentos where clave = p_clave;
  if found and f.bloqueado_hasta is not null and f.bloqueado_hasta > now() then
    raise exception 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  end if;
end $$;

create or replace function public._pin_registrar_fallo(p_clave text, p_umbral int, p_minutos int)
returns void language plpgsql security definer set search_path = public as $$
declare f pin_intentos;
begin
  insert into pin_intentos(clave) values (p_clave) on conflict (clave) do nothing;
  select * into f from pin_intentos where clave = p_clave for update;
  if f.bloqueado_hasta is not null and f.bloqueado_hasta <= now() then
    f.fallos := 0; f.bloqueado_hasta := null; f.ventana_inicio := now();
  elsif f.ventana_inicio < now() - interval '15 minutes' then
    f.fallos := 0; f.ventana_inicio := now();
  end if;
  f.fallos := f.fallos + 1;
  update pin_intentos
     set fallos = f.fallos,
         ventana_inicio = f.ventana_inicio,
         bloqueado_hasta = case when f.fallos >= p_umbral then now() + make_interval(mins => p_minutos) else null end
   where clave = p_clave;
end $$;

-- Se pasa de 1 a 2 parámetros: se elimina la firma anterior para evitar ambigüedad en rpc().
drop function if exists public.verificar_pin(text);
create or replace function public.verificar_pin(p_pin text, p_dispositivo text default null)
returns table(id uuid, nombre text, rol text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  e empleados;
  v_disp text := 'dispositivo:' || coalesce(nullif(trim(p_dispositivo), ''), 'desconocido');
begin
  perform _pin_revisar_bloqueo(v_disp);
  perform _pin_revisar_bloqueo('global');
  e := _empleado_por_pin(p_pin);
  if e.id is null then
    -- El fallo se registra y se devuelve vacío (sin excepción) para que el conteo no se revierta.
    perform _pin_registrar_fallo(v_disp, 5, 5);
    perform _pin_registrar_fallo('global', 30, 5);
    return;
  end if;
  delete from pin_intentos where clave = v_disp;
  insert into bitacora(empleado_id, empleado_nombre, accion) values (e.id, e.nombre, 'Inicio de sesión');
  return query select e.id, e.nombre, e.rol;
end $$;

-- ========== 2) Bitácora con PIN (reemplaza el insert directo desde el navegador) ==========
create or replace function public.registrar_bitacora(p_pin text, p_accion text, p_detalle text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare e empleados;
begin
  e := _empleado_por_pin(p_pin);
  if e.id is null then raise exception 'PIN inválido'; end if;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
  values (e.id, e.nombre, left(p_accion, 120), left(p_detalle, 500));
end $$;

-- ========== 3) Caja: permisos validados en el servidor ==========
create or replace function public.caja_solicitar_cuenta(p_pin text, p_cuenta uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a empleados; v_mesa text;
begin
  a := _permiso(p_pin, 'caja.por_cobrar');
  select m.nombre into v_mesa from cuentas k join mesas m on m.id = k.mesa_id where k.id = p_cuenta;
  perform solicitar_cuenta(p_cuenta);
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
  values (a.id, a.nombre, 'Mesa marcada por cobrar', v_mesa);
end $$;

create or replace function public.caja_cobrar_cuenta(p_pin text, p_cuenta uuid, p_pagos jsonb, p_propina numeric default 0)
returns numeric language plpgsql security definer set search_path = public as $$
declare a empleados; v_total numeric; v_mesa text; v_detalle text;
begin
  a := _permiso(p_pin, 'caja.cobrar');
  select m.nombre into v_mesa from cuentas k join mesas m on m.id = k.mesa_id where k.id = p_cuenta;
  v_total := cobrar_cuenta_pagos(p_cuenta, p_pagos, p_propina);
  v_detalle := v_mesa || ' · ' || v_total::text
    || case when coalesce(p_propina, 0) > 0 then ' + propina ' || p_propina::text else '' end
    || ' · ' || (select string_agg((x->>'metodo') || ' ' || (x->>'monto'), ', ') from jsonb_array_elements(p_pagos) x);
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
  values (a.id, a.nombre, 'Cuenta cobrada', v_detalle);
  return v_total;
end $$;

create or replace function public.caja_anular_cuenta(p_pin text, p_cuenta uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare a empleados; v_mesa text;
begin
  a := _permiso(p_pin, 'caja.anular');
  select m.nombre into v_mesa from cuentas k join mesas m on m.id = k.mesa_id where k.id = p_cuenta;
  perform anular_cuenta(p_cuenta, p_motivo);
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
  values (a.id, a.nombre, 'Cuenta anulada', coalesce(v_mesa, '') || ' — ' || p_motivo);
end $$;

create or replace function public.caja_agregar_mesa(p_pin text, p_nombre text)
returns uuid language plpgsql security definer set search_path = public as $$
declare a empleados; v_id uuid;
begin
  a := _permiso(p_pin, 'caja.agregar_mesa');
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Nombre requerido'; end if;
  insert into mesas(nombre, orden) values (trim(p_nombre), 50) returning id into v_id;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
  values (a.id, a.nombre, 'Mesa agregada', trim(p_nombre));
  return v_id;
end $$;

-- ========== 4) Cocina: cambio de estado validado en el servidor ==========
create or replace function public.cocina_cambiar_estado(p_pin text, p_comanda uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
declare a empleados; v_numero int; v_actual text; v_mesa text;
begin
  a := _permiso(p_pin, 'estacion.cocina');
  if p_estado not in ('preparacion', 'listo') then raise exception 'Estado inválido'; end if;
  select c.numero, c.estado, m.nombre into v_numero, v_actual, v_mesa
  from comandas c join mesas m on m.id = c.mesa_id where c.id = p_comanda;
  if v_numero is null then raise exception 'Comanda no encontrada'; end if;
  if (v_actual = 'pendiente' and p_estado <> 'preparacion')
     or (v_actual = 'preparacion' and p_estado <> 'listo')
     or v_actual = 'listo' then
    raise exception 'Transición de estado inválida';
  end if;
  update comandas set estado = p_estado where id = p_comanda;
  insert into bitacora(empleado_id, empleado_nombre, accion, detalle)
  values (a.id, a.nombre,
          case when p_estado = 'listo' then 'Comanda lista' else 'Comanda en preparación' end,
          '#' || v_numero || ' · ' || coalesce(v_mesa, ''));
end $$;

-- ========== 5) Cierre de escrituras directas y funciones sin validación ==========
revoke insert, update, delete on public.mesas, public.cuentas, public.comandas, public.comanda_items,
  public.pagos, public.bitacora from anon, authenticated;

revoke execute on function public.cobrar_cuenta_pagos(uuid, jsonb, numeric) from public, anon, authenticated;
revoke execute on function public.cobrar_cuenta(uuid, text) from public, anon, authenticated;
revoke execute on function public.anular_cuenta(uuid, text) from public, anon, authenticated;
revoke execute on function public.solicitar_cuenta(uuid) from public, anon, authenticated;

revoke all on function public._pin_revisar_bloqueo(text) from public, anon, authenticated;
revoke all on function public._pin_registrar_fallo(text, int, int) from public, anon, authenticated;

grant execute on function
  public.verificar_pin(text, text),
  public.registrar_bitacora(text, text, text),
  public.caja_solicitar_cuenta(text, uuid),
  public.caja_cobrar_cuenta(text, uuid, jsonb, numeric),
  public.caja_anular_cuenta(text, uuid, text),
  public.caja_agregar_mesa(text, text),
  public.cocina_cambiar_estado(text, uuid, text)
to anon, authenticated;
