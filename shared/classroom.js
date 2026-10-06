export const SEAT_NUMBERS = Array.from({ length: 30 }, (_, index) => index + 1);

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawSeating(students, unavailableSeats = [], random = Math.random) {
  const excluded = new Set(unavailableSeats);
  const available = SEAT_NUMBERS.filter(seat => !excluded.has(seat));
  if (!students.length) throw new Error("활성 학생이 없습니다.");
  if (new Set(students).size !== students.length) throw new Error("학생 명단이 중복되었습니다.");
  if (students.length > available.length) throw new Error(`사용 가능한 자리는 ${available.length}개, 활성 학생은 ${students.length}명입니다.`);
  const seats = shuffle(available, random).slice(0, students.length);
  const names = shuffle(students, random);
  return Object.fromEntries(seats.map((seat, index) => [seat, names[index]]));
}

export function validateAssignment(assignment, students, statuses) {
  if (!assignment || typeof assignment !== "object" || Array.isArray(assignment)) return "자리표를 확인해주세요.";
  const blocked = new Set(statuses.filter(item => item.is_unavailable).map(item => item.seat_number));
  const entries = Object.entries(assignment);
  const names = entries.map(([, name]) => name);
  if (entries.some(([seat, name]) => !/^(?:[1-9]|[12]\d|30)$/.test(seat) || blocked.has(Number(seat)) || !students.includes(name))) return "사용 불가 좌석 또는 등록되지 않은 학생이 포함되어 있습니다.";
  if (new Set(names).size !== names.length) return "중복 배치된 학생이 있습니다.";
  if (!students.length || students.length !== names.length) return "모든 활성 학생을 한 번씩 배치해주세요.";
  return "";
}
