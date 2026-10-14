import assert from "node:assert/strict";
import { test } from "node:test";
import { requestMenuJson } from "../api/_menu-request.js";
import { saveMenu, requestTwentyFloorMenu, extractTwentyFloorMenus } from "../api/_welplan-menu.js";

function welplanPayload() {
  return {
    restaurant: { id: "REST000133", name: "멀티캠퍼스", vendor: "welstory" },
    date: "20261014",
    meals: [
      { id: "1", type: "breakfast", menus: [{ name: "아침 메뉴" }] },
      { id: "2", type: "lunch", menus: [
        { name: "돼지고기사태김치찜", components: [
          { name: "돼지고기사태김치찜", isMain: true },
          { name: "차조밥" }, { name: "수제비국" },
        ], imageUrl: "https://images.example/lunch.png", isTakeOut: false },
        { name: "키친보스봉골레파스타", components: [{ name: "마늘토스트" }] },
        { name: "포장 메뉴", isTakeOut: true },
      ] },
      { id: "3", type: "dinner", menus: [{ name: "저녁 메뉴" }] },
    ],
  };
}

test("documented MCP request uses Welstory and handles structured and text results", async (t) => {
  for (const format of ["structuredContent", "content"]) {
    await t.test(format, async (t) => {
      t.mock.method(globalThis, "fetch", async (url, options) => {
        assert.equal(url, "https://welplan.pmh.codes/mcp");
        assert.equal(options.method, "POST");
        assert.equal(options.headers.Accept, "application/json, text/event-stream");
        assert.equal(options.headers.Cookie, undefined);
        const body = JSON.parse(options.body);
        assert.equal(body.method, "tools/call");
        assert.equal(body.params.name, "get_restaurant_menu");
        assert.deepEqual(body.params.arguments, { vendor: "welstory", restaurantId: "REST000133", date: "20261014" });
        const result = format === "structuredContent"
          ? { structuredContent: welplanPayload() }
          : { content: [{ type: "text", text: JSON.stringify(welplanPayload()) }] };
        return Response.json({ jsonrpc: "2.0", id: 1, result });
      });
      const result = await requestTwentyFloorMenu("20261014");
      assert.deepEqual(result.menus.map(menu => menu.title), ["돼지고기사태김치찜", "키친보스봉골레파스타"]);
      assert.deepEqual(result.menus[0].sides, ["차조밥", "수제비국"]);
      assert.equal(result.menus[0].imageUrl, "https://images.example/lunch.png");
      assert.match(result.sourceUrl, /restaurants\/welstory\/REST000133\//);
    });
  }
});

test("missing lunch never substitutes breakfast; wrong restaurant or date is rejected", () => {
  const payload = welplanPayload();
  payload.meals = payload.meals.filter(meal => meal.type !== "lunch");
  assert.deepEqual(extractTwentyFloorMenus(payload, "20261014"), []);
  assert.throws(() => extractTwentyFloorMenus(payload, "20261015"), /날짜/);
  payload.restaurant.vendor = "shinsegae";
  assert.throws(() => extractTwentyFloorMenus(payload, "20261014"), /식당 정보/);
});

test("MCP errors surface instead of being mistaken for menus", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({
    jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "upstream unavailable" }] },
  }));
  await assert.rejects(requestTwentyFloorMenu("20261014"), /upstream unavailable/);
});

test("menu timeout covers both an unresponsive server and a stalled JSON body", async (t) => {
  for (const stage of ["headers", "body"]) {
    await t.test(stage, async (t) => {
      let signal;
      t.mock.method(globalThis, "fetch", async (_url, options) => {
        signal = options.signal;
        if (stage === "headers") return new Promise(() => {});
        return { ok: true, json: () => new Promise(() => {}) };
      });
      await assert.rejects(requestMenuJson("https://menu.example", {}, 10), /시간 초과/);
      assert.equal(signal.aborted, true);
    });
  }
});

test("20th floor failure still saves the available 10th floor menu", async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://database.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
  let saved;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).includes("raw.githubusercontent.com")) {
      return Response.json({ date: "2026-10-14", meals: [{ courseName: "도시락", items: ["카레", "백미밥"] }] });
    }
    if (String(url).includes("welplan.pmh.codes")) throw new Error("메뉴 원본 요청 시간 초과 (5초)");
    assert.ok(String(url).startsWith("https://database.example/rest/v1/daily_menus"));
    saved = JSON.parse(options.body);
    return new Response(null, { status: 201 });
  });
  const result = await saveMenu("20261014");
  assert.equal(saved.menu_date, "2026-10-14");
  assert.equal(saved.menu_10, "도시락\n카레 · 백미밥");
  assert.equal(Object.hasOwn(saved, "menu_20"), false);
  assert.match(saved.menu_20_fetch_error, /시간 초과/);
  assert.equal(result.menu10, saved.menu_10);
  assert.equal(result.menu20, null);
  assert.equal(result.warnings.length, 1);
});
