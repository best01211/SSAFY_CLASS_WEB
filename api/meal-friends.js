import { createClient } from "@supabase/supabase-js";
import { getClassSettings, isMealOpen, kstClock, mealSummary } from "./_class-settings.js";
import { errorMessage } from "./_errors.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) return response.status(405).json({ ok: false, message: "지원하지 않는 요청입니다." });
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase 환경 변수가 없습니다.");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { date } = kstClock();
    const settings = await getClassSettings(sb);
    const isOpen = isMealOpen(settings.mealDeadline);

    if (request.method === "GET") {
      const [groupsResult, choicesResult, studentsResult] = await Promise.all([
        sb.from("meal_groups").select("floor,floor_group_no,members").eq("group_date", date).order("group_no"),
        sb.from("meal_choices").select("student_name,floor").eq("choice_date", date),
        sb.from("students").select("name").eq("is_active", true),
      ]);
      for (const result of [groupsResult, choicesResult, studentsResult]) if (result.error) throw result.error;
      const counts = mealSummary(studentsResult.data ?? [], choicesResult.data ?? []);
      const groups = (groupsResult.data ?? []).filter(group => [10, 20].includes(group.floor)).map(group => ({
        floor: group.floor, floorGroupNo: group.floor_group_no, members: Array.isArray(group.members) ? group.members : [],
      }));
      return response.status(200).json({
        ok: true, isOpen, deadline: settings.mealDeadline, counts, groups,
        floorStatuses: [10, 20].map(floor => ({ floor, applicantCount: counts.find(item => item.floor === floor).count, groupCount: groups.filter(group => group.floor === floor).length })),
      });
    }

    if (!isOpen) return response.status(400).json({ ok: false, message: `${settings.mealDeadline} 이후에는 밥친구 신청·변경·취소를 할 수 없습니다.` });
    const studentName = String(request.body?.studentName ?? "").trim();
    const action = request.body?.action ?? "apply";
    const choice = String(request.body?.choice ?? "");
    if (!studentName || studentName.length > 30 || !["apply", "cancel"].includes(action) || (action === "apply" && !["10", "20"].includes(choice))) {
      return response.status(400).json({ ok: false, message: "이름과 신청할 층을 확인해주세요." });
    }
    // DB에서도 마감 시간을 검증하고 신청 변경과 기존 조 갱신을 한 트랜잭션으로 처리합니다.
    const { error } = await sb.rpc("submit_meal_friend", { p_student_name: studentName, p_floor: action === "cancel" ? null : Number(choice), p_cancel: action === "cancel" });
    if (error) throw error;
    return response.status(200).json({ ok: true, action, choiceLabel: action === "cancel" ? "신청 취소" : `${choice}층 밥친구` });
  } catch (error) {
    console.error(error);
    return response.status(error?.code === "P0001" ? 400 : 500).json({ ok: false, message: errorMessage(error) });
  }
}
