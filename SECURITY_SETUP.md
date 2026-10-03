# 보안 및 밥친구 데이터 패치 적용

배포 전에 Vercel 프로젝트의 환경 변수에 다음 값을 설정합니다.

- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role 키
- `ADMIN_ID`: 관리자 로그인 아이디
- `ADMIN_PASSWORD`: 관리자 로그인 비밀번호
- `ADMIN_SESSION_SECRET`: 관리자 세션 서명용 임의 문자열
- `CRON_SECRET`: Vercel Cron 요청 검증용 임의 문자열

`ADMIN_SESSION_SECRET`과 `CRON_SECRET`은 서로 다른 충분히 긴 임의 값으로 설정합니다. Vercel은 Cron 실행 시 `CRON_SECRET`을 `Authorization: Bearer ...` 헤더로 전송합니다.

Supabase SQL Editor에서 [meal_friend_security_and_integrity_patch.sql](./meal_friend_security_and_integrity_patch.sql)을 한 번 실행합니다. 이 패치는 혼자 먹기 값(`0`)을 허용하고, 조의 층과 층별 조 번호를 저장하며, 조 생성을 하나의 트랜잭션으로 처리합니다. 기존 pg_cron 조 생성 작업은 Vercel Cron과 중복되지 않도록 제거합니다.

환경 변수와 SQL 패치를 적용하기 전에는 관리자 로그인과 새 조 생성이 정상 작동하지 않습니다.
