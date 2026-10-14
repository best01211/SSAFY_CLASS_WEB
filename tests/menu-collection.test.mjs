import assert from "node:assert/strict";
import { test } from "node:test";
import { requestMenuJson } from "../api/_menu-request.js";
import { saveMenu } from "../api/_welplan-menu.js";

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
