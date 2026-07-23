
import { createClient } from "@supabase/supabase-js";

const WELPLAN_BASE = "https://welplan.pmh.codes";
const RESTAURANT_ID = "REST000133";

/*
  Welplan은 URL의 restaurant 쿼리만으로 식당을 확정하지 않고
  welplan_restaurants 쿠키의 식당 목록을 읽습니다.
  REST 계열 식당은 신세계푸드 공급자로 조회합니다.
*/
const RESTAURANT = {
  id: RESTAURANT_ID,
  name: "20층 식당",
  vendor: "shinsegae",
};

function koreanCompactDate(date = new Date()) {
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
    if (typeof value === "string" && clean(value)) {
      return clean(value);
    }
  }
  return "";
}

function componentNames(menu) {
  const possibleArrays = [
    menu?.components,
    menu?.menuComponents,
    menu?.foods,
    menu?.items,
    menu?.sideMenus,
    menu?.subMenus,
  ].filter(Array.isArray);

  const values = [];

  for (const items of possibleArrays) {
    for (const item of items) {
      if (typeof item === "string") {
        values.push(item);
        continue;
      }

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

  // 신세계 전체 메뉴 응답에서 점심 식별값이 보통 2로 매핑됨
  return mealTimeId === "2";
}

function normalizeMenu(menu) {
  const title = menuTitle(menu);
  if (!title) return null;

  const sides = componentNames(menu).filter((name) => name !== title);

  return {
    title,
    sides,
  };
}

function extractMenus(payload) {
  const menuArrays = findMenusArrays(payload);
  const allMenus = menuArrays.flat();

  const normalizedAll = allMenus
    .map(normalizeMenu)
    .filter(Boolean);

  const lunchOnly = allMenus
    .filter(isLunchMenu)
    .map(normalizeMenu)
    .filter(Boolean);

  // API가 이미 time=2로 필터링되었거나 mealTime 필드가 없을 수 있음
  return uniqueMenuObjects(lunchOnly.length ? lunchOnly : normalizedAll);
}

function uniqueMenuObjects(menus) {
  const map = new Map();

  for (const menu of menus) {
    const key = `${menu.title}|${menu.sides.join("|")}`;
    if (!map.has(key)) map.set(key, menu);
  }

  return [...map.values()];
}

function formatMenus(menus) {
  return menus
    .map((menu) => {
      if (!menu.sides.length) return menu.title;
      return `${menu.title}\n${menu.sides.join(" · ")}`;
    })
    .join("\n\n");
}

async function requestWelplanApi(compactDate) {
  const cookie = `welplan_restaurants=${restaurantCookie()}`;

  /*
    time=2는 점심입니다.
    해당 식당이 전체 메뉴만 지원하는 경우를 대비해 time=all도 재시도합니다.
  */
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
          "User-Agent": "SSAFY-Class-Menu/2.0",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Welplan API HTTP ${response.status}`);
      }

      const payload = await response.json();
      const menus = extractMenus(payload);

      if (menus.length) {
        return {
          menus,
          apiUrl: url,
          rawRestaurant: payload?.restaurants ?? [],
        };
      }

      lastError = new Error("Welplan API 응답에서 메뉴를 찾지 못했습니다.");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Welplan 메뉴 요청에 실패했습니다.");
}

async function saveMenu(compactDate) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Netlify 환경 변수 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다."
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
    .upsert(
      {
        menu_date: date,
        menu_20: menuText,
        menu_20_source: "welplan-live-api",
        menu_20_source_url: pageUrl,
        menu_20_fetched_at: new Date().toISOString(),
        menu_20_fetch_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "menu_date" }
    );

  if (error) throw error;

  return {
    date,
    menuText,
    menus: result.menus,
    sourceUrl: pageUrl,
    apiUrl: result.apiUrl,
  };
}

export {
  koreanCompactDate,
  requestWelplanApi,
  saveMenu,
};
