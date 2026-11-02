/** Browser test of the Gemini connection with a simulated Gemini (no real key needed).
 *  node scenarios/run-gemini-browser-test.js  -> scenarios/results/gemini-tests/ */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const OUT = path.join(__dirname, "results", "gemini-tests"); fs.mkdirSync(OUT, { recursive: true });
const FILE = "file://" + path.join(__dirname, "..", "dist", "NASH-Dhabha-voice-app.html");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const res = []; const check = (name, ok, detail) => { res.push({ name, ok: !!ok, detail: String(detail || "").slice(0, 200) }); console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${ok ? "" : " — " + detail}`); };
  let mode = "good", calls = 0;
  await p.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const url = route.request().url();
    if (/\/models\?/.test(url)) return route.fulfill({ json: { models: [{ name: "models/gemini-2.5-flash" }, { name: "models/gemini-2.0-flash" }] } });
    calls++;
    const ans = mode === "good" ? { reply: "For dry non-veg, our Chicken 65 (₹260) is the crowd favourite, crispy and fiery. Prefer smoky? Try the Tandoori Chicken (Half).", dish_ids: ["chicken-65", "tandoori-chicken-half"], offer_id: "chicken-65" }
      : { reply: "Try our Chicken Lollipop for ₹199!", dish_ids: ["chicken-lollipop"], offer_id: null };
    return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(ans) }] } }] } });
  });
  await p.goto(FILE); await p.waitForFunction(() => window.__nash && document.querySelectorAll("#msgs .msg.bot").length);
  check("starts without AI", /runs in your browser/.test(await p.textContent("#conn-label")), await p.textContent("#conn-label"));
  await p.click("#ai-btn"); await p.fill("#ai-key", "AIzaTEST-not-a-real-key"); await p.click("#ai-save"); await p.waitForTimeout(600);
  check("AI settings: key accepted", /Connected/.test(await p.textContent("#ai-status")), await p.textContent("#ai-status"));
  await p.screenshot({ path: path.join(OUT, "ai-settings.png") });
  await p.waitForTimeout(1200);
  check("label shows Gemini", /Gemini \+ our menu/.test(await p.textContent("#conn-label")), await p.textContent("#conn-label"));
  const ask = async (t) => { const n = await p.$$eval("#msgs .msg.bot", (a) => a.length); await p.fill("#chat-text", t); await p.press("#chat-text", "Enter"); await p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k && !document.querySelector(".typing"), n, { timeout: 15000 }); await p.waitForTimeout(400); return p.$$eval("#msgs .msg.bot:not(.typing)", (a, k) => a.slice(k).map((x) => x.innerText).join("\n"), n); };
  let o = await ask("hello i am mailesh");
  check("name turn stays rule-based (no Gemini call)", calls === 0 && /Mailesh/.test(o), `calls=${calls} ${o}`);
  o = await ask("dry non veg");
  check("menu question answered by Gemini", calls === 1 && /crowd favourite/.test(o) && /Gemini · grounded in our menu/.test(o), o);
  check("Gemini answer shows dish cards + add offer", /Chicken 65/.test(o) && /Can I add/.test(o), o);
  await p.locator("#chat").screenshot({ path: path.join(OUT, "gemini-answer.png") });
  o = await ask("yes add it");
  check("adding to cart still works after a Gemini answer", /Chicken 65.*in your cart/s.test(o), o);
  mode = "bad";
  o = await ask("dry non veg");
  check("invented dish/price is rejected; built-in answer shown", !/Lollipop/.test(o) && /Chicken 65/.test(o) && !/Gemini ·/.test(o), o);
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ ranAt: new Date().toISOString(), note: "Gemini simulated in the browser (no real key); real-key tests run separately.", passed: res.filter((r) => r.ok).length, total: res.length, checks: res }, null, 2));
  console.log(`Gemini browser tests: ${res.filter((r) => r.ok).length}/${res.length}`);
  await b.close();
})();
