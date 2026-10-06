import { createClient } from "@supabase/supabase-js";
import { isCronRequest } from "./_auth.js";
import { errorMessage } from "./_errors.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    return response.status(405).json({ ok: false, message: "GET 요청만 허용됩니다." });
  }

  if (!isCronRequest(request)) {
    return response.status(401).json({ ok: false, message: "유효하지 않은 예약 요청입니다." });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase 환경 변수가 없습니다.");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.rpc("generate_due_meal_groups");
    if (error) throw error;
    return response.status(200).json({ ok: true, result: data });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      ok: false,
      message: errorMessage(error),
    });
  }
}
