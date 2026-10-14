
import { createClient } from "@supabase/supabase-js";
import { requestMenuJson } from "./_menu-request.js";

const WELPLAN_BASE = "https://welplan.pmh.codes";
const RESTAURANT_ID = "REST000133";
const RESTAURANT = {
  id: RESTAURANT_ID,
  name: "멀티캠퍼스",
  vendor: "welstory",
};

const TEN_FLOOR_RAW_BASE =
  "https://raw.githubusercontent.com/TJ-media/ssabap-today/main/data-10f";

export function koreanCompactDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}${values.month}${values.day}`;
}

function databaseDate(compactDate) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

/* ──────────────────────────────
   10층 GitHub JSON
────────────────────────────── */

function validateTenFloorPayload(payload, expectedDate) {
  if (!payload || typeof payload !== "object") {
    throw new Error("10층 메뉴 JSON 형식이 올바르지 않습니다.");
  }

  if (payload.date && payload.date !== expectedDate) {
    throw new Error(
      `10층 메뉴 날짜가 다릅니다. 요청 ${expectedDate}, 응답 ${payload.date}`
    );
  }

  if (!Array.isArray(payload.meals)) {
    throw new Error("10층 메뉴 JSON에 meals 배열이 없습니다.");
  }
}

function normalizeTenFloorMeals(payload) {
  return payload.meals
    .map((meal) => {
      const courseName = clean(meal?.courseName || "메뉴");
      const items = Array.isArray(meal?.items)
        ? unique(meal.items)
        : [];

      const fallbackName = clean(meal?.name);
      const finalItems =
        items.length > 0
          ? items
          : fallbackName
            ? fallbackName.split(",").map(clean).filter(Boolean)
            : [];

      if (!finalItems.length) return null;

      return {
        courseName,
        items: finalItems,
      };
    })
    .filter(Boolean);
}

function formatTenFloorMenu(meals) {
  return meals
    .map((meal) => `${meal.courseName}\n${meal.items.join(" · ")}`)
    .join("\n\n");
}

async function requestTenFloorMenu(compactDate) {
  const date = databaseDate(compactDate);
  const sourceUrl = `${TEN_FLOOR_RAW_BASE}/${date}.json`;

  const payload = await requestMenuJson(sourceUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SSAFY-Class-Menu/4.0",
    },
    cache: "no-store",
  });

  validateTenFloorPayload(payload, date);

  const meals = normalizeTenFloorMeals(payload);
  if (!meals.length) {
    throw new Error("10층 메뉴 JSON에서 표시할 메뉴를 찾지 못했습니다.");
  }

  return {
    menuText: formatTenFloorMenu(meals),
    meals,
    sourceUrl,
    updatedAt: payload.updatedAt || null,
  };
}

/* ──────────────────────────────
   20층 Welplan API
────────────────────────────── */

function firstString(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === "string" && clean(value)) return clean(value);
  }
  return "";
}

function componentNames(menu) {
  const arrays = [
    menu?.components,
    menu?.menuComponents,
    menu?.foods,
    menu?.items,
    menu?.sideMenus,
    menu?.subMenus,
  ].filter(Array.isArray);

  const values = [];

  for (const items of arrays) {
    for (const item of items) {
      if (typeof item === "string") {
        values.push(item);
      } else {
        values.push(
          firstString(item, [
            "name",
            "menuName",
            "foodName",
            "title",
            "displayName",
          ])
        );
      }
    }
  }

  return unique(values);
}

function menuTitle(menu) {
  return firstString(menu, [
    "name",
    "menuName",
    "title",
    "mainMenuName",
    "displayName",
  ]);
}

function findImageUrl(value, visited = new Set()) {
  if (!value) return "";

  if (typeof value === "string") {
    const text = clean(value);

    if (
      /^https?:\/\//i.test(text) &&
      /\.(png|jpe?g|webp|gif)(\?|$)/i.test(text)
    ) {
      return text;
    }

    return "";
  }

  if (typeof value !== "object" || visited.has(value)) return "";
  visited.add(value);

  const preferredKeys = [
    "imageUrl",
    "imageURL",
    "image",
    "photoUrl",
    "photoURL",
    "thumbnailUrl",
    "thumbnailURL",
    "pictureUrl",
  ];

  for (const key of preferredKeys) {
    const candidate = value?.[key];

    if (
      typeof candidate === "string" &&
      /^https?:\/\//i.test(candidate)
    ) {
      return candidate;
    }
  }

  for (const child of Object.values(value)) {
    const found = findImageUrl(child, visited);
    if (found) return found;
  }

  return "";
}

function normalizeTwentyFloorMenu(menu) {
  const title = menuTitle(menu);
  if (!title) return null;

  const sides = componentNames(menu).filter(
    (name) => name !== title
  );

  return {
    title,
    sides,
    imageUrl: findImageUrl(menu) || null,
  };
}

function uniqueMenuObjects(menus) {
  const map = new Map();

  for (const menu of menus) {
    const key =
      `${menu.title}|${menu.sides.join("|")}|${menu.imageUrl ?? ""}`;

    if (!map.has(key)) {
      map.set(key, menu);
    }
  }

  return [...map.values()];
}

export function extractTwentyFloorMenus(payload, compactDate) {
  if (payload?.restaurant?.id !== RESTAURANT_ID ||
      payload?.restaurant?.vendor !== RESTAURANT.vendor) {
    throw new Error("Welplan API 응답의 식당 정보가 일치하지 않습니다.");
  }
  if (payload.date !== compactDate) {
    throw new Error("Welplan API 응답의 메뉴 날짜가 일치하지 않습니다.");
  }
  if (!Array.isArray(payload.meals)) {
    throw new Error("Welplan API 응답에 meals 배열이 없습니다.");
  }
  const lunchMenus = payload.meals
    .filter(meal => meal?.type === "lunch" || String(meal?.id) === "2")
    .flatMap(meal => Array.isArray(meal.menus) ? meal.menus : [])
    .filter(menu => menu?.isTakeOut !== true)
    .map(normalizeTwentyFloorMenu)
    .filter(Boolean);
  return uniqueMenuObjects(lunchMenus);
}

function formatTwentyFloorMenu(menus) {
  return menus
    .map((menu) => {
      if (!menu.sides.length) return menu.title;
      return `${menu.title}\n${menu.sides.join(" · ")}`;
    })
    .join("\n\n");
}

export async function requestTwentyFloorMenu(compactDate) {
  const apiUrl = WELPLAN_BASE + "/mcp";
  const rpc = await requestMenuJson(apiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "User-Agent": "SSAFY-Class-Menu/5.0",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_restaurant_menu",
        arguments: {
          vendor: RESTAURANT.vendor,
          restaurantId: RESTAURANT_ID,
          date: compactDate,
        },
      },
    }),
    cache: "no-store",
  });
  if (rpc.error || rpc.result?.isError) {
    const message = rpc.error?.message || rpc.result?.content
      ?.filter(item => item.type === "text").map(item => item.text).join(" ");
    throw new Error(message || "Welplan 메뉴 조회에 실패했습니다.");
  }
  let payload = rpc.result?.structuredContent;
  if (!payload) {
    const text = rpc.result?.content?.find(item => item.type === "text")?.text;
    if (!text) throw new Error("Welplan API 응답에 메뉴 데이터가 없습니다.");
    payload = JSON.parse(text);
  }
  const menus = extractTwentyFloorMenus(payload, compactDate);
  if (!menus.length) throw new Error("Welplan에 해당 날짜의 20층 점심 메뉴가 없습니다.");
  return {
    menus,
    menuText: formatTwentyFloorMenu(menus),
    apiUrl,
    sourceUrl: WELPLAN_BASE + "/restaurants/" + RESTAURANT.vendor + "/" +
      RESTAURANT_ID + "/" + encodeURIComponent(RESTAURANT.name) + "/" + compactDate,
  };
}

/* ──────────────────────────────
   통합 저장
────────────────────────────── */

export async function saveMenu(compactDate) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Vercel 환경 변수 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
    );
  }

  if (!/^\d{8}$/.test(compactDate)) {
    throw new Error("메뉴 날짜는 YYYYMMDD 형식이어야 합니다.");
  }

  const date = databaseDate(compactDate);

  /*
    한쪽 수집이 실패해도 다른 층 메뉴는 저장합니다.
    두 층 모두 실패한 경우에만 전체 요청을 실패 처리합니다.
  */
  const [tenResult, twentyResult] = await Promise.allSettled([
    requestTenFloorMenu(compactDate),
    requestTwentyFloorMenu(compactDate),
  ]);

  if (
    tenResult.status === "rejected" &&
    twentyResult.status === "rejected"
  ) {
    throw new Error(
      `10층: ${tenResult.reason?.message || tenResult.reason} / ` +
      `20층: ${twentyResult.reason?.message || twentyResult.reason}`
    );
  }

  const row = {
    menu_date: date,
    updated_at: new Date().toISOString(),
  };

  const warnings = [];

  if (tenResult.status === "fulfilled") {
    row.menu_10 = tenResult.value.menuText;
  } else {
    warnings.push(
      `10층 수집 실패: ${tenResult.reason?.message || tenResult.reason}`
    );
  }

  if (twentyResult.status === "fulfilled") {
    row.menu_20 = twentyResult.value.menuText;
    row.menu_20_items = twentyResult.value.menus;
    row.menu_20_source = "welplan-mcp-api";
    row.menu_20_source_url = twentyResult.value.sourceUrl;
    row.menu_20_fetched_at = new Date().toISOString();
    row.menu_20_fetch_error = null;
  } else {
    warnings.push(
      `20층 수집 실패: ${twentyResult.reason?.message || twentyResult.reason}`
    );
    row.menu_20_fetch_error =
      twentyResult.reason?.message || String(twentyResult.reason);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("daily_menus")
    .upsert(row, { onConflict: "menu_date" });

  if (error) throw error;

  return {
    date,
    menu10:
      tenResult.status === "fulfilled"
        ? tenResult.value.menuText
        : null,
    menu20:
      twentyResult.status === "fulfilled"
        ? twentyResult.value.menuText
        : null,
    menu10SourceUrl:
      tenResult.status === "fulfilled"
        ? tenResult.value.sourceUrl
        : null,
    menu20SourceUrl:
      twentyResult.status === "fulfilled"
        ? twentyResult.value.sourceUrl
        : null,
    warnings,
  };
}
