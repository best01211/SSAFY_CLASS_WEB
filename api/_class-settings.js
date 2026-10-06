export function kstClock(now = Date.now()) {
  const value = new Date(now + 9 * 60 * 60 * 1000);
  return { date: value.toISOString().slice(0, 10), minutes: value.getUTCHours() * 60 + value.getUTCMinutes() };
}

export function validDeadline(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isMealOpen(deadline, now = Date.now()) {
  const [hour, minute] = deadline.split(":").map(Number);
  return kstClock(now).minutes < hour * 60 + minute;
}

export async function getClassSettings(sb) {
  const { data, error } = await sb.from("class_settings").select("meal_deadline").eq("id", true).single();
  if (error) throw error;
  return { mealDeadline: data.meal_deadline.slice(0, 5) };
}

export function mealSummary(students, choices) {
  const active = new Set(students.map(item => item.name));
  const selected = new Map(choices.filter(item => active.has(item.student_name) && [10, 20].includes(item.floor)).map(item => [item.student_name, item.floor]));
  return [10, 20, null].map(floor => ({ floor, count: floor === null ? active.size - selected.size : [...selected.values()].filter(value => value === floor).length }));
}
