
# Welplan 20층 메뉴 자동 연동 패치

대상 식당:

- Restaurant ID: `REST000133`
- 주소 형식: `https://welplan.pmh.codes/takein/YYYYMMDD/all?restaurant=REST000133`

## 1. 프로젝트에 파일 복사

이 압축파일의 내용을 기존 프로젝트 루트에 덮어씁니다.

최종 구조:

```text
SSAFY_CLASS_WEB/
├─ admin.html
├─ common.js
├─ config.js
├─ index.html
├─ netlify.toml
├─ package.json
├─ supabase_schema.sql
├─ welplan_menu_schema_patch.sql
└─ netlify/
   └─ functions/
      ├─ _welplan-menu.mjs
      ├─ fetch-welplan-menu.mjs
      └─ scheduled-welplan-menu.mjs
```

## 2. Supabase SQL 실행

Supabase Dashboard → SQL Editor에서 다음 순서로 실행합니다.

1. 기존 `supabase_schema.sql`
2. 기존 `meal_groups_3_or_4_patch.sql`
3. 새 `welplan_menu_schema_patch.sql`

## 3. Supabase 키 확인

Supabase Dashboard → Project Settings → API에서 확인합니다.

- Project URL
- anon public key
- service_role key

`config.js`에는 기존처럼 URL과 anon key만 넣습니다.

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://프로젝트ID.supabase.co",
  SUPABASE_ANON_KEY: "anon 키"
};
```

`service_role` 키는 절대 config.js나 Git 저장소에 넣지 않습니다.

## 4. Netlify 환경 변수 등록

Netlify 사이트 생성 후:

```text
Project configuration
→ Environment variables
```

아래 두 값을 등록합니다.

```text
SUPABASE_URL
https://프로젝트ID.supabase.co

SUPABASE_SERVICE_ROLE_KEY
Supabase service_role 키
```

중요: `SUPABASE_SERVICE_ROLE_KEY`는 Netlify 환경 변수로만 보관합니다.

## 5. Git에 반영

```bash
git add .
git commit -m "Add Welplan menu integration"
git push
```

Netlify가 Git 저장소와 연결되어 있으면 자동으로 재배포됩니다.

## 6. 수동 테스트

배포 후 브라우저에서 아래 주소를 엽니다.

```text
https://내사이트.netlify.app/api/fetch-welplan-menu
```

특정 날짜 테스트:

```text
https://내사이트.netlify.app/api/fetch-welplan-menu?date=20260723
```

성공하면 JSON 응답에 다음 내용이 나옵니다.

```json
{
  "ok": true,
  "message": "20층 메뉴를 가져와 Supabase에 저장했습니다."
}
```

Supabase의 `daily_menus` 테이블에서 해당 날짜의 `menu_20`을 확인합니다.

## 7. 자동 실행 시간

Netlify Scheduled Function은 UTC 기준입니다.

현재 설정:

```text
월요일~금요일 오전 7시 10분 KST
```

이는 UTC 기준으로 전날 22시 10분이므로 다음 cron을 사용합니다.

```text
10 22 * * 0-4
```

## 구현상 주의사항

Welplan은 독립 서비스이므로 페이지 HTML 구조가 변경되면 추출 코드 수정이 필요할 수 있습니다.

이 패치는 다음 순서로 메뉴를 찾습니다.

1. HTML 내부 JSON에서 `REST000133`과 점심 메뉴 탐색
2. 식당 ID가 포함된 HTML 영역 탐색
3. 실패 시 점심 영역 텍스트를 임시 추출

수동 테스트 결과가 너무 길거나 다른 식당 메뉴까지 포함한다면, 수동 호출 응답의 `strategy`와 `menus` 값을 확인한 뒤 추출 규칙을 조정해야 합니다.
