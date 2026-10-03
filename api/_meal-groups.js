export function koreanDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function groupSizes(count) {
  for (let groupsOf4 = Math.floor(count / 4); groupsOf4 >= 0; groupsOf4 -= 1) {
    const remainder = count - groupsOf4 * 4;
    if (remainder % 3 === 0) {
      return [...Array(groupsOf4).fill(4), ...Array(remainder / 3).fill(3)];
    }
  }
  return null;
}

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function generateMealGroups(sb, groupDate) {
  const { data: choices, error: choiceError } = await sb
    .from("meal_choices")
    .select("student_name,floor")
    .eq("choice_date", groupDate)
    .in("floor", [10, 20]);
  if (choiceError) throw choiceError;

  const byFloor = new Map([[10, []], [20, []]]);
  (choices ?? []).forEach(choice => byFloor.get(choice.floor)?.push(choice.student_name));

  const { error: deleteError } = await sb
    .from("meal_groups")
    .delete()
    .eq("group_date", groupDate);
  if (deleteError) throw deleteError;

  const rows = [];
  const groups = [];
  const floorResults = [];
  [10, 20].forEach(floor => {
    const names = shuffle(byFloor.get(floor));
    const sizes = names.length ? groupSizes(names.length) : null;
    if (!sizes) {
      floorResults.push({
        floor,
        success: false,
        applicantCount: names.length,
        groupCount: 0,
        message: `${floor}층 밥친구 생성 실패 (${names.length}명)`,
      });
      return;
    }

    let offset = 0;
    sizes.forEach((size, floorIndex) => {
      const members = names.slice(offset, offset + size);
      rows.push({ group_date: groupDate, group_no: rows.length + 1, members });
      groups.push({ floor, floorGroupNo: floorIndex + 1, members });
      offset += size;
    });
    floorResults.push({
      floor,
      success: true,
      applicantCount: names.length,
      groupCount: sizes.length,
      message: `${floor}층 ${sizes.length}개 조 생성 완료`,
    });
  });

  if (rows.length) {
    const { error: insertError } = await sb.from("meal_groups").insert(rows);
    if (insertError) throw insertError;
  }

  return {
    ok: rows.length > 0,
    message: floorResults.map(result => result.message).join(" · "),
    applicantCount: choices?.length ?? 0,
    groupCount: rows.length,
    groups,
    floorResults,
  };
}
