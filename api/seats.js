import { createClient } from "@supabase/supabase-js";
import { SEAT_NUMBERS } from "../shared/classroom.js";
import { errorMessage } from "./_errors.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) return response.status(405).json({ ok: false, message: "지원하지 않는 요청입니다." });
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase 환경 변수가 없습니다.");
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    if (request.method === "GET") {
      const { data, error } = await sb.from("seat_statuses").select("seat_number,is_unavailable,reason").order("seat_number");
      if (error) throw error;
      return response.status(200).json({ ok: true, seats: data ?? [] });
    }
    const seatNumber = Number(request.body?.seatNumber);
    const reporterName = String(request.body?.reporterName ?? "").trim();
    const reason = String(request.body?.reason ?? "").trim();
    if (!SEAT_NUMBERS.includes(seatNumber) || !reporterName || reporterName.length > 30 || !reason || reason.length > 500) return response.status(400).json({ ok: false, message: "자리 번호, 신고자 이름, 사유(500자 이하)를 확인해주세요." });
    const { data: student, error: studentError } = await sb.from("students").select("name").eq("name", reporterName).eq("is_active", true).maybeSingle();
    if (studentError) throw studentError;
    if (!student) return response.status(400).json({ ok: false, message: "등록된 활성 학생 이름을 입력해주세요." });
    const { error } = await sb.from("seat_reports").insert({ seat_number: seatNumber, reporter_name: reporterName, reason });
    if (error) throw error;
    return response.status(200).json({ ok: true, message: "자리 오류 신고가 관리자에게 등록되었습니다." });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ ok: false, message: errorMessage(error) });
  }
}
