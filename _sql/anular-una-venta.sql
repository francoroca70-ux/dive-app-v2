-- ============================================================================
-- Una venta no se edita: se contra-asienta.
--
-- Escrito y **APLICADO el 26/10/2026**, en cuatro migraciones:
-- `una_venta_se_anula_con_un_contra_asiento`,
-- `registrar_venta_valida_la_cantidad`, `anular_venta` y
-- `una_venta_es_inmutable`.
--
-- Verificado contra la base real en transacciones revertidas: 13 comprobaciones
-- de esquema (anular devuelve el stock, el movimiento con motivo «Anulación»,
-- el neto en 0, no se anula dos veces, no se anula una anulación, `qty: -5`
-- rechazada, modificar y borrar rechazados, el motivo suelto rechazado) y 8 de
-- RLS haciéndose pasar por Fran con el rol `authenticated` — **corridas como
-- postgres las políticas no se evalúan, así que una prueba con el rol
-- privilegiado no dice nada sobre RLS**.
--
-- Este archivo queda como el documento de lo que se aplicó y por qué. No hay
-- carpeta de migraciones en el repo: las migraciones se aplican y se documentan.
--
-- Etapa 7 del Roadmap POS, y es lo único que la nota del 16/10 nombra como
-- bloqueo para prender el interruptor: hoy una venta registrada descuenta
-- stock y no hay vuelta atrás.
-- ============================================================================
--
-- POR QUÉ UN CONTRA-ASIENTO Y NO UNA BANDERA `voided_at`
--
-- Con la bandera, **cada suma de plata** necesitaría `where voided_at is null`,
-- y eso es una regla en N lugares: el modo de falla que más veces apareció en
-- este proyecto, donde el defecto aparece justo donde la copia FALTA
-- (`escapeHtml` con 8 copias y 4 agujeros, el umbral de mantenimiento, el
-- semáforo de habilitación, las columnas del acta escritas tres veces).
--
-- Con las líneas en negativo **la aritmética lleva el significado**: cualquier
-- `sum(line_total)` netea la anulación sin saber que existe. El cierre de caja,
-- el reporte por producto y el descuadre contra stock salen bien sin que nadie
-- se acuerde de filtrar.
--
-- Y es la misma disciplina que el acta de una checklist: la venta original no
-- se toca nunca.

begin;

alter table public.sales
  add column voids_sale_id uuid references public.sales(id),
  add column void_reason   text;

-- La FK es NO ACTION a propósito: una venta que fue anulada **no se puede
-- borrar** mientras su anulación exista. Es lo contrario del criterio de
-- `sale_lines.gear_item_id`, que quedó como uuid suelto para no volver
-- imposible borrar un artículo del catálogo. Acá volver imposible el borrado
-- es exactamente lo que se busca.

alter table public.sales
  add constraint sales_no_se_anula_a_si_misma
  check (voids_sale_id is distinct from id);

-- Un motivo sobre una venta que no anula nada es un campo sin significado, y en
-- un registro que no se edita queda para siempre. Misma regla que el motivo de
-- «por qué faltó» sobre un ítem que sí se hizo: se descarta.
alter table public.sales
  add constraint sales_motivo_solo_si_anula
  check (void_reason is null or voids_sale_id is not null);

-- Una venta se anula UNA vez. La función da el mensaje claro; este índice es la
-- red por debajo, para que ni dos mostradores a la vez puedan duplicarla.
create unique index sales_una_anulacion_por_venta
  on public.sales (voids_sale_id)
  where voids_sale_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- `qty > 0` pasa a `qty <> 0`
