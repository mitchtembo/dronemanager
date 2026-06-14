create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_is_admin_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('administrator'::public.user_role, 'manager'::public.user_role), false)
$$;

alter table public.profiles enable row level security;
alter table public.drones enable row level security;
alter table public.missions enable row level security;
alter table public.flight_logs enable row level security;
alter table public.pilot_training_logs enable row level security;
alter table public.drone_maintenance_logs enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists profiles_select_self_or_admin_manager on public.profiles;
drop policy if exists profiles_update_self_or_admin_manager on public.profiles;

create policy profiles_select_self_or_admin_manager
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.current_user_is_admin_manager());

create policy profiles_update_self_or_admin_manager
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.current_user_is_admin_manager())
with check (id = auth.uid() or public.current_user_is_admin_manager());

drop policy if exists "Drones are viewable by everyone" on public.drones;
drop policy if exists "Authenticated users can insert drones" on public.drones;
drop policy if exists "Authenticated users can update drones" on public.drones;
drop policy if exists drones_select_admin_manager_or_assigned_pilot on public.drones;
drop policy if exists drones_insert_admin_manager on public.drones;
drop policy if exists drones_update_admin_manager_or_assigned_pilot on public.drones;

create policy drones_select_admin_manager_or_assigned_pilot
on public.drones
for select
to authenticated
using (
  public.current_user_is_admin_manager()
  or exists (
    select 1
    from public.missions
    where missions.drone_id = drones.id
      and missions.pilot_id = auth.uid()
  )
);

create policy drones_insert_admin_manager
on public.drones
for insert
to authenticated
with check (public.current_user_is_admin_manager());

create policy drones_update_admin_manager_or_assigned_pilot
on public.drones
for update
to authenticated
using (
  public.current_user_is_admin_manager()
  or exists (
    select 1
    from public.missions
    where missions.drone_id = drones.id
      and missions.pilot_id = auth.uid()
  )
)
with check (
  public.current_user_is_admin_manager()
  or exists (
    select 1
    from public.missions
    where missions.drone_id = drones.id
      and missions.pilot_id = auth.uid()
  )
);

drop policy if exists "Missions are viewable by everyone" on public.missions;
drop policy if exists "Authenticated users can insert missions" on public.missions;
drop policy if exists "Authenticated users can update missions" on public.missions;
drop policy if exists admin_manager_missions_all on public.missions;
drop policy if exists pilot_missions_own on public.missions;
drop policy if exists missions_select_admin_manager_or_assigned_pilot on public.missions;
drop policy if exists missions_insert_admin_manager on public.missions;
drop policy if exists missions_update_admin_manager_or_assigned_pilot on public.missions;

create policy missions_select_admin_manager_or_assigned_pilot
on public.missions
for select
to authenticated
using (public.current_user_is_admin_manager() or pilot_id = auth.uid());

create policy missions_insert_admin_manager
on public.missions
for insert
to authenticated
with check (public.current_user_is_admin_manager());

create policy missions_update_admin_manager_or_assigned_pilot
on public.missions
for update
to authenticated
using (public.current_user_is_admin_manager() or pilot_id = auth.uid())
with check (public.current_user_is_admin_manager() or pilot_id = auth.uid());

drop policy if exists "Flight logs viewable by everyone" on public.flight_logs;
drop policy if exists "Authenticated users can insert flight logs" on public.flight_logs;
drop policy if exists admin_manager_flight_logs_all on public.flight_logs;
drop policy if exists pilot_flight_logs_insert on public.flight_logs;
drop policy if exists pilot_flight_logs_select on public.flight_logs;
drop policy if exists flight_logs_select_admin_manager_or_own_pilot on public.flight_logs;
drop policy if exists flight_logs_insert_own_pilot on public.flight_logs;
drop policy if exists flight_logs_update_admin_manager on public.flight_logs;

create policy flight_logs_select_admin_manager_or_own_pilot
on public.flight_logs
for select
to authenticated
using (public.current_user_is_admin_manager() or pilot_id = auth.uid());

create policy flight_logs_insert_own_pilot
on public.flight_logs
for insert
to authenticated
with check (pilot_id = auth.uid());

create policy flight_logs_update_admin_manager
on public.flight_logs
for update
to authenticated
using (public.current_user_is_admin_manager())
with check (public.current_user_is_admin_manager());

drop policy if exists "pilot_training_logs_select_all" on public.pilot_training_logs;
drop policy if exists "pilot_training_logs_insert_authenticated" on public.pilot_training_logs;
drop policy if exists "pilot_training_logs_update_authenticated" on public.pilot_training_logs;
drop policy if exists pilot_training_logs_admin_manager_all on public.pilot_training_logs;

create policy pilot_training_logs_admin_manager_all
on public.pilot_training_logs
for all
to authenticated
using (public.current_user_is_admin_manager())
with check (public.current_user_is_admin_manager());

drop policy if exists "Maintenance logs are viewable by everyone" on public.drone_maintenance_logs;
drop policy if exists "Authenticated users can insert maintenance logs" on public.drone_maintenance_logs;
drop policy if exists "Authenticated users can update maintenance logs" on public.drone_maintenance_logs;
drop policy if exists drone_maintenance_logs_admin_manager_all on public.drone_maintenance_logs;

create policy drone_maintenance_logs_admin_manager_all
on public.drone_maintenance_logs
for all
to authenticated
using (public.current_user_is_admin_manager())
with check (public.current_user_is_admin_manager());
