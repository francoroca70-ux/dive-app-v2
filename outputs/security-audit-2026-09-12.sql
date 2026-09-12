-- ============================================================================
-- Seven Seas — security audit, 12 Sep 2026
-- ALREADY APPLIED to project ggtbxjwstkuhnabwpgdz via Supabase migrations.
-- This file is the record of what changed and, more importantly, WHY -- so a
-- future session doesn't "helpfully" re-add one of the policies removed here.
-- ============================================================================
--
-- ROOT CAUSE OF EVERYTHING BELOW
-- Two generations of RLS policies had piled up on the same tables:
--   * old ones named select_x / insert_x / update_x / delete_x, granted to
--     `authenticated`, with USING (true) / WITH CHECK (true)
--   * newer, correct ones named org_isolation, scoped to the caller's org
-- Postgres combines PERMISSIVE policies with OR. So `true OR org_id = mine`
-- evaluates to `true` and the org_isolation policies were doing nothing at
-- all. Every logged-in account of any dive shop could read and write every
-- other shop's data.
--
-- ============================================================================
-- 1. organizations -- cross-org read/write + billing bypass
-- ============================================================================
-- select_org and update_org were both USING (true). Any authenticated user
-- could read every org row and UPDATE any of them -- including setting their
-- own subscription_status to 'active' for free service forever, or renaming
-- someone else's shop.
--
-- created_by exists so the signup flow's insert(...).select().single() still
-- works: at that instant the new owner has no staff row yet, so a
-- membership-only SELECT policy would reject the RETURNING clause.

alter table organizations add column if not exists created_by uuid default auth.uid();

update organizations o
set created_by = s.id
from staff s
where s.org_id = o.id and s.role = 'owner' and o.created_by is null;

drop policy if exists select_org on organizations;
drop policy if exists update_org on organizations;

create policy org_select_own on organizations
  for select to authenticated
  using (
    id in (select r.org_id from my_staff_org_and_role() r)
    or created_by = auth.uid()
  );

create policy org_update_owner_manager on organizations
  for update to authenticated
  using (exists (select 1 from my_staff_org_and_role() r
                 where r.org_id = organizations.id and r.role in ('owner','manager')))
  with check (exists (select 1 from my_staff_org_and_role() r
                 where r.org_id = organizations.id and r.role in ('owner','manager')));

-- insert_org stays USING/WITH CHECK (true) ON PURPOSE: a brand-new user must
-- be able to create their shop before they are staff of anything. Creating an
-- empty org row grants no access to anyone else's data, and the trigger below
-- stops it being used to self-grant a subscription.

-- ============================================================================
-- 2. organizations -- billing columns are server-owned
-- ============================================================================
-- Even a legitimate owner needs UPDATE on their own org row (shop name,
-- currency, settings), so policy alone can't protect the billing columns.
-- This trigger makes them unwritable from the browser: only the
-- paddle-webhook edge function (service_role key) and migrations get through.
--
-- NOTE: must be SECURITY INVOKER. The first version was SECURITY DEFINER,
-- where current_user resolves to the function owner (postgres) instead of the
-- caller -- so the check never matched and the bypass stayed open. Verified
-- by simulating an authenticated PATCH before and after.

create or replace function clamp_org_billing_columns()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  jwt_role text;
begin
  begin
    jwt_role := current_setting('request.jwt.claims', true)::json ->> 'role';
  exception when others then
    jwt_role := null;
  end;

  if current_user::text not in ('authenticated', 'anon')
     and coalesce(jwt_role, '') not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.subscription_status := 'trial';
    new.trial_ends_at := now() + interval '14 days';
    new.plan_tier := null;
    new.paddle_customer_id := null;
    new.paddle_subscription_id := null;
  else
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.plan_tier := old.plan_tier;
    new.paddle_customer_id := old.paddle_customer_id;
    new.paddle_subscription_id := old.paddle_subscription_id;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_clamp_org_billing on organizations;
create trigger trg_clamp_org_billing
  before insert or update on organizations
  for each row execute function clamp_org_billing_columns();

-- ============================================================================
-- 3. staff -- full takeover of any other dive shop (worst hole found)
-- ============================================================================
-- insert_staff only checked `id = auth.uid()` and said nothing about org_id
-- or role, so ANY logged-in account could run:
--   insert into staff (id, org_id, role) values (me, <victim org>, 'owner')
-- and instantly become an owner of someone else's operation -- their trips,
-- guests, waivers, cash. The victim's org UUID was readable because
-- select_org was USING (true), so the whole chain was trivial.
-- select_staff USING (true) also exposed every org's staff names, emails,
-- phone numbers and day rates.
--
-- The only two legitimate ways to get a staff row still work:
--   1. signup: you add yourself to the org you just created
--   2. invite: the invite-accept edge function inserts it on the service role
--      key, bypassing RLS entirely

drop policy if exists insert_staff on staff;
drop policy if exists select_staff on staff;

create policy staff_insert_self_into_own_new_org on staff
  for insert to authenticated
  with check (
    id = auth.uid()
    and org_id in (select o.id from organizations o where o.created_by = auth.uid())
  );

-- my_staff_org_and_role() is STABLE SECURITY DEFINER, so reading staff from
-- inside a policy ON staff does not recurse.
create policy staff_select_own_org on staff
  for select to authenticated
  using (org_id in (select r.org_id from my_staff_org_and_role() r));

