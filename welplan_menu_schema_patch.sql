
-- Supabase SQL Editor에서 실행하세요.
-- 기존 daily_menus 테이블에 외부 메뉴 수집 상태를 저장할 열을 추가합니다.

alter table public.daily_menus
  add column if not exists menu_20_source text,
  add column if not exists menu_20_source_url text,
  add column if not exists menu_20_fetched_at timestamptz,
  add column if not exists menu_20_fetch_error text;

-- 학생 화면에서 오늘 메뉴를 읽을 수 있도록 공개 조회 정책 유지/생성
alter table public.daily_menus enable row level security;

drop policy if exists "public read menus" on public.daily_menus;
create policy "public read menus"
on public.daily_menus
for select
to anon, authenticated
using (true);

-- 관리자 계정은 메뉴를 직접 수정할 수 있음
drop policy if exists "admin menus" on public.daily_menus;
create policy "admin menus"
on public.daily_menus
for all
to authenticated
using (true)
with check (true);
