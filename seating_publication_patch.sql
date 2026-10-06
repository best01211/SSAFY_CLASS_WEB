-- Supabase SQL Editor에서 실행하세요.
-- 한국 시간 적용일 7일 전 00:00부터 공개하고 다음 자리표 공개 전까지 유지합니다.
begin;

create or replace function public.get_active_seating()
returns table(effective_date date, assignment jsonb)
language sql
security definer
set search_path = public
as $$
  select effective_date, assignment
  from public.seating_schedules
  where effective_date <= (now() at time zone 'Asia/Seoul')::date + 7
  order by effective_date desc
  limit 1
$$;

grant execute on function public.get_active_seating() to anon, authenticated;

-- 학생이 테이블을 직접 조회해도 아직 공개일이 되지 않은 예약은 보이지 않습니다.
drop policy if exists "public read seating" on public.seating_schedules;
create policy "public read seating"
on public.seating_schedules
for select to anon, authenticated
using (effective_date <= (now() at time zone 'Asia/Seoul')::date + 7);

commit;
