
# 최종 수정본 적용

## 해결되는 문제

1. 관리자 로그인
   - 이메일/Supabase Auth 방식 제거
   - 아이디 `admin`
   - 비밀번호 `ssafy16`
   - Netlify 서버 함수에서 검증

2. 자리 배치 확인
   - 관리자 로그인 후 자리 생성
   - 적용 날짜를 오늘로 선택
   - `이 자리표 예약`
   - 학생 화면 자리표 탭에서 확인

3. 메뉴 수집 확인
   - 관리자 → 점심 관리
   - 날짜 선택
   - `Welplan 메뉴 지금 가져오기`
   - 성공 시 가져온 메뉴를 관리자 화면에 바로 표시
   - 실패 시 실제 오류를 표시

## 덮어쓸 파일

프로젝트 전체에 이 수정본을 덮어쓰는 것이 가장 안전합니다.

특히 다음 파일이 필수입니다.

```text
admin.html
package.json
netlify.toml
netlify/functions/admin.mjs
netlify/functions/_welplan-menu.mjs
netlify/functions/fetch-welplan-menu.mjs
netlify/functions/scheduled-welplan-menu.mjs
```

## SQL

Supabase SQL Editor에서 `final_sql_patch.sql`을 실행합니다.

## Git 반영

```bash
git add .
git commit -m "Fix admin login, seating test and menu diagnostics"
git push
```

Netlify 배포가 끝난 뒤 `Ctrl + F5`로 새로고침합니다.

## 관리자 로그인

```text
아이디: admin
비밀번호: ssafy16
```

## 메뉴 테스트

관리자 페이지:

```text
점심 관리
→ 날짜 선택
→ Welplan 메뉴 지금 가져오기
```

여기에 나오는 성공 또는 오류 메시지가 메뉴 문제를 판단하는 기준입니다.

## Netlify 확인

Functions 메뉴에 아래 함수가 보여야 합니다.

```text
admin
fetch-welplan-menu
scheduled-welplan-menu
```

함수가 보이지 않으면 `package.json`, `netlify.toml`, `netlify/functions` 폴더가 Git에 올라가지 않은 것입니다.
