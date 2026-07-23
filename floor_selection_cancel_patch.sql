
-- 10층 선택 / 선택 취소(기본 20층 복귀) 기능
-- Supabase SQL Editor에서 실행하세요.

create or replace function public.cancel_meal_choice(
  p_student_name text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  kst timestamp := now() at time zone 'Asia/Seoul';
  d date := kst::date;
begin
  if extract(hour from kst) >= 11 then
    raise exception '오전 11시 이후에는 선택을 취소할 수 없습니다.';
  end if;

  if not exists (
    select 1
    from public.students
    where name = trim(p_student_name)
      and is_active = true
  ) then
    raise exception '등록된 학생 이름이 아닙니다.';
  end if;

  delete from public.meal_choices
  where choice_date = d
    and student_name = trim(p_student_name);
end;
$$;

grant execute on function public.cancel_meal_choice(text)
to anon, authenticated;
