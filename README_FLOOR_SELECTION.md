
# 식사 층 선택 최종 방식

## 동작 원칙

```text
기록 없음 = 20층
10층으로 변경 = meal_choices에 floor 10 저장
선택 취소 = 해당 날짜 기록 삭제 = 기본 20층 복귀
```

20층은 별도로 저장할 필요가 없습니다.

## 학생 화면

학생은 이름을 입력한 뒤 다음 중 하나만 사용합니다.

- `10층으로 변경`
- `선택 취소 · 20층 복귀`

오전 11시 이후에는 두 작업 모두 불가능합니다.

## 적용 방법

1. 기존 프로젝트에 전체 덮어쓰기
2. Supabase SQL Editor에서 실행:

```text
floor_selection_cancel_patch.sql
```

3. Git 반영:

```bash
git add .
git commit -m "Simplify meal floor selection with default 20F"
git push
```

4. Vercel 배포 후 `Ctrl + F5`

## 점심 조 생성

관리자와 자동 조 생성 함수는 다음 기준을 사용합니다.

- 명시적으로 10층을 선택한 학생: 제외
- 선택 기록이 없는 학생: 20층 포함
- 과거에 20층을 저장했던 기존 기록: 20층 포함
