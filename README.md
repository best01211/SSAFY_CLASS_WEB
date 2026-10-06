# 적용 순서

**최신 관리자·밥친구·자리 기능은 [2026-10-06 변경 안내](docs/UPDATE_2026-10-06.md)를 먼저 확인하세요.** Supabase에서 `class_management_update.sql`, `class_management_cron.sql` 순서로 실행한 뒤 재배포합니다.

1. Supabase SQL Editor에서 `supabase_meal_group_applications.sql`을 한 번 실행합니다.
2. 기존 프로젝트의 아래 파일을 덮어씁니다.

- `index.html`
- `admin.html`
- `api/admin.js`

3. Git에 반영합니다.

```bash
git add index.html admin.html api/admin.js
git commit -m "Change lunch groups to opt-in matching"
git push
```

## 동작

- 식사 층 선택과 밥 친구 신청은 서로 독립적입니다.
- 신청한 학생만 매칭됩니다.
- 신청하지 않은 학생은 절대 조에 포함되지 않습니다.
- 관리자가 선택한 날짜의 신청자만 조회/매칭합니다.
- 조는 기본적으로 3~4명으로 생성하며, 같은 층 신청자가 정확히 5명이면 5명 조 하나로 생성합니다.
- 같은 층 신청자가 1명 또는 2명이면 생성하지 않습니다.
- 조를 다시 생성하면 해당 날짜의 기존 `meal_groups`를 지우고 신청자 기준으로 새로 만듭니다.

## 5명 조 적용

기존 보안 및 데이터 정합성 패치가 적용된 Supabase 프로젝트에서는 SQL Editor에서 `meal_groups_five_member_patch.sql`을 실행합니다. 조 편성은 DB 함수에서 처리하므로 웹사이트 재배포만으로는 이 규칙이 적용되지 않습니다. SQL 적용 후 관리자 화면에서 해당 날짜의 조를 다시 생성하거나 다음 자동 편성을 기다립니다.

새 프로젝트에는 `meal_friend_security_and_integrity_patch.sql`에 같은 규칙이 포함되어 있습니다.

조 생성 시 `column "floor" of relation "meal_groups" does not exist`가 나오면 `meal_groups_schema_fix.sql`을 실행한 뒤 해당 날짜의 조를 다시 생성합니다. 이 파일은 기존 신청과 조 기록을 삭제하지 않고 누락된 층 컬럼을 추가합니다. 최신 `meal_groups_five_member_patch.sql`에도 이 보강이 포함되어 있습니다.

## 혼자 먹기 저장 오류

기존 DB의 `meal_choices_floor_check`가 10·20만 허용하면 혼자 먹기 값 `0`을 저장하지 못합니다. Supabase SQL Editor에서 `meal_choices_solo_patch.sql`을 실행하면 0·10·20을 모두 허용합니다. 이 패치는 조 편성 함수를 변경하지 않습니다.

## 자리 적용일 등록과 사전 공개

관리자 → 자리 배치에서 적용 날짜를 선택하고 자리표를 생성하거나 직접 배치한 뒤 `이 자리표 예약`을 누릅니다. 공개일은 적용일에서 7일을 뺀 날짜로 자동 계산됩니다. 같은 적용일로 저장하면 해당 예약이 수정됩니다.

학생 화면은 한국 시간 공개일 00:00부터 해당 자리표를 표시하며, 다음 자리표의 공개일 전까지 계속 표시합니다. 적용일 전에는 `다음 적용 자리표`로 안내합니다. 예를 들어 적용일이 10월 20일과 11월 3일이면 10월 13일부터 첫 자리표, 10월 27일부터 다음 자리표가 표시됩니다. 공개일이 된 예약 중 적용일이 가장 최근인 자리표 하나를 표시합니다. 공개된 예약이 없으면 빈 자리표를 표시합니다.

기존 프로젝트는 Supabase SQL Editor에서 `seating_publication_patch.sql`을 실행하고 웹사이트를 재배포합니다. 학생 화면은 1분 간격으로 다시 조회하므로 열어둔 화면은 다음 조회 때 갱신됩니다. 새 프로젝트용 `supabase_schema.sql`에도 같은 규칙이 포함되어 있습니다.
