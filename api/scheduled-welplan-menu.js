
import { koreanCompactDate, saveMenu } from "./_welplan-menu.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      ok: false,
      message: "GET 요청만 허용됩니다.",
    });
  }

  try {
    const result = await saveMenu(koreanCompactDate());

    return response.status(200).json({
      ok: true,
      message: "예약 메뉴 수집이 완료되었습니다.",
      result,
    });
  } catch (error) {
    console.error(error);
    return response.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
