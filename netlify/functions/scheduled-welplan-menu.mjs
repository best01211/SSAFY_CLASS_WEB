
import {
  koreanCompactDate,
  saveMenu,
} from "./_welplan-menu.mjs";

export default async () => {
  const compactDate = koreanCompactDate();
  const result = await saveMenu(compactDate);
  console.log("Scheduled Welplan menu saved:", result);
};

export const config = {
  // 한국시간 평일 오전 7시 10분
  schedule: "10 22 * * 0-4",
};
