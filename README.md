# 적용 순서

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
- 조는 3~4명으로만 생성합니다.
- 1명, 2명, 5명처럼 3~4명 조로 정확히 나눌 수 없는 경우 생성하지 않습니다.
- 조를 다시 생성하면 해당 날짜의 기존 `meal_groups`를 지우고 신청자 기준으로 새로 만듭니다.
