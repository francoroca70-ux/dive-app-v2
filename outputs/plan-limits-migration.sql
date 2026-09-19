-- Seven Seas — límites por plan (botes y locales)
-- 19 sep 2026
--
-- CÓMO CORRERLO: Supabase Dashboard -> SQL Editor -> New query -> pegar todo
-- esto -> Run. (El MCP no pudo conectarse el día que se escribió; correrlo a
-- mano desde el dashboard hace exactamente lo mismo.)
--
-- POR QUÉ EXISTE
-- Los topes de botes estaban publicados en la página de precios pero no
-- estaban implementados en ningún lado. Un shop en Starter ($49, "hasta 2
-- botes") podía cargar quince y nada lo frenaba. El chequeo que está en
-- index.html sirve para mostrar un mensaje útil; esto es lo que realmente
-- lo hace cumplir, porque la clave anon está en el código fuente de la página
-- y cualquiera puede hacer POST directo a /rest/v1/boats.
--
-- DECISIÓN: las pruebas gratis NO tienen tope. Un shop de cuatro botes que
-- durante sus 14 días solo puede cargar dos no puede evaluar el producto
-- contra su operación real, y se va. El tope empieza a aplicar cuando eligen
-- plan, y el mensaje les dice qué plan necesitan en vez de solo decir que no.

create or replace function plan_limit_for(p_org uuid, p_resource text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_status text;
  v_tier text;
begin
  select subscription_status, plan_tier into v_status, v_tier
  from organizations where id = p_org;

  if v_tier is null or v_status in ('trial', 'trialing') then
    return null;
  end if;

  if p_resource = 'boats' then
    return case v_tier
      when 'starter' then 2
      when 'growth'  then 5
      when 'pro'     then 15
      else null end;
  elsif p_resource = 'locations' then
    -- "Multiple locations" es el motivo para pasar de Starter a Growth,
    -- así que Starter tiene uno. Growth y Pro quedan sin tope: la página de
    -- precios nunca dio un número ahí, e inventarlo ahora le pegaría a un
    -- cliente que ya paga y al que nunca se le avisó.
    return case v_tier when 'starter' then 1 else null end;
  end if;

  return null;
end;
$fn$;

create or replace function enforce_boat_limit()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_limit integer;
  v_count integer;
  v_tier text;
begin
  v_limit := plan_limit_for(new.org_id, 'boats');
  if v_limit is null then return new; end if;

  if tg_op = 'INSERT' then
    -- Un bote inactivo no ocupa lugar.
    if new.active is false then return new; end if;
    select count(*) into v_count from boats
     where org_id = new.org_id and active is not false;
  else
    -- En UPDATE, lo único que puede pasarlos del tope es reactivar un bote.
    if not (coalesce(old.active, true) = false and coalesce(new.active, true) = true) then
      return new;
    end if;
    select count(*) into v_count from boats
     where org_id = new.org_id and active is not false and id <> new.id;
  end if;

  if v_count >= v_limit then
    select plan_tier into v_tier from organizations where id = new.org_id;
    raise exception 'boat_limit_reached:%:%', v_tier, v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create or replace function enforce_location_limit()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_limit integer;
  v_count integer;
  v_tier text;
begin
  v_limit := plan_limit_for(new.org_id, 'locations');
  if v_limit is null then return new; end if;

  select count(*) into v_count from locations where org_id = new.org_id;

  if v_count >= v_limit then
    select plan_tier into v_tier from organizations where id = new.org_id;
    raise exception 'location_limit_reached:%:%', v_tier, v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_enforce_boat_limit on boats;
create trigger trg_enforce_boat_limit
  before insert or update on boats
  for each row execute function enforce_boat_limit();

drop trigger if exists trg_enforce_location_limit on locations;
create trigger trg_enforce_location_limit
  before insert on locations
  for each row execute function enforce_location_limit();

-- ── COMPROBACIÓN DESPUÉS DE CORRERLO ────────────────────────────────────────
-- 1) Ver quién quedaría por encima de su tope (debería dar 0 filas hoy):
--
-- select o.name, o.plan_tier, o.subscription_status,
--        (select count(*) from boats b where b.org_id=o.id and b.active is not false) as botes,
--        plan_limit_for(o.id,'boats') as tope
-- from organizations o
-- where plan_limit_for(o.id,'boats') is not null
--   and (select count(*) from boats b where b.org_id=o.id and b.active is not false)
--       > plan_limit_for(o.id,'boats');
--
-- 2) Probar el tope sin romper nada (corre y revierte solo):
--
-- do $$
-- declare v_org uuid;
-- begin
--   select id into v_org from organizations where plan_tier = 'growth' limit 1;
--   -- mete botes hasta pasarse; debería cortar en el tope del plan
--   for i in 1..20 loop
--     insert into boats (org_id, name, active) values (v_org, 'test '||i, true);
--   end loop;
--   raise exception 'no cortó -- el tope NO está funcionando';
-- exception
--   when check_violation then raise notice 'OK, cortó: %', sqlerrm;
--   when others then raise notice 'cortó con otro error: %', sqlerrm;
-- end $$;
--
-- NOTA: los clientes que ya existen y están por encima de su tope no se tocan.
-- El trigger solo frena botes NUEVOS, nunca borra ni desactiva lo que ya está.
