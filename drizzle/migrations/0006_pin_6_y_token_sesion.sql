-- 0006: PIN de 6 dígitos y sesión por token.
-- - Los PIN nuevos o cambiados deben tener 6 dígitos. Los existentes (4 a 6) siguen entrando hasta que Admin los cambie.
-- - Al entrar, el servidor emite un token aleatorio de 12 horas. El dispositivo guarda ese token, no el PIN.
--   Solo se guarda su hash (sha256) en la base.
-- - Los parámetros p_pin de las funciones aceptan PIN o token: el token es el que manda el cliente.

-- 1) Empleados: marca si el PIN ya se definió con la regla de 6 dígitos.
alter table public.empleados add column if not exists pin_actualizado boolean not null default false;

-- 2) Sesiones por dispositivo.
create table if not exists public.sesiones_dispositivo (
  token_hash text primary key,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  creada_at timestamptz not null default now(),
  expira_at timestamptz not null,
  revocada boolean not null default false
);
alter table public.sesiones_dispositivo enable row level security;
revoke all on public.sesiones_dispositivo from public, anon, authenticated;

-- 3) Identifica al empleado por token vigente o por PIN (compatibilidad con sesiones anteriores).
create or replace function public._empleado_por_pin(p_pin text)
returns public.empleados
language plpgsql stable security definer set search_path = public, extensions as $$
declare e empleados;
begin
  select x.* into e
  from sesiones_dispositivo s join empleados x on x.id = s.empleado_id
  where s.token_hash = encode(extensions.digest(p_pin, 'sha256'), 'hex')
    and not s.revocada and s.expira_at > now() and x.activo
  limit 1;
  if e.id is not null then return e; end if;
  select * into e from empleados where activo and pin_hash = extensions.crypt(p_pin, pin_hash) limit 1;
  return e;
end $$;

-- 4) Entrar con PIN (con el límite de intentos de verificar_pin) y recibir un token.
create or replace function public.iniciar_sesion_pin(p_pin text, p_dispositivo text default null)
returns table(id uuid, nombre text, rol text, token text)
language plpgsql security definer set search_path = public, extensions as $$
declare v record; v_token text;
begin
  select * into v from verificar_pin(p_pin, p_dispositivo) limit 1;
  if v.id is null then return; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  delete from sesiones_dispositivo where expira_at < now() or revocada;
  insert into sesiones_dispositivo(token_hash, empleado_id, expira_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v.id, now() + interval '12 hours');
  return query select v.id, v.nombre, v.rol, v_token;
end $$;
revoke execute on function public.iniciar_sesion_pin(text, text) from public;
grant execute on function public.iniciar_sesion_pin(text, text) to anon, authenticated;

-- 5) Cerrar sesión: el token deja de funcionar.
create or replace function public.cerrar_sesion(p_token text)
returns void language sql security definer set search_path = public, extensions as $$
  update sesiones_dispositivo set revocada = true
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke execute on function public.cerrar_sesion(text) from public;
grant execute on function public.cerrar_sesion(text) to anon, authenticated;

-- 6) Alta y cambio de PIN de empleados: exige 6 dígitos y marca el PIN como actualizado.
CREATE OR REPLACE FUNCTION public.admin_guardar_empleado(p_admin_pin text, p_id uuid, p_nombre text, p_rol text, p_pin text, p_activo boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare a empleados; otro empleados; v_id uuid;
begin
  a := _permiso(p_admin_pin, 'admin.empleados');
  if p_rol = 'admin' and a.rol <> 'admin' then raise exception 'Solo un administrador puede asignar ese rol'; end if;
  if p_id is not null and a.rol <> 'admin' and exists (select 1 from empleados where id = p_id and rol = 'admin') then raise exception 'Solo un administrador puede editar a otro administrador'; end if;
  if coalesce(trim(p_nombre),'') = '' then raise exception 'Nombre requerido'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{6}$' then raise exception 'El PIN debe tener 6 dígitos'; end if;
  if p_pin is not null then
    otro := _empleado_por_pin(p_pin);
    if otro.id is not null and otro.id is distinct from p_id then raise exception 'Ese PIN ya lo usa otro empleado'; end if;
  end if;
  if p_id is null then
    if p_pin is null then raise exception 'PIN requerido'; end if;
    insert into empleados(nombre, rol, pin_hash, activo, pin_actualizado) values (trim(p_nombre), p_rol, crypt(p_pin, gen_salt('bf')), coalesce(p_activo,true), true) returning id into v_id;
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Alta de empleado', trim(p_nombre) || ' (' || p_rol || ')');
  else
    if p_id = a.id and a.rol = 'admin' and (p_rol <> 'admin' or not p_activo) then raise exception 'No puedes quitarte el acceso de administrador'; end if;
    update empleados set nombre = trim(p_nombre), rol = p_rol, activo = p_activo,
      pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end,
      pin_actualizado = case when p_pin is null then pin_actualizado else true end
    where id = p_id returning id into v_id;
    insert into bitacora(empleado_id, empleado_nombre, accion, detalle) values (a.id, a.nombre, 'Edición de empleado',
      trim(p_nombre) || ' (' || p_rol || case when p_activo then '' else ', inactivo' end || case when p_pin is null then '' else ', PIN cambiado' end || ')');
  end if;
  return v_id;
end $$;