-- ============================================================================
-- 4. drop legacy USING (true) policies where org_isolation already existed
-- ============================================================================
drop policy if exists select_boat on boats;
drop policy if exists insert_boat on boats;
drop policy if exists update_boat on boats;
drop policy if exists delete_boat on boats;

drop policy if exists select_trip on trips;
drop policy if exists insert_trip on trips;
drop policy if exists update_trip on trips;
drop policy if exists delete_trip on trips;

drop policy if exists select_participant on participants;
drop policy if exists insert_participant on participants;
drop policy if exists delete_participant on participants;

drop policy if exists select_invite on invites;
drop policy if exists insert_invite on invites;
drop policy if exists delete_invite on invites;

-- ============================================================================
-- 5. six tables had NO org-scoped policy at all, only USING (true)
-- ============================================================================
create policy org_isolation on locations
  for all to authenticated
  using (org_id in (select r.org_id from my_staff_org_and_role() r))
  with check (org_id in (select r.org_id from my_staff_org_and_role() r));

create policy org_isolation on org_operation_categories
  for all to authenticated
  using (org_id in (select r.org_id from my_staff_org_and_role() r))
  with check (org_id in (select r.org_id from my_staff_org_and_role() r));

create policy org_isolation on trip_types
  for all to authenticated
  using (org_id in (select r.org_id from my_staff_org_and_role() r))
  with check (org_id in (select r.org_id from my_staff_org_and_role() r));

create policy org_isolation on staff_locations
  for all to authenticated
  using (staff_id in (select s.id from staff s
         where s.org_id in (select r.org_id from my_staff_org_and_role() r)))
  with check (staff_id in (select s.id from staff s
         where s.org_id in (select r.org_id from my_staff_org_and_role() r)));

create policy org_isolation on trip_crew
  for all to authenticated
  using (trip_id in (select t.id from trips t
         where t.org_id in (select r.org_id from my_staff_org_and_role() r)))
  with check (trip_id in (select t.id from trips t
         where t.org_id in (select r.org_id from my_staff_org_and_role() r)));

create policy org_isolation on trip_type_gear_fields
  for all to authenticated
  using (trip_type_id in (select tt.id from trip_types tt
         where tt.org_id in (select r.org_id from my_staff_org_and_role() r)))
  with check (trip_type_id in (select tt.id from trip_types tt
         where tt.org_id in (select r.org_id from my_staff_org_and_role() r)));

drop policy if exists select_location on locations;
drop policy if exists insert_location on locations;
drop policy if exists delete_location on locations;
drop policy if exists select_categories on org_operation_categories;
drop policy if exists insert_categories on org_operation_categories;
drop policy if exists delete_categories on org_operation_categories;
drop policy if exists select_trip_types on trip_types;
drop policy if exists insert_trip_types on trip_types;
drop policy if exists update_trip_types on trip_types;
drop policy if exists delete_trip_types on trip_types;
drop policy if exists select_staff_locations on staff_locations;
drop policy if exists insert_staff_locations on staff_locations;
drop policy if exists delete_staff_locations on staff_locations;
drop policy if exists select_trip_crew on trip_crew;
drop policy if exists insert_trip_crew on trip_crew;
drop policy if exists delete_trip_crew on trip_crew;
drop policy if exists select_ttgf on trip_type_gear_fields;
drop policy if exists insert_ttgf on trip_type_gear_fields;
drop policy if exists update_ttgf on trip_type_gear_fields;
drop policy if exists delete_ttgf on trip_type_gear_fields;

-- ============================================================================
-- 6. housekeeping
-- ============================================================================
revoke execute on function public.my_staff_org_and_role() from anon;

-- gear_field_definitions.select_gear_fields stays USING (true) ON PURPOSE:
-- it's a global reference catalogue of gear field types (field_key, label,
-- field_type) with no org_id and no tenant data in it.

-- ============================================================================
-- VERIFIED AFTER APPLYING (simulated a real authenticated caller with
-- `set local role authenticated` + request.jwt.claims):
--   own org / staff / trips / boats / trip_types / locations / trip_crew /
--   participants / staff_locations / gear fields  -> all still readable,
--   counts exactly matched the caller's own org
--   cross-org staff, trips, waivers, guests, cash_ups -> 0 rows
--   org takeover via staff insert  -> blocked
--   billing bypass via org update  -> blocked (all billing cols preserved)
--   cross-org rename               -> blocked
--   invite forging into other org  -> blocked
--   webhook write as service_role  -> still works
-- ============================================================================

-- ============================================================================
-- STILL OPEN / NOT FIXED HERE (see chat notes 12 Sep 2026)
--   * Leaked-password protection is off in Supabase Auth. Dashboard only:
--     Authentication -> Policies -> enable HaveIBeenPwned check.
--   * paddle-webhook has no event-ordering guard. A delayed/out-of-order
--     Paddle event can overwrite newer subscription state. Needs an
--     occurred_at high-water mark column to fix properly. Replay protection
--     (stale signature rejection) WAS added, function version 4.
--   * A manager can promote themselves to owner via owners_managers_update_staff.
--     Insider-only, within a single org. Left as-is deliberately -- tightening
--     it risks breaking legitimate crew admin until the role model is revisited.
--   * waiver-remote-signing lets the same participant be signed repeatedly
--     with a valid token (data pollution, not a breach). No rate limiting.
-- ============================================================================
