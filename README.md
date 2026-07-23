# 수정 내용

오류:

Assignment to constant variable.

원인:
common.js에서 STUDENTS가 const로 선언되어 있는데,
index.html에서 Supabase 학생 목록으로 다시 할당하고 있었습니다.

수정:
const STUDENTS → let STUDENTS

적용:
기존 프로젝트의 common.js를 이 파일로 덮어쓴 뒤 Git에 push하세요.

git add common.js
git commit -m "Fix dynamic student list assignment"
git push
