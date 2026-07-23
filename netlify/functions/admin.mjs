
import { createClient } from "@supabase/supabase-js";

const ADMIN_ID = "admin";
const ADMIN_PASSWORD = "ssafy16";

function json(data, status = 200) {
  return Response.json(data, { status });
}

function verify(body) {
  return body?.adminId === ADMIN_ID && body?.adminPassword === ADMIN_PASSWORD;
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Netlify의 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

export default async (request) => {
  if (request.method !== "POST") {
    return json({ ok: false, message: "POST 요청만 허용됩니다." }, 405);
  }

  try {
    const body = await request.json();

    if (!verify(body)) {
      return json({ ok: false, message: "관리자 아이디 또는 비밀번호가 올바르지 않습니다." }, 401);
    }

    const sb = client();
    const action = body.action;

    if (action === "login") {
      return json({ ok: true });
    }

    if (action === "list_schedules") {
      const { data, error } = await sb
        .from("seating_schedules")
        .select("*")
        .order("effective_date");

      if (error) throw error;
      return json({ ok: true, schedules: data ?? [] });
    }

    if (action === "save_schedule") {
      if (!body.effectiveDate || !body.assignment) {
        return json({ ok: false, message: "적용 날짜와 자리표가 필요합니다." }, 400);
      }

      const { error } = await sb
        .from("seating_schedules")
        .upsert(
          {
            effective_date: body.effectiveDate,
            assignment: body.assignment
          },
          { onConflict: "effective_date" }
        );

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "list_choices") {
      const date = body.date;

      const { data, error } = await sb
        .from("meal_choices")
        .select("*")
        .eq("choice_date", date)
        .order("floor")
        .order("student_name");

      if (error) throw error;
      return json({ ok: true, choices: data ?? [] });
    }

    if (action === "save_menu") {
      const { error } = await sb
        .from("daily_menus")
        .upsert(
          {
            menu_date: body.date,
            menu_10: body.menu10 ?? "",
            menu_20: body.menu20 ?? "",
            updated_at: new Date().toISOString()
          },
          { onConflict: "menu_date" }
        );

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "generate_groups") {
      const { error } = await sb.rpc("generate_today_meal_groups");
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, message: "지원하지 않는 관리자 작업입니다." }, 400);
  } catch (error) {
    console.error(error);
    return json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
};

export const config = {
  path: "/api/admin"
};
