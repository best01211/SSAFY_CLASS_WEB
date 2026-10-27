import assert from "node:assert/strict";
import { test } from "node:test";
import { requestMenuJson } from "../api/_menu-request.js";

test("suspended menu service returns actionable error instead of JSON parse failure", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(
    "<h1>서비스 이용이 일시 중단되었습니다.</h1><p>제공을 중단했습니다.</p>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  ));
  await assert.rejects(requestMenuJson("https://menu.example"), /서비스가 제공을 중단.*수동 등록/);
});

test("unexpected HTML is rejected while JSON menus remain supported", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("<h1>Maintenance</h1>", {
    headers: { "Content-Type": "text/html" },
  }));
  await assert.rejects(requestMenuJson("https://menu.example"), /웹페이지/);
  t.mock.method(globalThis, "fetch", async () => Response.json({ meals: [] }));
  assert.deepEqual(await requestMenuJson("https://menu.example"), { meals: [] });
});
