
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

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      ok: false,
      message: "POST 요청만 허용됩니다.",
    });
  }

  try {
    const body = request.body ?? {};

    if (
      body.adminId !== ADMIN_ID ||
      body.adminPassword !== ADMIN_PASSWORD
    ) {
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

    if (body.action === "list_choices") {
      const { data, error } = await sb
        .from("meal_choices")
        .select("*")
        .eq("choice_date", body.date)
        .order("floor")
        .order("student_name");

      if (error) throw error;
      return response.status(200).json({
        ok: true,
        choices: data ?? [],
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

    if (body.action === "generate_groups") {
      const { error } = await sb.rpc("generate_today_meal_groups");
      if (error) throw error;
      return response.status(200).json({ ok: true });
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
