import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경 변수가 없습니다.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function kstNow() {
  const value = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return {
    date: value.toISOString().slice(0, 10),
    hour: value.getUTCHours(),
  };
}

export default async function handler(request, response) {
  try {
    response.setHeader("Cache-Control", "no-store");
    const sb = getClient();
    const { date, hour } = kstNow();

    if (request.method === "GET") {
      const [
        { data: groups, error: groupError },
        { data: choices, error: choiceError },
        { data: students, error: studentError },
      ] =
        await Promise.all([
          sb.from("meal_groups").select("*").eq("group_date", date).order("group_no"),
          sb.from("meal_choices").select("student_name,floor").eq("choice_date", date),
          sb.from("students").select("name").eq("is_active", true).order("name"),
        ]);

      if (groupError) throw groupError;
      if (choiceError) throw choiceError;
      if (studentError) throw studentError;

      const floorByStudent = new Map(
        (choices ?? []).map(item => [item.student_name, item.floor])
      );
      const resolvedGroups = (groups ?? []).map(group => {
        const members = Array.isArray(group.members) ? group.members : [];
        return { floor: group.floor, floorGroupNo: group.floor_group_no, members };
      }).filter(group => [10, 20].includes(group.floor));

      return response.status(200).json({
        ok: true,
        isOpen: hour < 12,
        groups: resolvedGroups,
        applications: (students ?? []).map(student => ({
          studentName: student.name,
          floor: floorByStudent.get(student.name) ?? null,
        })),
        floorStatuses: [10, 20].map(floor => {
          const applicantCount = (choices ?? []).filter(item => item.floor === floor).length;
          const groupCount = resolvedGroups.filter(group => group.floor === floor).length;
          return {
            floor,
            applicantCount,
            groupCount,
            success: groupCount > 0,
          };
        }),
      });
    }

    if (request.method === "POST") {
      if (hour >= 12) {
        return response.status(400).json({
          ok: false,
          message: "낮 12시 이후에는 밥친구 선택을 변경할 수 없습니다.",
        });
      }

      const studentName = String(request.body?.studentName ?? "").trim();
      const choice = String(request.body?.choice ?? "solo");
      if (!studentName || !["solo", "10", "20"].includes(choice)) {
        return response.status(400).json({ ok: false, message: "이름과 식사 방법을 확인해주세요." });
      }

      const { data: student, error: studentError } = await sb
        .from("students")
        .select("name")
        .eq("name", studentName)
        .eq("is_active", true)
        .maybeSingle();
      if (studentError) throw studentError;
      if (!student) {
        return response.status(400).json({ ok: false, message: "등록된 활성 학생이 아닙니다." });
      }

      if (choice === "solo") {
        const { error } = await sb.from("meal_choices").upsert({
          choice_date: date,
          student_name: studentName,
          floor: 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "choice_date,student_name" });
        if (error) throw error;
      } else {
        const { error } = await sb.from("meal_choices").upsert({
          choice_date: date,
          student_name: studentName,
          floor: Number(choice),
          updated_at: new Date().toISOString(),
        }, { onConflict: "choice_date,student_name" });
        if (error) throw error;
      }

      const choiceLabel = choice === "solo" ? "혼자 먹기" : `${choice}층 밥친구`;
      return response.status(200).json({ ok: true, choice, choiceLabel });
    }

    return response.status(405).json({ ok: false, message: "지원하지 않는 요청입니다." });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
