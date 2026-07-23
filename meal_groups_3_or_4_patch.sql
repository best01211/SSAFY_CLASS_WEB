
-- Supabase SQL Editor에서 실행하세요.
-- 기존 generate_today_meal_groups 함수를 3명/4명 조 편성 방식으로 교체합니다.

create or replace function public.generate_today_meal_groups()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  shuffled text[];
  n integer;
  idx integer := 1;
  next_group_no integer := 1;

  groups_of_3 integer := 0;
  groups_of_4 integer := 0;
  group_size integer;
  members text[];

  group_loop integer;
  first_index integer;
  second_index integer;
  person_a text;
  person_b text;
begin
  -- 오늘 조가 이미 생성됐다면 중복 생성하지 않음
  if exists (
    select 1
    from public.meal_groups
    where group_date = d
  ) then
    return;
  end if;

  -- 20층 선택자만 무작위 순서로 불러오기
  select array_agg(student_name order by random())
  into shuffled
  from public.meal_choices
  where choice_date = d
    and floor = 20;

  n := coalesce(array_length(shuffled, 1), 0);

  -- 1명, 2명, 5명은 3명 또는 4명만으로 전원을 나눌 수 없음
  if n in (0, 1, 2, 5) then
    return;
  end if;

  -- n = 3a + 4b가 되도록 조 개수 계산
  groups_of_4 := n / 4;

  while groups_of_4 >= 0 loop
    if mod(n - groups_of_4 * 4, 3) = 0 then
      groups_of_3 := (n - groups_of_4 * 4) / 3;
      exit;
    end if;

    groups_of_4 := groups_of_4 - 1;
  end loop;

  if groups_of_4 < 0 then
    return;
  end if;

  -- 4명 조 생성
  if groups_of_4 > 0 then
    for group_loop in 1..groups_of_4 loop
      group_size := 4;
      members := shuffled[idx:idx + group_size - 1];

      insert into public.meal_groups(
        group_date, group_no, members, created_at
      )
      values(
        d, next_group_no, to_jsonb(members), now()
      );

      for first_index in 1..group_size - 1 loop
        for second_index in first_index + 1..group_size loop
          person_a := least(members[first_index], members[second_index]);
          person_b := greatest(members[first_index], members[second_index]);

          insert into public.meal_pair_history(
            student_a, student_b, met_count, last_met_date
          )
          values(
            person_a, person_b, 1, d
          )
          on conflict(student_a, student_b)
          do update set
            met_count = public.meal_pair_history.met_count + 1,
            last_met_date = d;
        end loop;
      end loop;

      idx := idx + group_size;
      next_group_no := next_group_no + 1;
    end loop;
  end if;

  -- 3명 조 생성
  if groups_of_3 > 0 then
    for group_loop in 1..groups_of_3 loop
      group_size := 3;
      members := shuffled[idx:idx + group_size - 1];

      insert into public.meal_groups(
        group_date, group_no, members, created_at
      )
      values(
        d, next_group_no, to_jsonb(members), now()
      );

      for first_index in 1..group_size - 1 loop
        for second_index in first_index + 1..group_size loop
          person_a := least(members[first_index], members[second_index]);
          person_b := greatest(members[first_index], members[second_index]);

          insert into public.meal_pair_history(
            student_a, student_b, met_count, last_met_date
          )
          values(
            person_a, person_b, 1, d
          )
          on conflict(student_a, student_b)
          do update set
            met_count = public.meal_pair_history.met_count + 1,
            last_met_date = d;
        end loop;
      end loop;

      idx := idx + group_size;
      next_group_no := next_group_no + 1;
    end loop;
  end if;
end;
$$;

grant execute on function public.generate_today_meal_groups() to authenticated;