--
-- Es lo que permite que la línea de una anulación sea la misma línea en
-- negativo, con `line_total` negativo por la columna generada.
--
-- Y ACÁ ESTÁ EL HALLAZGO, que apareció al medir las CHECKs antes de escribir
-- esto: **esa CHECK era lo único que impedía que el navegador mandara
-- `qty: -5`** a `registrar_venta()`, SUMARA stock e inventara una venta
-- negativa. La función nunca lo validó porque no hacía falta.
--
-- Aflojar una CHECK saca una defensa que alguien más estaba usando sin saberlo
-- — la misma forma que [[La clave que sostenía un join]], donde soltar una FK
-- rompió tres `select` incrustados. Por eso el guardián explícito va en la
-- función, en esta misma transacción, y no «después».
alter table public.sale_lines drop constraint sale_lines_qty_check;
alter table public.sale_lines
  add constraint sale_lines_qty_check check (qty <> 0);

create index if not exists sale_lines_sale_id_idx on public.sale_lines (sale_id);
create index if not exists sales_org_sold_at_idx  on public.sales (org_id, sold_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- El guardián que la CHECK estaba haciendo gratis.
--
-- Se vuelve a crear `registrar_venta` idéntica salvo por la validación de
-- cantidad. SECURITY INVOKER (el default) se conserva: se evalúa con el rol de
-- quien llama, así que RLS sigue aplicando y la función no es una puerta de
-- atrás.
create or replace function public.registrar_venta(
  p_org uuid, p_location uuid, p_sold_by text, p_lineas jsonb,
  p_trip uuid default null, p_note text default null)
returns uuid
language plpgsql
as $$
declare
  v_sale  uuid;
  v_linea jsonb;
  v_item  public.gear_items%rowtype;
  v_disp  integer;
  v_qty   integer;
  v_size  text;
begin
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Una venta sin líneas no es una venta' using errcode = 'check_violation';
  end if;

  insert into public.sales (org_id, location_id, trip_id, sold_by, sold_by_account, note)
  values (p_org, p_location, p_trip, p_sold_by, auth.uid(), p_note)
  returning id into v_sale;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_qty  := (v_linea->>'qty')::int;
    v_size := coalesce(v_linea->>'size_label', 'total');

    -- NUEVO, y no es defensa en profundidad: es LA defensa. Desde que
    -- `sale_lines.qty` admite negativos para que exista el contra-asiento, una
    -- cantidad negativa acá sumaría stock. Sólo la anulación escribe negativos,
    -- y lo hace por su propia función.
    if v_qty is null or v_qty <= 0 then
      raise exception 'La cantidad de una venta tiene que ser mayor que cero' using errcode = 'check_violation';
    end if;

    select * into v_item from public.gear_items
     where id = (v_linea->>'gear_item_id')::uuid and org_id = p_org;
    if not found then
      raise exception 'El artículo no es de este centro' using errcode = 'check_violation';
    end if;

    -- El precio sale del catálogo, NUNCA de lo que mande el navegador. Mismo
    -- principio que el webhook de Paddle: una sesión válida autentica a quien
    -- habla, no a lo que dice.
    if not v_item.for_sale or v_item.sale_price is null then
      raise exception 'El artículo % no está a la venta', v_item.name using errcode = 'check_violation';
    end if;

    -- El stock se comprueba y se descuenta en la MISMA transacción, así que dos
    -- personas vendiendo la última remera a la vez no pueden pasar las dos.
    select available_count into v_disp from public.gear_stock
     where gear_item_id = v_item.id and size_label = v_size and location_id = p_location
     for update;

    if v_disp is null then
      raise exception 'No hay stock cargado de % (%)', v_item.name, v_size using errcode = 'check_violation';
    end if;
    if v_disp < v_qty then
      raise exception 'Sólo quedan % de % (%)', v_disp, v_item.name, v_size using errcode = 'check_violation';
    end if;

    insert into public.sale_lines (sale_id, gear_item_id, item_name, size_label, qty, unit_price)
    values (v_sale, v_item.id, v_item.name, v_size, v_qty, v_item.sale_price);

    update public.gear_stock set available_count = available_count - v_qty
     where gear_item_id = v_item.id and size_label = v_size and location_id = p_location;

    insert into public.gear_stock_moves
      (gear_item_id, size_label, location_id, field, delta, logged_by, reason)
    values (v_item.id, v_size, p_location, 'available', -v_qty, p_sold_by, 'Venta');
  end loop;

  return v_sale;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- La anulación.
--
-- Escribe cuatro cosas —la venta de anulación, sus líneas en negativo, el stock
-- devuelto y un movimiento por línea— y **nada a medias**. Desde el cliente
-- serían N `insert()` seguidos, y eso no es una transacción: cada pedido
-- commitea solo. Si se corta la señal a mitad quedaría stock devuelto sin
-- anulación, o una anulación sin líneas. Ver «El borrado que perdía la mitad».
create or replace function public.anular_venta(
  p_sale uuid, p_by text, p_reason text default null)
returns uuid
language plpgsql
as $$
declare
  v_orig  public.sales%rowtype;
  v_nueva uuid;
  v_linea public.sale_lines%rowtype;
  v_filas integer;
begin
  -- SECURITY INVOKER: este select pasa por RLS, así que una venta de otro
  -- centro simplemente no se encuentra. No hace falta comparar org a mano.
  --
  -- **Sin `for update`, y es una consecuencia de la inmutabilidad de más
  -- abajo**, no una omisión: en Postgres un `select ... for update` exige que la
  -- fila pase también las políticas de UPDATE, y a partir de esta migración
  -- `sales` no tiene ninguna. El candado haría fallar la anulación entera.
  --
  -- Lo que cubre la carrera entre dos mostradores anulando la misma venta es el
  -- índice único parcial sobre `voids_sale_id`: la segunda inserción no entra.
  -- Un candado de fila habría protegido lo mismo, con el detalle de que acá
  -- habría prohibido la operación en vez de serializarla.
  select * into v_orig from public.sales where id = p_sale;
  if not found then
    raise exception 'Esa venta no existe' using errcode = 'check_violation';
  end if;

  -- Los dos mensajes claros. El índice único de arriba igual lo impediría, pero
  -- un 23505 crudo le dice a quien está en el mostrador «duplicate key value
  -- violates unique constraint», que no es una respuesta.
  if v_orig.voids_sale_id is not null then
    raise exception 'Eso ya es una anulación: no se anula una anulación' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.sales where voids_sale_id = p_sale) then
    raise exception 'Esa venta ya fue anulada' using errcode = 'check_violation';
  end if;

  insert into public.sales
    (org_id, location_id, trip_id, sold_by, sold_by_account, voids_sale_id, void_reason)
  values
    (v_orig.org_id, v_orig.location_id, v_orig.trip_id, p_by, auth.uid(), p_sale, p_reason)
  returning id into v_nueva;

  for v_linea in select * from public.sale_lines where sale_id = p_sale loop
    -- La misma línea en negativo, al MISMO precio. Recalcular el precio desde
    -- el catálogo sería un error: si la remera subió de 35 a 40, anular la
    -- venta de ayer tiene que devolver 35. La anulación deshace lo que pasó, no
    -- lo que pasaría hoy.
    insert into public.sale_lines
      (sale_id, gear_item_id, item_name, size_label, qty, unit_price)
    values
      (v_nueva, v_linea.gear_item_id, v_linea.item_name, v_linea.size_label,
       -v_linea.qty, v_linea.unit_price);

    update public.gear_stock set available_count = available_count + v_linea.qty
     where gear_item_id = v_linea.gear_item_id
       and size_label   = v_linea.size_label
       and location_id  = v_orig.location_id;

    -- Si la fila de stock ya no existe —el centro borró ese talle— se frena en
    -- vez de seguir. Devolver la remera a un estante que no existe dejaría la
    -- anulación escrita y el stock sin mover, que es justo la divergencia
    -- silenciosa que este módulo entero viene a evitar.
    get diagnostics v_filas = row_count;
    if v_filas = 0 then
      raise exception 'Ya no hay stock cargado de % (%): hay que volver a crear ese talle antes de anular',
        v_linea.item_name, v_linea.size_label using errcode = 'check_violation';
    end if;

    insert into public.gear_stock_moves
      (gear_item_id, size_label, location_id, field, delta, logged_by, reason)
    values (v_linea.gear_item_id, v_linea.size_label, v_orig.location_id,
            'available', v_linea.qty, p_by, 'Anulación');
  end loop;

  return v_nueva;
