
import { createClient } from "@supabase/supabase-js";
import { generateMealGroups } from "./_meal-groups.js";
import {
  clearAdminSession,
  isAdminRequest,
  setAdminSession,
  validateAdminCredentials,
} from "./_auth.js";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Vercel 환경 변수 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    return response.status(405).json({
      ok: false,
      message: "POST 요청만 허용됩니다.",
    });
  }

  try {
    const body = request.body ?? {};

    if (body.action === "login") {
      if (!validateAdminCredentials(body.adminId, body.adminPassword)) {
        return response.status(401).json({
          ok: false,
          message: "관리자 아이디 또는 비밀번호가 올바르지 않습니다.",
        });
      }
      setAdminSession(response);
      return response.status(200).json({ ok: true });
    }

    if (!isAdminRequest(request)) {
      return response.status(401).json({ ok: false, message: "관리자 로그인이 필요합니다." });
    }

    if (body.action === "session") {
      return response.status(200).json({ ok: true });
    }

    if (body.action === "logout") {
      clearAdminSession(response);
      return response.status(200).json({ ok: true });
    }

    const sb = getClient();

    if (body.action === "list_schedules") {
      const { data, error } = await sb
        .from("seating_schedules")
        .select("*")
        .order("effective_date");

      if (error) throw error;
      return response.status(200).json({
        ok: true,
        schedules: data ?? [],
      });
    }

    if (body.action === "save_schedule") {
      if (!body.effectiveDate || !body.assignment) {
        return response.status(400).json({
          ok: false,
          message: "적용 날짜와 자리표가 필요합니다.",
        });
      }

      const { error } = await sb
        .from("seating_schedules")
        .upsert({
          effective_date: body.effectiveDate,
          assignment: body.assignment,
        }, { onConflict: "effective_date" });

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "delete_schedule") {
      const { error } = await sb
        .from("seating_schedules")
        .delete()
        .eq("id", body.id);

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "list_students") {
      const { data, error } = await sb
        .from("students")
        .select("*")
        .order("name");

      if (error) throw error;
      return response.status(200).json({
        ok: true,
        students: data ?? [],
      });
    }

    if (body.action === "create_student") {
      const name = String(body.name ?? "").trim();

      if (!name) {
        return response.status(400).json({
          ok: false,
          message: "학생 이름을 입력하세요.",
        });
      }

      const { error } = await sb
        .from("students")
        .insert({
          name,
          note: String(body.note ?? "").trim() || null,
          is_active: body.isActive !== false,
        });

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "update_student") {
      const name = String(body.name ?? "").trim();

      if (!body.id || !name) {
        return response.status(400).json({
          ok: false,
          message: "학생 ID와 이름이 필요합니다.",
        });
      }

      const { error } = await sb
        .from("students")
        .update({
          name,
          note: String(body.note ?? "").trim() || null,
          is_active: body.isActive !== false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id);

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "delete_student") {
      const { error } = await sb
        .from("students")
        .delete()
        .eq("id", body.id);

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "list_choices") {
      const { data: students, error: studentError } = await sb
        .from("students")
        .select("name")
        .eq("is_active", true)
        .order("name");

      if (studentError) throw studentError;

      const { data: choices, error: choiceError } = await sb
        .from("meal_choices")
        .select("*")
        .eq("choice_date", body.date);

      if (choiceError) throw choiceError;

      const choiceMap = new Map(
        (choices ?? []).map(choice => [choice.student_name, choice.floor])
      );

      const resolved = (students ?? []).map(student => ({
        student_name: student.name,
        floor: choiceMap.get(student.name) ?? null,
        is_default: !choiceMap.has(student.name),
      }));

      return response.status(200).json({
        ok: true,
        choices: resolved,
      });
    }

    if (body.action === "set_meal_choice") {
      const choiceDate = String(body.date ?? "").trim();
      const studentName = String(body.studentName ?? "").trim();
      const floor = Number(body.floor);
      if (!choiceDate || !studentName || ![10, 20].includes(floor)) {
        return response.status(400).json({ ok: false, message: "날짜, 학생, 층을 확인해주세요." });
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

      const { error } = await sb.from("meal_choices").upsert({
        choice_date: choiceDate,
        student_name: studentName,
        floor,
        updated_at: new Date().toISOString(),
      }, { onConflict: "choice_date,student_name" });
      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "save_menu") {
      const { error } = await sb
        .from("daily_menus")
        .upsert({
          menu_date: body.date,
          menu_10: body.menu10 ?? "",
          menu_20: body.menu20 ?? "",
          updated_at: new Date().toISOString(),
        }, { onConflict: "menu_date" });

      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

    if (body.action === "generate_groups") {
      const groupDate = String(body.date ?? "").trim();

      if (!groupDate) {
        return response.status(400).json({
          ok: false,
          message: "조를 생성할 날짜가 필요합니다.",
        });
      }

      const result = await generateMealGroups(sb, groupDate);
      return response.status(result.ok ? 200 : 400).json(result);
    }

    return response.status(400).json({
      ok: false,
      message: "지원하지 않는 관리자 작업입니다.",
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
