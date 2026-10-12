import { createClient } from "@supabase/supabase-js";
import { errorMessage } from "./_errors.js";

function koreanDate() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ ok: false, message: "GET 요청만 허용됩니다." });
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase 환경 변수가 없습니다.");
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const [{ data: seating, error: seatingError }, { data: saved, error: groupError }] = await Promise.all([
      sb.from("seating_schedules").select("effective_date").lte("effective_date", koreanDate()).order("effective_date", { ascending: false }).limit(1).maybeSingle(),
      sb.from("proximity_group_sets").select("seating_effective_date,min_size,max_size,groups,updated_at").eq("id", true).maybeSingle(),
    ]);
    if (seatingError) throw seatingError;
    if (groupError) throw groupError;
    const current = seating && saved?.seating_effective_date === seating.effective_date ? saved : null;
    return response.status(200).json({
      ok: true,
      effectiveDate: seating?.effective_date ?? null,
      minSize: current?.min_size ?? null,
      maxSize: current?.max_size ?? null,
      groups: current?.groups ?? [],
      generatedAt: current?.updated_at ?? null,
      needsGeneration: Boolean(seating) && !current,
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ ok: false, message: errorMessage(error) });
  }
}
