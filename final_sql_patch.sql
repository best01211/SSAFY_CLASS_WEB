
-- 현재 프로젝트에서 추가 실행할 SQL입니다.

-- 공개 학생 화면이 사용하는 함수 권한
grant execute on function public.get_active_seating() to anon, authenticated;
grant execute on function public.submit_meal_choice(text, integer) to anon, authenticated;

-- 공개 읽기 정책 재확인
drop policy if exists "public read seating" on public.seating_schedules;
create policy "public read seating"
on public.seating_schedules
for select
to anon, authenticated
using (true);

drop policy if exists "public read menus" on public.daily_menus;
create policy "public read menus"
on public.daily_menus
for select
to anon, authenticated
using (true);

drop policy if exists "public read groups" on public.meal_groups;
create policy "public read groups"
on public.meal_groups
for select
to anon, authenticated
using (true);
