export function koreanDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function generateMealGroups(sb, groupDate) {
  const { data, error } = await sb.rpc("generate_meal_groups_for_date", {
    p_group_date: groupDate,
  });
  if (error) throw error;
  return data;
}
