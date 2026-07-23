
# 최근 5회 자리 알고리즘 + 점심 조 2×2 표시

## 자리 생성 알고리즘

자리 생성 시 `seating_schedules` 예약 목록에서 적용 날짜가 가장 최근인 5개를 참고합니다.

평가 기준:

```text
과거 같은 줄 조합 반복: 20점
과거 바로 옆자리 조합 반복: 50점
```

생성 순서:

```text
1. 오른쪽 좌석 중 빈자리를 무작위 선정
2. 나머지 좌석에 학생을 무작위 배치
3. 최근 예약 5회와 비교
4. 후보 5,000개 중 패널티가 가장 낮은 자리표 선택
```

관리자 상태창에는 아래 정보가 표시됩니다.

```text
빈자리 번호
참고한 예약 수
같은 줄 반복 수
옆자리 반복 수
```

## 점심 조 표시

각 식사 조의 이름을 카드 내부에 2×2로 표시합니다.

4명:

```text
홍길동  김철수
이영희  박민수
```

3명:

```text
홍길동  김철수
이영희
```

## 적용

기존 프로젝트에 전체 덮어쓰거나 다음 파일만 덮어쓰세요.

```text
admin.html
index.html
styles.css
```

Git 반영:

```bash
git add admin.html index.html styles.css
git commit -m "Improve seating history algorithm and meal group layout"
git push
```

Vercel 배포 후 `Ctrl + F5`로 새로고침하세요.
