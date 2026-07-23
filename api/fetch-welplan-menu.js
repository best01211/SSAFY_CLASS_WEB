
import { koreanCompactDate, saveMenu } from "./_welplan-menu.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      ok: false,
      message: "GET 요청만 허용됩니다.",
    });
  }

  try {
    const requestedDate = request.query?.date;
    const compactDate =
      typeof requestedDate === "string" && /^\d{8}$/.test(requestedDate)
        ? requestedDate
        : koreanCompactDate();

    const result = await saveMenu(compactDate);

    return response.status(200).json({
      ok: true,
      message: "Welplan 20층 점심 메뉴를 저장했습니다.",
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
