
import { createClient } from "@supabase/supabase-js";

const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "ssafy16";

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

function validateCredentials(body) {
  return body.adminId === ADMIN_ID &&
    body.adminPassword === ADMIN_PASSWORD;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      ok: false,
      message: "POST 요청만 허용됩니다.",
    });
  }

  try {
    const body = request.body ?? {};

    if (!validateCredentials(body)) {
      return response.status(401).json({
        ok: false,
        message: "관리자 아이디 또는 비밀번호가 올바르지 않습니다.",
      });
    }

    if (body.action === "login") {
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
        floor: choiceMap.get(student.name) ?? 20,
        is_default: !choiceMap.has(student.name),
      }));

      return response.status(200).json({
        ok: true,
        choices: resolved,
      });
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

    if (body.action === "list_group_applications") {
      if (!body.date) {
        return response.status(400).json({
          ok: false,
          message: "조회 날짜가 필요합니다.",
        });
      }

      const { data, error } = await sb
        .from("meal_group_applications")
        .select("student_name, created_at")
        .eq("application_date", body.date)
        .order("created_at");

      if (error) throw error;

      return response.status(200).json({
        ok: true,
        applications: data ?? [],
      });
    }

    if (body.action === "generate_groups") {
      const groupDate = String(body.date ?? "").trim();

      if (!groupDate) {
        return response.status(400).json({
          ok: false,
          message: "조를 생성할 날짜가 필요합니다.",
        });
      }

      const { data: applications, error: applicationError } = await sb
        .from("meal_group_applications")
        .select("student_name")
        .eq("application_date", groupDate);

      if (applicationError) throw applicationError;

      const names = (applications ?? [])
        .map(item => String(item.student_name ?? "").trim())
        .filter(Boolean);

      const count = names.length;

      if (count < 3) {
        return response.status(400).json({
          ok: false,
          message: `신청자가 ${count}명입니다. 최소 3명부터 조를 만들 수 있습니다.`,
        });
      }

      if (count === 5) {
        return response.status(400).json({
          ok: false,
          message: "신청자가 5명이라 3~4명 조로 나눌 수 없습니다. 신청자를 조정한 뒤 다시 생성하세요.",
        });
      }

      // Fisher-Yates shuffle
      const shuffled = [...names];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // 3~4명 조만 생성
      // 나머지 0: 3명 조만
      // 나머지 1: 4명 조 1개 + 나머지 3명 조
      // 나머지 2: 4명 조 2개 + 나머지 3명 조 (8명 이상)
      const sizes = [];
      const remainder = count % 3;

      if (remainder === 0) {
        for (let left = count; left > 0; left -= 3) sizes.push(3);
      } else if (remainder === 1) {
        sizes.push(4);
        for (let left = count - 4; left > 0; left -= 3) sizes.push(3);
      } else {
        if (count < 8) {
          return response.status(400).json({
            ok: false,
            message: `${count}명은 3~4명 조로 정확히 나눌 수 없습니다.`,
          });
        }
        sizes.push(4, 4);
        for (let left = count - 8; left > 0; left -= 3) sizes.push(3);
      }

      const rows = [];
      let offset = 0;

      sizes.forEach((size, index) => {
        rows.push({
          group_date: groupDate,
          group_no: index + 1,
          members: shuffled.slice(offset, offset + size),
        });
        offset += size;
      });

      const { error: deleteError } = await sb
        .from("meal_groups")
        .delete()
        .eq("group_date", groupDate);

      if (deleteError) throw deleteError;

      const { error: insertError } = await sb
        .from("meal_groups")
        .insert(rows);

      if (insertError) throw insertError;

      return response.status(200).json({
        ok: true,
        applicantCount: count,
        groupCount: rows.length,
        groups: rows,
      });
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
