
import { fetchAndSaveMenu, getKoreanDateString } from "./_welplan-menu.mjs";

export default async (request) => {
  try {
    const url = new URL(request.url);
    const requestedDate = url.searchParams.get("date");
    const compactDate =
      requestedDate && /^\d{8}$/.test(requestedDate)
        ? requestedDate
        : getKoreanDateString();

    const result = await fetchAndSaveMenu(compactDate);

    return Response.json({
      ok: true,
      message: "20층 메뉴를 가져와 Supabase에 저장했습니다.",
      result,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
};

export const config = {
  path: "/api/fetch-welplan-menu",
};
