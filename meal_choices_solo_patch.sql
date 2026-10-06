-- Supabase SQL Editor에서 실행하세요.
-- 혼자 먹기(0), 10층(10), 20층(20)을 모두 저장할 수 있게 합니다.
-- 기존 신청 및 조 편성 함수는 유지합니다.
begin;

alter table public.meal_choices
  drop constraint if exists meal_choices_floor_check;
alter table public.meal_choices
  add constraint meal_choices_floor_check check (floor in (0, 10, 20));

commit;
