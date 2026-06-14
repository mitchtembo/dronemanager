alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_insert_actor on public.notifications;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy notifications_insert_actor
on public.notifications
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and recipient_id is not null
);
