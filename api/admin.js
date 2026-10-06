
import { createClient } from "@supabase/supabase-js";
import { generateMealGroups } from "./_meal-groups.js";
import { errorMessage } from "./_errors.js";
import { getClassSettings, validDeadline } from "./_class-settings.js";
import { SEAT_NUMBERS, validateAssignment } from "../shared/classroom.js";
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

    if (body.action === "get_class_settings") {
      return response.status(200).json({ ok: true, settings: await getClassSettings(sb) });
    }
    if (body.action === "save_meal_deadline") {
      if (!validDeadline(body.deadline)) return response.status(400).json({ ok: false, message: "마감 시간을 시:분 형식으로 선택해주세요." });
      const { error } = await sb.rpc("set_meal_deadline", { p_deadline: body.deadline });
      if (error) throw error;
      return response.status(200).json({ ok: true });
    }
    if (body.action === "list_seat_statuses") {
      const { data, error } = await sb.from("seat_statuses").select("*").order("seat_number");
      if (error) throw error;
      return response.status(200).json({ ok: true, seats: data ?? [] });
    }
    if (body.action === "set_seat_status") {
      const seatNumber = Number(body.seatNumber);
      const reason = String(body.reason ?? "").trim();
      if (!SEAT_NUMBERS.includes(seatNumber) || typeof body.isUnavailable !== "boolean" || reason.length > 300 || (body.isUnavailable && !reason)) return response.status(400).json({ ok: false, message: "자리 번호와 사용 불가 사유(300자 이하)를 확인해주세요." });
      const { error } = await sb.from("seat_statuses").upsert({ seat_number: seatNumber, is_unavailable: body.isUnavailable, reason: body.isUnavailable ? reason : "", updated_at: new Date().toISOString() }, { onConflict: "seat_number" });
      if (error) throw error;
      return response.status(200).json({ ok: true });
    }
    if (body.action === "list_seat_reports") {
      const { data, error } = await sb.from("seat_reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return response.status(200).json({ ok: true, reports: data ?? [] });
    }
    if (body.action === "resolve_seat_report") {
      if (!Number.isSafeInteger(Number(body.id)) || Number(body.id) < 1) return response.status(400).json({ ok: false, message: "신고 번호를 확인해주세요." });
      const { error } = await sb.from("seat_reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", Number(body.id));
      if (error) throw error;
      return response.status(200).json({ ok: true });
    }

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

      const effectiveDate = String(body.effectiveDate);
      const parsedDate = new Date(`${effectiveDate}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
        !Number.isFinite(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== effectiveDate) {
        return response.status(400).json({
          ok: false,
          message: "유효한 자리 적용 날짜를 선택해주세요.",
        });
      }

      const [studentsResult, statusesResult] = await Promise.all([
        sb.from("students").select("name").eq("is_active", true),
        sb.from("seat_statuses").select("seat_number,is_unavailable"),
      ]);
      for (const result of [studentsResult, statusesResult]) if (result.error) throw result.error;
      const assignmentProblem = validateAssignment(body.assignment, (studentsResult.data ?? []).map(item => item.name), statusesResult.data ?? []);
      if (assignmentProblem) return response.status(400).json({ ok: false, message: assignmentProblem });
      const { error } = await sb
        .from("seating_schedules")
        .upsert({
          effective_date: effectiveDate,
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
        floor: [10, 20].includes(choiceMap.get(student.name)) ? choiceMap.get(student.name) : null,
        is_default: !choiceMap.has(student.name),
      }));

      const { data: groups, error: groupError } = await sb.from("meal_groups").select("floor,floor_group_no,members").eq("group_date", body.date).order("group_no");
      if (groupError) throw groupError;
      return response.status(200).json({
        ok: true,
        choices: resolved,
        groups: groups ?? [],
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
      message: errorMessage(error),
    });
  }
}
