-- 자리 기준 조 만들기 기능
-- Supabase SQL Editor에서 한 번 실행하세요.
begin;

create table if not exists public.proximity_group_sets (
  id boolean primary key default true check(id),
  seating_effective_date date not null references public.seating_schedules(effective_date) on update cascade on delete cascade,
  min_size integer not null check(min_size between 2 and 10),
  max_size integer not null check(max_size between min_size and 10),
  groups jsonb not null check(jsonb_typeof(groups)='array'),
  updated_at timestamptz not null default now()
);

alter table public.proximity_group_sets enable row level security;
revoke all on public.proximity_group_sets from public, anon, authenticated;
grant all on public.proximity_group_sets to service_role;

create or replace function public.invalidate_proximity_groups_for_seating()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  delete from public.proximity_group_sets where seating_effective_date=new.effective_date;
  return new;
end;
$$;

drop trigger if exists invalidate_proximity_groups_for_seating on public.seating_schedules;
create trigger invalidate_proximity_groups_for_seating
after update of assignment on public.seating_schedules
for each row when (old.assignment is distinct from new.assignment)
execute function public.invalidate_proximity_groups_for_seating();

revoke all on function public.invalidate_proximity_groups_for_seating() from public, anon, authenticated;
grant execute on function public.invalidate_proximity_groups_for_seating() to service_role;

commit;
