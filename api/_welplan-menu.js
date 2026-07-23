
import { createClient } from "@supabase/supabase-js";

const WELPLAN_BASE = "https://welplan.pmh.codes";
const RESTAURANT_ID = "REST000133";
const RESTAURANT = {
  id: RESTAURANT_ID,
  name: "20층 식당",
  vendor: "shinsegae",
};

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

function restaurantCookie() {
  return encodeURIComponent(JSON.stringify([RESTAURANT]));
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function findMenusArrays(root) {
  const found = [];
  const visited = new Set();

  function walk(value) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (Array.isArray(value.menus)) {
      found.push(value.menus);
    }

    Object.values(value).forEach(walk);
  }

  walk(root);
  return found;
}

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
        values.push(firstString(item, [
          "name", "menuName", "foodName", "title", "displayName"
        ]));
      }
    }
  }
  return unique(values);
}

function menuTitle(menu) {
  return firstString(menu, [
    "name", "menuName", "title", "mainMenuName", "displayName"
  ]);
}

function mealTimeText(menu) {
  return clean(
    menu?.mealTimeName ??
    menu?.mealTime?.name ??
    menu?.mealType ??
    menu?.timeName ??
    ""
  );
}

function isLunchMenu(menu) {
  const text = mealTimeText(menu).toLowerCase();
  if (text.includes("점심") || text.includes("lunch")) return true;

  const mealTimeId = String(
    menu?.mealTimeId ??
    menu?.mealTime?.id ??
    menu?.timeId ??
    ""
  );
  return mealTimeId === "2";
}


function findImageUrl(value, visited = new Set()) {
  if (!value) return "";

  if (typeof value === "string") {
    const text = clean(value);
    if (/^https?:\/\//i.test(text) &&
        /\.(png|jpe?g|webp|gif)(\?|$)/i.test(text)) {
      return text;
    }
    return "";
  }

  if (typeof value !== "object" || visited.has(value)) return "";
  visited.add(value);

  const preferredKeys = [
    "imageUrl", "imageURL", "image", "photoUrl",
    "photoURL", "thumbnailUrl", "thumbnailURL", "pictureUrl"
  ];

  for (const key of preferredKeys) {
    const candidate = value?.[key];
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  for (const child of Object.values(value)) {
    const found = findImageUrl(child, visited);
    if (found) return found;
  }

  return "";
}

function normalizeMenu(menu) {
  const title = menuTitle(menu);
  if (!title) return null;
  const sides = componentNames(menu).filter((name) => name !== title);
  return { title, sides, imageUrl: findImageUrl(menu) || null };
}

function uniqueMenuObjects(menus) {
  const map = new Map();
  for (const menu of menus) {
    const key = `${menu.title}|${menu.sides.join("|")}|${menu.imageUrl ?? ""}`;
    if (!map.has(key)) map.set(key, menu);
  }
  return [...map.values()];
}

function extractMenus(payload) {
  const allMenus = findMenusArrays(payload).flat();

  const normalizedAll = allMenus
    .map(normalizeMenu)
    .filter(Boolean);

  const lunchOnly = allMenus
    .filter(isLunchMenu)
    .map(normalizeMenu)
    .filter(Boolean);

  return uniqueMenuObjects(lunchOnly.length ? lunchOnly : normalizedAll);
}

function formatMenus(menus) {
  return menus.map((menu) => {
    if (!menu.sides.length) return menu.title;
    return `${menu.title}\n${menu.sides.join(" · ")}`;
  }).join("\n\n");
}

async function requestWelplanApi(compactDate) {
  const cookie = `welplan_restaurants=${restaurantCookie()}`;
  const urls = [
    `${WELPLAN_BASE}/api/menu/live?kind=takein&date=${compactDate}&time=2`,
    `${WELPLAN_BASE}/api/menu/live?kind=takein&date=${compactDate}&time=all`,
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Cookie: cookie,
          "User-Agent": "SSAFY-Class-Menu/3.0",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Welplan API HTTP ${response.status}`);
      }

      const payload = await response.json();
      const menus = extractMenus(payload);

      if (menus.length) return { menus, apiUrl: url };
      lastError = new Error("Welplan API 응답에서 메뉴를 찾지 못했습니다.");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Welplan 메뉴 요청에 실패했습니다.");
}

export async function saveMenu(compactDate) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Vercel 환경 변수 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
    );
  }

  const result = await requestWelplanApi(compactDate);
  const menuText = formatMenus(result.menus);
  const date = databaseDate(compactDate);
  const pageUrl =
    `${WELPLAN_BASE}/takein/${compactDate}/all?restaurant=${RESTAURANT_ID}`;

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("daily_menus")
    .upsert({
      menu_date: date,
      menu_20: menuText,
      menu_20_items: result.menus,
      menu_20_source: "welplan-live-api",
      menu_20_source_url: pageUrl,
      menu_20_fetched_at: new Date().toISOString(),
      menu_20_fetch_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "menu_date" });

  if (error) throw error;

  return {
    date,
    menuText,
    menus: result.menus,
    sourceUrl: pageUrl,
    apiUrl: result.apiUrl,
  };
}
