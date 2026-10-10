CREATE TABLE public.pagos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id),
  metodo text not null check (metodo in ('efectivo','clip')),
  monto numeric not null check (monto >= 0),
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos TO anon, authenticated;
GRANT ALL ON public.pagos TO service_role;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff all" ON public.pagos FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.cuentas ADD COLUMN propina numeric not null default 0;

CREATE OR REPLACE FUNCTION public.cobrar_cuenta_pagos(p_cuenta uuid, p_pagos jsonb, p_propina numeric default 0)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_total numeric; v_mesa uuid; v_suma numeric; v_metodos text[];
  p jsonb;
begin
  select mesa_id into v_mesa from cuentas where id = p_cuenta and estado in ('abierta','por_cobrar') for update;
  if v_mesa is null then raise exception 'Cuenta no disponible para cobro'; end if;
  if jsonb_array_length(p_pagos) = 0 then raise exception 'Debe registrar al menos un pago'; end if;
  if coalesce(p_propina,0) < 0 then raise exception 'Propina inválida'; end if;

  select coalesce(sum(i.cantidad * i.precio_unitario),0) into v_total
  from comanda_items i join comandas c on c.id = i.comanda_id
  where c.cuenta_id = p_cuenta;

  select coalesce(sum((x->>'monto')::numeric),0),
         array_agg(distinct x->>'metodo')
  into v_suma, v_metodos
  from jsonb_array_elements(p_pagos) x;

  if exists (select 1 from jsonb_array_elements(p_pagos) x where x->>'metodo' not in ('efectivo','clip')) then
    raise exception 'Método inválido';
  end if;
  if exists (select 1 from jsonb_array_elements(p_pagos) x where (x->>'monto')::numeric <= 0) then
    raise exception 'Monto inválido';
  end if;
  if v_suma < v_total + coalesce(p_propina,0) then
    raise exception 'El pago no cubre el total';
  end if;

  for p in select * from jsonb_array_elements(p_pagos) loop
    insert into pagos(cuenta_id, metodo, monto) values (p_cuenta, p->>'metodo', (p->>'monto')::numeric);
  end loop;

  update cuentas set
    estado = 'pagada',
    metodo_pago = case when array_length(v_metodos,1) > 1 then 'mixto' else v_metodos[1] end,
    total = v_total,
    propina = coalesce(p_propina,0),
    cerrada_at = now(),
    fecha_operativa = (now() at time zone 'America/Monterrey')::date
  where id = p_cuenta;
  update mesas set estado = 'disponible' where id = v_mesa;
  return v_total;
end $function$;

COMMENT ON FUNCTION public.cobrar_cuenta(uuid, text) IS 'DEPRECATED: usar cobrar_cuenta_pagos (pagos mixtos y propina)';