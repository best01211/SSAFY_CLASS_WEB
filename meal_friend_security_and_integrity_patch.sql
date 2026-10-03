-- 밥친구 보안 및 데이터 정합성 패치
-- Supabase SQL Editor에서 한 번 실행하세요.

alter table public.meal_choices
  drop constraint if exists meal_choices_floor_check;
alter table public.meal_choices
  add constraint meal_choices_floor_check check (floor in (0, 10, 20));

alter table public.meal_groups add column if not exists floor integer;
alter table public.meal_groups add column if not exists floor_group_no integer;
delete from public.meal_groups where floor is null or floor_group_no is null;
alter table public.meal_groups alter column floor set not null;
alter table public.meal_groups alter column floor_group_no set not null;
alter table public.meal_groups
  drop constraint if exists meal_groups_floor_check;
alter table public.meal_groups
  add constraint meal_groups_floor_check check (floor in (10, 20));
create unique index if not exists meal_groups_date_floor_no_idx
  on public.meal_groups(group_date, floor, floor_group_no);

create or replace function public.generate_meal_groups_for_date(p_group_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_floor integer;
  names text[];
  applicant_count integer;
  groups_of_4 integer;
  groups_of_3 integer;
  group_size integer;
  offset_no integer;
  current_floor_group_no integer;
  global_group_no integer := 1;
  members text[];
  result_groups jsonb := '[]'::jsonb;
  floor_results jsonb := '[]'::jsonb;
  result_messages text[] := array[]::text[];
  total_applicants integer := 0;
  total_groups integer := 0;
begin
  if p_group_date is null then
    raise exception '조를 생성할 날짜가 필요합니다.';
  end if;

  perform pg_advisory_xact_lock(hashtext('meal_groups:' || p_group_date::text));
  delete from public.meal_groups where group_date = p_group_date;

  foreach target_floor in array array[10, 20]
  loop
    select array_agg(student_name order by random())
      into names
      from public.meal_choices
     where choice_date = p_group_date
       and floor = target_floor;

    applicant_count := coalesce(array_length(names, 1), 0);
    total_applicants := total_applicants + applicant_count;
    groups_of_4 := floor(applicant_count / 4.0)::integer;

    while groups_of_4 >= 0 and mod(applicant_count - groups_of_4 * 4, 3) <> 0
    loop
      groups_of_4 := groups_of_4 - 1;
    end loop;

    if applicant_count = 0 or groups_of_4 < 0 then
      result_messages := array_append(
        result_messages,
        format('%s층 밥친구 생성 실패 (%s명)', target_floor, applicant_count)
      );
      floor_results := floor_results || jsonb_build_array(jsonb_build_object(
        'floor', target_floor,
        'success', false,
        'applicantCount', applicant_count,
        'groupCount', 0,
        'message', format('%s층 밥친구 생성 실패 (%s명)', target_floor, applicant_count)
      ));
      continue;
    end if;

    groups_of_3 := (applicant_count - groups_of_4 * 4) / 3;
    offset_no := 1;
    current_floor_group_no := 1;

    for group_size in
      select size from (
        select 4 as size, series_no as sort_no
          from generate_series(1, groups_of_4) as series_values(series_no)
        union all
        select 3 as size, groups_of_4 + series_no as sort_no
          from generate_series(1, groups_of_3) as series_values(series_no)
      ) sizes order by sort_no
    loop
      members := names[offset_no:offset_no + group_size - 1];
      insert into public.meal_groups(
        group_date, group_no, floor, floor_group_no, members
      ) values (
        p_group_date, global_group_no, target_floor, current_floor_group_no, to_jsonb(members)
      );
      result_groups := result_groups || jsonb_build_array(jsonb_build_object(
        'floor', target_floor,
        'floorGroupNo', current_floor_group_no,
        'members', to_jsonb(members)
      ));
      offset_no := offset_no + group_size;
      current_floor_group_no := current_floor_group_no + 1;
      global_group_no := global_group_no + 1;
      total_groups := total_groups + 1;
    end loop;

    result_messages := array_append(
      result_messages,
      format('%s층 %s개 조 생성 완료', target_floor, current_floor_group_no - 1)
    );
    floor_results := floor_results || jsonb_build_array(jsonb_build_object(
      'floor', target_floor,
      'success', true,
      'applicantCount', applicant_count,
      'groupCount', current_floor_group_no - 1,
      'message', format('%s층 %s개 조 생성 완료', target_floor, current_floor_group_no - 1)
    ));
  end loop;

  return jsonb_build_object(
    'ok', total_groups > 0,
    'message', array_to_string(result_messages, ' · '),
    'applicantCount', total_applicants,
    'groupCount', total_groups,
    'groups', result_groups,
    'floorResults', floor_results
  );
end;
$$;

create or replace function public.generate_today_meal_groups()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_meal_groups_for_date(
    (now() at time zone 'Asia/Seoul')::date
  );
end;
$$;

revoke all on function public.generate_meal_groups_for_date(date) from public, anon, authenticated;
grant execute on function public.generate_meal_groups_for_date(date) to service_role;
revoke all on function public.generate_today_meal_groups() from public, anon, authenticated;
grant execute on function public.generate_today_meal_groups() to service_role;
do $$
begin
  if to_regprocedure('public.submit_meal_choice(text,integer)') is not null then
    execute 'revoke all on function public.submit_meal_choice(text, integer) from public, anon, authenticated';
  end if;
end;
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
    from cron.job
   where jobname = 'generate-daily-20f-groups'
   limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
exception
  when undefined_table or invalid_schema_name or insufficient_privilege then
    null;
end;
$$;
