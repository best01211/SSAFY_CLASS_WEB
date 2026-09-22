import { createClient } from "@supabase/supabase-js";
import { generateMealGroups, koreanDate } from "./_meal-groups.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({ ok: false, message: "GET 요청만 허용됩니다." });
  }

  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase 환경 변수가 없습니다.");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const result = await generateMealGroups(sb, koreanDate());
    return response.status(200).json(result);
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
