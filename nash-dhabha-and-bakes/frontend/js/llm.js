/*!
 * Masala Mitra: Google Gemini answer writer (the "G" in RAG).
 * The engine retrieves the relevant dishes and house info; Gemini writes the waiter's
 * reply from ONLY that context; the engine then checks the answer (llmApply) before use.
 * Runs in Node 18+ (backend) and in the browser (bring-your-own key).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NashLLM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_MODEL = "gemini-2.5-flash";
  const SYSTEM = [
    "You are Masala Mitra, the friendly table-side waiter at NASH Dhabha & Bakes, an Indian highway dhaba with a bakery counter.",
    "Answer the customer like an experienced waiter: warm, short (1 to 3 sentences), helpful, and specific.",
    "STRICT RULES:",
    "1. Use ONLY the dishes in MENU CONTEXT and the facts in HOUSE INFO. Never invent dishes, prices, ingredients, offers, timings or policies.",
    "2. If the customer asks for something not in the context (for example pizza, noodles, delivery), say politely that we don't have it and suggest the closest real dishes from the context.",
    "3. Respect constraints exactly: veg vs non-veg (egg counts as non-veg), vegan, dry vs gravy, spice level, price limits, hot vs cold.",
    "4. Customers write Indian English, Hinglish, Tamil-English, typos and chat-speak (u, hv, spl, plz). Understand them, and reply in clear simple English. A little Hinglish warmth is fine.",
    "5. Recommend at most 4 dishes. Put their ids in dish_ids, best first. Mention prices only as given (₹).",
    "6. If one dish is the natural suggestion, set offer_id to its id so the app can ask \"Can I add it?\". Otherwise null.",
    "7. Never claim to add to the cart, place orders or take payment yourself. The app does that.",
    "8. The DRAFT is the app's rule-based answer. Keep it if it is right; improve it if it misunderstood the customer.",
    "9. Reply in the customer's language (see CUSTOMER language: English, Hindi or Tamil). Keep dish names as they are on the menu.",
    "10. Never guess about ingredients, allergens, prices or order status. If the context doesn't answer it, say you'll ask a staff member.",
    "Return JSON only, matching the schema."
  ].join("\n");

  const SCHEMA = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING", description: "What the waiter says, 1-3 sentences" },
      dish_ids: { type: "ARRAY", items: { type: "STRING" }, description: "ids of dishes to show as cards, best first, max 4" },
      offer_id: { type: "STRING", nullable: true, description: "id of the one dish to offer adding, or null" }
    },
    required: ["reply", "dish_ids"]
  };

  function compactDish(d) {
    const tags = [d.veg ? (d.vegan ? "vegan" : "veg") : "non-veg", d.egg ? "contains egg" : "", d.spice, d.texture, d.main, d.served ? "served " + d.served : "", d.portion || "", d.bestseller ? "bestseller" : "", d.south_indian ? "south indian" : "", d.tandoori ? "tandoori" : "", d.mildly_sweet_gravy ? "mildly sweet gravy" : ""].filter(Boolean).join(", ");
    return `- [${d.id}] ${d.name} | ${d.category} | ₹${d.price} | ${tags} | "${d.description}" | goes with: ${d.goes_with.join(", ")}`;
  }

  function buildRequest(ctx, history) {
    const c = ctx.customer;
    const block = [
      `CUSTOMER: language=${c.language || "English"}; allergy=${c.allergy || "none stated"}; name=${c.name || "unknown"}; diet preference=${c.diet_preference || "none"}; cart=${c.cart.length ? c.cart.join(", ") : "empty"}; active order=${c.active_order ? c.active_order.no + " (" + c.active_order.stage + ")" : "none"}`,
      `MENU SECTIONS: ${ctx.categories.join(", ")}`,
      "HOUSE INFO:", ...ctx.info.map((i) => `- ${i.title}: ${i.text}`),
      "MENU CONTEXT (retrieved for this question; the only dishes you may mention):", ...ctx.items.map(compactDish),
      `DRAFT (rule-based): "${ctx.draft.reply}" dishes=${JSON.stringify(ctx.draft.dish_ids)}`,
      `CUSTOMER MESSAGE: "${ctx.message}"`
    ].join("\n");
    const contents = (history || []).slice(-6).map((h) => ({ role: h.role === "user" ? "user" : "model", parts: [{ text: String(h.text || "").slice(0, 400) }] }));
    contents.push({ role: "user", parts: [{ text: block }] });
    // Gemini needs the conversation to start with a user turn
    while (contents.length && contents[0].role !== "user") contents.shift();
    return {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 500, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } }
    };
  }

  async function ask(opts) {
    const { key, ctx, history } = opts;
    const model = opts.model || DEFAULT_MODEL;
    const f = opts.fetch || (typeof fetch !== "undefined" ? fetch : null);
    if (!key || !f) throw new Error("NO_KEY");
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), opts.timeoutMs || 9000) : null;
    try {
      let body = buildRequest(ctx, history);
      if (!/2\.5/.test(model)) { body = JSON.parse(JSON.stringify(body)); delete body.generationConfig.thinkingConfig; }
      const res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const e = new Error((data.error && data.error.message) || "Gemini error " + res.status); e.status = res.status; throw e; }
      const txt = (((data.candidates || [])[0] || {}).content || {}).parts ? data.candidates[0].content.parts.map((p) => p.text || "").join("") : "";
      const parsed = JSON.parse(txt.replace(/^```json\s*|```$/g, ""));
      return { reply: String(parsed.reply || ""), dish_ids: Array.isArray(parsed.dish_ids) ? parsed.dish_ids.map(String) : [], offer_id: parsed.offer_id ? String(parsed.offer_id) : null, model };
    } finally { if (timer) clearTimeout(timer); }
  }

  /** Quick key check: lists models with this key. */
  async function testKey(key, fetchImpl) {
    const f = fetchImpl || fetch;
    const res = await f("https://generativelanguage.googleapis.com/v1beta/models?pageSize=50", { headers: { "x-goog-api-key": key } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || "Key check failed (" + res.status + ")");
    return (data.models || []).map((m) => m.name.replace("models/", "")).filter((n) => /gemini/.test(n));
  }

  return { ask, testKey, buildRequest, SYSTEM, DEFAULT_MODEL };
});
