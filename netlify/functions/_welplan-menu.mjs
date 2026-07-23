
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const RESTAURANT_ID = "REST000133";
const SOURCE_BASE = "https://welplan.pmh.codes";

function getKoreanDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}`;
}

function toDatabaseDate(compactDate) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "");
}

function looksLikeLunch(value) {
  const text = cleanText(value).toLowerCase();
  return text.includes("점심") || text.includes("lunch") || text === "2";
}

function getStringFields(object) {
  return Object.entries(object ?? {})
    .filter(([, value]) => typeof value === "string")
    .map(([key, value]) => ({ key: key.toLowerCase(), value: cleanText(value) }));
}

function extractMenuFromObjectTree(root) {
  const results = [];
  const visited = new Set();

  function walk(value, inheritedRestaurant = false, inheritedLunch = false) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, inheritedRestaurant, inheritedLunch));
      return;
    }

    const fields = getStringFields(value);
    const serialized = fields.map(({ value }) => value).join(" ");
    const hasRestaurant =
      inheritedRestaurant ||
      serialized.includes(RESTAURANT_ID) ||
      fields.some(({ key, value }) =>
        (key.includes("restaurant") || key.includes("store") || key.includes("place")) &&
        value.includes(RESTAURANT_ID)
      );

    const hasLunch =
      inheritedLunch ||
      fields.some(({ key, value }) =>
        key.includes("meal") || key.includes("time") || key.includes("course")
          ? looksLikeLunch(value)
          : false
      ) ||
      serialized.includes("점심");

    if (hasRestaurant && hasLunch) {
      const menuCandidates = fields
        .filter(({ key, value }) => {
          if (value.length < 2 || value.length > 250) return false;
          if (value === RESTAURANT_ID) return false;
          return (
            key.includes("menu") ||
            key.includes("dish") ||
            key.includes("food") ||
            key.includes("name") ||
            key.includes("title") ||
            key.includes("corner")
          );
        })
        .map(({ value }) => value)
        .filter((value) => !value.includes("REST"));

      if (menuCandidates.length) {
        results.push(menuCandidates.join(" · "));
      }
    }

    Object.values(value).forEach((child) => walk(child, hasRestaurant, hasLunch));
  }

  walk(root);

  return [...new Set(results)]
    .map(cleanText)
    .filter(Boolean)
    .filter((value) => value.length >= 2);
}

function parseJsonScripts($) {
  const roots = [];

  $("script").each((_, element) => {
    const type = ($(element).attr("type") || "").toLowerCase();
    const id = ($(element).attr("id") || "").toLowerCase();
    const text = $(element).html()?.trim();

    if (!text) return;
    if (!type.includes("json") && id !== "__next_data__" && !text.startsWith("{") && !text.startsWith("[")) return;

    try {
      roots.push(JSON.parse(text));
    } catch {
      // JSON이 아닌 스크립트는 무시
    }
  });

  return roots;
}

function extractFromVisibleHtml($) {
  const candidates = [];

  $("tr, article, li, section, div").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || text.length < 4 || text.length > 500) return;

    const html = $(element).html() || "";
    const containsRestaurant =
      text.includes(RESTAURANT_ID) ||
      html.includes(RESTAURANT_ID) ||
      $(element).find(`[href*="${RESTAURANT_ID}"], [data-restaurant*="${RESTAURANT_ID}"]`).length > 0;

    if (!containsRestaurant) return;
    if (!text.includes("점심") && !html.toLowerCase().includes("lunch")) return;

    candidates.push(text);
  });

  return [...new Set(candidates)];
}

function extractFallbackLunchText($) {
  const bodyText = cleanText($("body").text());
  const lunchIndex = bodyText.indexOf("점심");
  if (lunchIndex === -1) return [];

  const excerpt = bodyText.slice(lunchIndex, lunchIndex + 1800);
  return [excerpt];
}

function parseWelplanHtml(html) {
  const $ = cheerio.load(html);

  const jsonMenus = parseJsonScripts($).flatMap(extractMenuFromObjectTree);
  if (jsonMenus.length) {
    return {
      menus: jsonMenus.slice(0, 20),
      strategy: "embedded-json",
    };
  }

  const htmlMenus = extractFromVisibleHtml($);
  if (htmlMenus.length) {
    return {
      menus: htmlMenus.slice(0, 20),
      strategy: "restaurant-html",
    };
  }

  const fallback = extractFallbackLunchText($);
  return {
    menus: fallback,
    strategy: "lunch-text-fallback",
  };
}

async function fetchAndSaveMenu(compactDate) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Netlify 환경 변수 SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  }

  const sourceUrl = `${SOURCE_BASE}/takein/${compactDate}/all?restaurant=${RESTAURANT_ID}`;
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 SSAFY-Class-MenuBot/1.0",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Welplan 요청 실패: HTTP ${response.status}`);
  }

  const html = await response.text();
  const parsed = parseWelplanHtml(html);
  const databaseDate = toDatabaseDate(compactDate);
  const menuText = parsed.menus.join("\n");

  if (!menuText || menuText.length < 3) {
    throw new Error("20층 점심 메뉴를 추출하지 못했습니다. Welplan 화면 구조를 확인해야 합니다.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("daily_menus")
    .upsert(
      {
        menu_date: databaseDate,
        menu_20: menuText,
        menu_20_source: `welplan:${parsed.strategy}`,
        menu_20_source_url: sourceUrl,
        menu_20_fetched_at: new Date().toISOString(),
        menu_20_fetch_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "menu_date" }
    );

  if (error) throw error;

  return {
    date: databaseDate,
    sourceUrl,
    strategy: parsed.strategy,
    menus: parsed.menus,
  };
}

export { fetchAndSaveMenu, getKoreanDateString };
