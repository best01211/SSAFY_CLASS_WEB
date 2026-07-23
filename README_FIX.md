
# 좌석 UI·오늘 메뉴 표시 수정

기존 프로젝트에 아래 파일을 덮어쓰세요.

- `common.js`
- `styles.css`
- `index.html`
- `admin.html`

## 수정 내용

### 좌석표
- 2번 좌석을 왼쪽 책상 영역의 우측 열에 배치
- 27번 좌석을 왼쪽 책상 영역의 우측 열에 배치
- 가운데 표시를 `스크린`에서 `복도`로 변경
- 관리자 미리보기에도 동일하게 반영

### 오늘 점심
- 오늘 점심 탭을 누르면 Supabase의 오늘 메뉴 조회
- `menu_20`이 비어 있으면 `/api/fetch-welplan-menu`를 즉시 호출
- 수집 후 Supabase를 다시 조회하여 화면에 표시
- 수집 실패 시 오류 메시지와 Welplan 원본 링크 표시
- 메뉴 줄바꿈 유지

### 이름 입력
- 학생 이름 선택창을 텍스트 입력창으로 변경
- 반 명단과 정확히 일치하는 이름만 저장

## 적용

```bash
git add .
git commit -m "Fix seat layout and today menu loading"
git push
```

Netlify 자동 배포가 끝난 뒤 브라우저에서 강력 새로고침하세요.

```text
Ctrl + F5
```

## 메뉴가 계속 보이지 않을 때

배포 주소 뒤에 아래 경로를 붙여 직접 확인하세요.

```text
/api/fetch-welplan-menu?date=20260723
```

응답의 `ok`, `message` 내용을 확인하면 Netlify Function 문제인지 메뉴 추출 문제인지 구분할 수 있습니다.