end $$;

-- El EXECUTE se revoca de **public**, no de `authenticated` por nombre — que no
-- haría nada, porque se hereda de PUBLIC y el ACL lo muestra como `=X/postgres`.
-- Ver «El permiso que nunca estuvo revocado».
revoke execute on function public.anular_venta(uuid, text, text) from public;
grant  execute on function public.anular_venta(uuid, text, text) to authenticated;

-- Y de paso, `registrar_venta` quedó concedida a **anon**. Medido el 26/10:
--
--     registrar_venta  {postgres=X,anon=X,authenticated=X,service_role=X}
--     trip_archive_or_delete  {postgres=X,authenticated=X,service_role=X}
--
-- **No es un agujero**: la función es SECURITY INVOKER y las dos tablas tienen
-- RLS con `org_isolation` colgando de `auth.uid()`, así que un llamador anónimo
-- no tiene fila en `staff`, no tiene org, y no puede escribir nada (medido
-- también). Pero es una concesión que no hace falta y que no coincide con el
-- patrón de `trip_archive_or_delete`. Una puerta que no se usa igual se cierra.
revoke execute on function
  public.registrar_venta(uuid, uuid, text, jsonb, uuid, text) from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- UNA VENTA ES INMUTABLE, Y ESTO ES LA PARTE QUE DE VERDAD FALTABA
