-- 조 생성 시 floor 컬럼이 없다는 오류가 발생하는 기존 DB에서 실행하세요.
-- 기존 신청과 조 기록을 삭제하지 않습니다.
begin;

alter table public.meal_groups add column if not exists floor integer;
alter table public.meal_groups add column if not exists floor_group_no integer;

create unique index if not exists meal_groups_date_floor_no_idx
  on public.meal_groups(group_date, floor, floor_group_no);

commit;

-- 적용 후 관리자 화면에서 해당 날짜의 밥친구 조를 다시 생성하세요.
-- 층 정보가 없는 예전 조 기록은 보존되지만 학생 화면에는 표시되지 않습니다.
