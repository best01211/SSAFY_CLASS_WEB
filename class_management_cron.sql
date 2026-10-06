-- class_management_update.sql을 먼저 실행하세요.
-- 변경 가능한 마감 시간에 맞춰 평일 조를 자동 편성합니다.
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job
where jobname in ('generate-daily-20f-groups','generate-meal-groups-at-deadline');

select cron.schedule(
  'generate-meal-groups-at-deadline',
  '* * * * *',
  'select public.generate_due_meal_groups();'
);
