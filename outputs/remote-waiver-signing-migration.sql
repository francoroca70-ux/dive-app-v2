-- Seven Seas: remote waiver signing (link in booking confirmation email)
-- Run this once in Supabase -> SQL Editor before deploying the new
-- waiver-remote-signing edge function.

-- 1) One row per booking group that gets a shareable signing link. The public
--    signing page never queries this table directly (or any other table) with
--    the anon key -- it only talks to the waiver-remote-signing edge function,
--    which uses the service role key server-side. So RLS here only needs to
--    cover the authenticated staff-side usage (creating the link, checking
--    status) -- there is deliberately no anon/public policy on this table.
create table if not exists public.waiver_signing_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.trip_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists waiver_signing_links_group_id_idx on public.waiver_signing_links(group_id);

alter table public.waiver_signing_links enable row level security;

create policy "staff_insert_waiver_signing_links" on public.waiver_signing_links
  for insert
  with check (
    exists (select 1 from public.staff s where s.id = auth.uid() and s.org_id = waiver_signing_links.org_id)
  );

create policy "staff_select_waiver_signing_links" on public.waiver_signing_links
  for select
  using (
    exists (select 1 from public.staff s where s.id = auth.uid() and s.org_id = waiver_signing_links.org_id)
  );

-- 2) Audit trail columns on the existing waivers table -- additive, nullable,
--    nothing existing breaks. signed_via distinguishes a waiver completed by
--    a guest remotely (before arrival) from one signed in person on a staff
--    tablet, matching what Smartwaiver/WaiverForever record for every signature.
alter table public.waivers add column if not exists signed_via text not null default 'staff';
alter table public.waivers add column if not exists signer_ip text;
alter table public.waivers add column if not exists signer_user_agent text;
