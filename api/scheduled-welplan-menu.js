
import {
  koreanCompactDate,
  saveMenu,
} from "./_welplan-menu.js";
import { isCronRequest } from "./_auth.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    return response.status(405).json({
      ok: false,
      message: "GET 요청만 허용됩니다.",
    });
  }

  if (!isCronRequest(request)) {
    return response.status(401).json({ ok: false, message: "유효하지 않은 예약 요청입니다." });
  }

  try {
    const result = await saveMenu(koreanCompactDate());

    return response.status(200).json({
      ok: true,
      message: "10층·20층 예약 메뉴 수집이 완료되었습니다.",
      result,
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}
