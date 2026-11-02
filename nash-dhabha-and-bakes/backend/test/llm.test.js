/* Checks the Gemini layer with a simulated Gemini: good answers are used, invented dishes/prices are rejected. */
const test = require("node:test");
const assert = require("node:assert");
const E = require("../../shared/engine");
const L = require("../../shared/llm");

function fakeGemini(answer, capture) {
  return async (url, init) => {
    if (capture) capture.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }) };
  };
}
async function turn(text, answer, capture) {
  const S = E.createState();
  const rule = E.chat(S, text);
  const ctx = E.contextFor(S, text, rule);
  const ans = await L.ask({ key: "test-key", ctx, history: [], fetch: fakeGemini(answer, capture) });
  return { S, rule, ctx, out: E.llmApply(S, ans, ctx) };
}

test("menu questions are routed to the AI writer; cart/payment are not", () => {
  const S = E.createState();
  assert.ok(E.LLM_ROUTES.has(E.chat(S, "dry non veg").route));
  assert.ok(!E.LLM_ROUTES.has(E.chat(S, "add 2 butter naan").route));
  assert.ok(!E.LLM_ROUTES.has(E.chat(S, "hello i am mailesh").route));
});

test("request carries the retrieved menu, strict rules and the key header", async () => {
  const cap = [];
  await turn("dry non veg", { reply: "Try our Chicken 65 (₹260), crispy and spicy.", dish_ids: ["chicken-65"], offer_id: "chicken-65" }, cap);
  const body = JSON.stringify(cap[0].body);
  assert.match(cap[0].url, /gemini-2\.5-flash:generateContent/);
  assert.equal(cap[0].headers["x-goog-api-key"], "test-key");
  assert.match(body, /\[chicken-65\] Chicken 65/);
  assert.match(body, /Use ONLY the dishes in MENU CONTEXT/);
  assert.doesNotMatch(body, /\[butter-chicken\]/, "gravy should not be retrieved for 'dry non veg'");
});

test("a grounded answer is used, with cards and an add offer", async () => {
  const { out, S } = await turn("dry non veg", { reply: "For something dry, our Chicken 65 (₹260) is a favourite, or try the Mutton Seekh Kebab.", dish_ids: ["chicken-65", "mutton-seekh-kebab"], offer_id: "chicken-65" });
  assert.ok(out);
  assert.equal(out[0].items.length, 2);
  assert.match(out[1].text, /Can I add \*\*Chicken 65\*\*/);
  assert.equal(S.pending.list[0], "chicken-65");
});

test("an invented dish is rejected (falls back to the menu answer)", async () => {
  const { out } = await turn("dry non veg", { reply: "Try our Chicken Lollipop!", dish_ids: ["chicken-lollipop"], offer_id: null });
  assert.equal(out, null);
});

test("an invented price is rejected", async () => {
  const { out } = await turn("dry non veg", { reply: "Chicken 65 is just ₹199 today!", dish_ids: ["chicken-65"], offer_id: null });
  assert.equal(out, null);
});

test("a real dish that wasn't retrieved for this question is rejected", async () => {
  const { out } = await turn("dry non veg", { reply: "You'll love our Gajar Halwa.", dish_ids: [], offer_id: null });
  assert.equal(out, null);
});

test("Gemini errors surface so the app can fall back", async () => {
  const S = E.createState(); const rule = E.chat(S, "dry non veg"); const ctx = E.contextFor(S, "dry non veg", rule);
  await assert.rejects(L.ask({ key: "k", ctx, fetch: async () => ({ ok: false, status: 429, json: async () => ({ error: { message: "quota" } }) }) }), /quota/);
  await assert.rejects(L.ask({ key: "", ctx }), /NO_KEY/);
});
