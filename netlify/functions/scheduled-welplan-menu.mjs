
import { createClient } from "@supabase/supabase-js";
import { fetchAndSaveMenu, getKoreanDateString } from "./_welplan-menu.mjs";

export default async () => {
  const compactDate = getKoreanDateString();

  try {
    const result = await fetchAndSaveMenu(compactDate);
    console.log("Welplan menu saved:", result);
  } catch (error) {
    console.error("Welplan scheduled fetch failed:", error);

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      const databaseDate = `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;

      await supabase.from("daily_menus").upsert(
        {
          menu_date: databaseDate,
          menu_20_fetch_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "menu_date" }
      );
    }

    throw error;
  }
};

export const config = {
  // 오전 7시 10분 KST = 전날 22시 10분 UTC
  schedule: "10 22 * * 0-4",
};