--
-- Medido el 26/10, y es el mismo hallazgo que tenía `maintenance_logs` antes
-- del sello: las dos tablas tienen **una sola política, `org_isolation`, para
-- ALL**. O sea que cualquiera del centro puede hacer UPDATE o DELETE sobre una
-- venta cerrada.
--
-- Con eso, todo el contra-asiento de arriba no vale nada: la disciplina de «una
-- venta no se edita» es una convención si la fila se puede editar. Es
-- exactamente el razonamiento del acta de una checklist, que quedó inmutable en
-- **dos capas independientes**: RLS sin política de UPDATE ni DELETE (cero
-- filas alcanzables) y un trigger que frena incluso saltando RLS.
--
-- Acá van las dos, igual que el acta — y a diferencia del sello de un service,
-- que tiene una sola porque la misma fila tiene que seguir editable mientras es
-- borrador. Una venta no tiene estado borrador: nace cerrada.

drop policy org_isolation on public.sales;
create policy sales_select on public.sales for select
  using (org_id in (select staff.org_id from public.staff where staff.id = auth.uid()));
create policy sales_insert on public.sales for insert
  with check (org_id in (select staff.org_id from public.staff where staff.id = auth.uid()));

drop policy org_isolation on public.sale_lines;
create policy sale_lines_select on public.sale_lines for select
  using (sale_id in (select s.id from public.sales s
          where s.org_id in (select staff.org_id from public.staff where staff.id = auth.uid())));
create policy sale_lines_insert on public.sale_lines for insert
  with check (sale_id in (select s.id from public.sales s
          where s.org_id in (select staff.org_id from public.staff where staff.id = auth.uid())));

create or replace function public.venta_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'Una venta no se modifica ni se borra: se anula con un contra-asiento'
    using errcode = 'check_violation';
end $$;

create trigger trg_venta_inmutable
  before update or delete on public.sales
  for each row execute function public.venta_inmutable();

create trigger trg_linea_de_venta_inmutable
  before update or delete on public.sale_lines
  for each row execute function public.venta_inmutable();

-- Ojo con el orden al probarlo: el trigger por fila dispara ANTES que el CHECK,
-- igual que pasó con `items_source` en el acta. Y toda prueba de «esto está
-- bloqueado» tiene que afirmar que **alcanzó una fila**: un `where id = NULL`
-- no toca ninguna, el trigger no dispara, y «no hubo excepción» se lee igual
-- que «se pudo». Ya pasó tres veces.

commit;
