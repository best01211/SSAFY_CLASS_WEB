
# Vercel 배포용 프로젝트

이 폴더는 Netlify Functions를 Vercel Functions로 변경한 버전입니다.

## 주요 변경

```text
netlify/functions/ → api/
netlify.toml 삭제
vercel.json 추가
```

학생 및 관리자 화면에서 사용하는 주소는 그대로입니다.

```text
/api/admin
/api/fetch-welplan-menu
```

따라서 `index.html`, `admin.html`의 API 호출 코드는 다시 수정할 필요가 없습니다.

## 1. Git 저장소에 덮어쓰기

기존 프로젝트 전체에 이 폴더의 내용을 덮어쓰세요.

특히 다음 구조가 있어야 합니다.

```text
api/
├─ _welplan-menu.js
├─ admin.js
├─ fetch-welplan-menu.js
└─ scheduled-welplan-menu.js

vercel.json
package.json
index.html
admin.html
```

Netlify 전용 폴더와 파일은 삭제합니다.

```text
netlify/
netlify.toml
```

## 2. Git 반영

```bash
git add .
git commit -m "Migrate deployment from Netlify to Vercel"
git push
```

## 3. Vercel에서 프로젝트 가져오기

1. Vercel 로그인
2. Add New → Project
3. GitHub 저장소 선택
4. Import

배포 설정:

```text
Framework Preset: Other
Root Directory: ./
Build Command: 비워두기
Output Directory: 비워두기
Install Command: 기본값
```

그대로 Deploy를 누릅니다.

## 4. Vercel 환경 변수

프로젝트 → Settings → Environment Variables에서 아래 두 값을 추가합니다.

```text
SUPABASE_URL
https://실제프로젝트ID.supabase.co
```

```text
SUPABASE_SERVICE_ROLE_KEY
sb_secret_...
```

적용 환경은 Production, Preview, Development 모두 선택해도 됩니다.

환경 변수를 저장한 뒤 반드시 Redeploy합니다.

## 5. 정상 동작 테스트

### 관리자 API

```text
https://배포주소.vercel.app/api/admin
```

브라우저에서 열면 POST 전용이므로 오류가 표시되는 것이 정상입니다.

관리자 화면:

```text
https://배포주소.vercel.app/admin.html
```

로그인:

```text
ID: admin
PW: ssafy16
```

### 메뉴 API

```text
https://배포주소.vercel.app/api/fetch-welplan-menu?date=20260723
```

성공 시:

```json
{
  "ok": true,
  "message": "Welplan 20층 점심 메뉴를 저장했습니다."
}
```

### 자리 배치

```text
관리자 로그인
→ 자리 배치
→ 적용 날짜를 오늘로 선택
→ 자리 생성
→ 이 자리표 예약
→ 학생 화면 자리표 확인
```

## 6. 자동 메뉴 수집

`vercel.json`에는 다음 스케줄이 들어 있습니다.

```text
10 22 * * 0-4
```

UTC 일요일~목요일 22:10이며, 한국 시간 월요일~금요일 오전 7:10입니다.

## 7. 기존 Netlify

Vercel 배포가 정상적으로 확인되기 전에는 Netlify 프로젝트를 삭제하지 않아도 됩니다.
Vercel 주소에서 관리자 로그인, 자리 저장, 메뉴 수집이 모두 확인된 다음 Netlify를 중지하세요.
