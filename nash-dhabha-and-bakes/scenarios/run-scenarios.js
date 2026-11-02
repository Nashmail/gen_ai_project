/**
 * Runs 4 end-to-end scenarios through the real app (browser UI -> backend API),
 * checks every reply, and stores inputs, outputs, screenshots and the
 * server-side transcript under scenarios/results/.
 *
 * Usage: start the backend (npm start in backend/), then
 *   node scenarios/run-scenarios.js [baseUrl]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:4000";
const OUT = path.join(__dirname, "results", process.argv[3] || "latest");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Fake speech recognition so the voice pipeline (mic -> transcript -> chat) can run headless.
const FAKE_SPEECH = `
  window.__speech = [];
  class FakeSR { constructor(){ this.continuous=false; }
    start(){ const t = window.__speech.shift() || ""; setTimeout(()=>{ const r=[{transcript:t}]; r.isFinal=true; this.onresult && this.onresult({results:[r]}); if(!this.continuous) this.onend && this.onend(); }, 300); }
    stop(){ this.onend && this.onend(); } }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;`;

const SCENARIOS = [
  {
    id: 1, slug: "happy-path-english", title: "Happy path: English, typed, mood → cart → chef note → dine-in → UPI → 5 stars",
    steps: [
      { say: "hi", expect: [/may i know your name/i] },
      { say: "I am Ravi", expect: [/nice to meet you, \*?\*?ravi/i, /mood/i] },
      { say: "I'm feeling tired", expect: [/tired/i, /can i add/i] },
      { chip: "Yes, add it", expect: [/is in your cart/i] },
      { say: "add 2 butter naan and dal makhani", expect: [/2 × butter naan/i, /1 × dal makhani/i] },
      { note: { item: "butter-naan", text: "Extra butter, well done please" }, expectFlag: /extra butter/i },
      { checkout: { mode: "dine", table: "7" }, expect: [/order ndb-\d+ placed/i] },
      { waitFor: /how would you like to pay/i, expect: [/sent to the chef/i, /extra butter/i, /getting ready/i, /on its way to table 7/i, /here is your bill/i, /total/i] },
      { chip: "UPI", expect: [/payment of .* by upi received/i, /how was the food/i] },
      { chip: "★★★★★ Loved it", expect: [/5-star review/i] },
      { kitchen: true, expect: [/extra butter, well done please/i, /table 7/i] }
    ]
  },
  {
    id: 2, slug: "veg-typos-takeaway", title: "Veg customer with typos and vague requests, takeaway, cash, unhappy feedback",
    steps: [
      { say: "hello", expect: [/may i know your name/i] },
      { say: "my name is priya sharma", expect: [/priya sharma/i] },
      { say: "im stressed", expect: [/stressed/i] },
      { say: "veg", expect: [/veg picks/i], allVeg: true },
      { say: "no, show another", expect: [/can i add/i] },
      { say: "add briyani", expect: [/which .*biryani/i], expectNot: [/curd rice/i] },
      { say: "add 1 veg dum biryani", expect: [/1 × veg dum biryani/i] },
      { say: "add panner butter masala", expect: [/paneer butter masala/i] },
      { say: "remove veg dum biryani", expect: [/removed .*veg dum biryani/i] },
      { say: "show my cart", expect: [/paneer butter masala/i], expectNot: [/veg dum biryani/i] },
      { orderNote: "Jain preparation please, no onion or garlic" },
      { checkout: { mode: "take" }, expect: [/takeaway/i] },
      { waitFor: /how would you like to pay/i, expect: [/no onion or garlic/i, /packed at the counter/i] },
      { say: "cash", expect: [/by cash received/i] },
      { say: "the food was too salty and cold", expect: [/sorry/i] }
    ]
  },
  {
    id: 3, slug: "knowledge-and-edge-cases", title: "Knowledge questions (RAG) and edge cases",
    steps: [
      { say: "What are your timings?", expect: [/7:00 am to 11:30 pm/i] },
      { say: "do you have jain food?", expect: [/jain/i] },
      { say: "how much GST do you charge", expect: [/5% gst/i] },
      { say: "is the black forest cake eggless", expect: [/black forest/i, /eggless/i] },
      { say: "price of chicken 65", expect: [/chicken 65/i, /₹260/] },
      { say: "do you have pizza?", expect: [/couldn't find|not on our menu|don't have/i], note: "Pizza is not on the menu, so the bot should say so." },
      { say: "checkout", expect: [/cart is empty/i] },
      { say: "asdfghjkl", expect: [/couldn't find|didn't catch/i] },
      { say: "something spicy non veg", expect: [/spicy non-veg/i, /medium|hot/i], expectNot: [/mild\b/i], allNonVeg: true },
      { api: "emptyOrder", expect: [/EMPTY_CART/] }
    ]
  },
  {
    id: 4, slug: "hinglish-and-voice", title: "Hinglish input and voice (speech-to-text chat + recorded chef voice note)",
    steps: [
      { say: "namaste", expect: [/may i know your name/i] },
      { say: "mera naam Arjun hai", expect: [/arjun/i], expectNot: [/mera/i] },
      { say: "mood accha nahi hai", expect: [/sad|low|comfort/i] },
      { voice: "I am very happy today", expect: [/happy/i] },
      { say: "2 masala chai aur 1 veg puff", expect: [/2 × masala chai/i, /1 × veg puff/i] },
      { voiceNote: { item: "masala-chai", speech: "less sugar and extra ginger" }, expectFlag: /less sugar and extra ginger|voice note/i },
      { checkout: { mode: "dine", table: "3" }, expect: [/placed/i] },
      { waitFor: /how would you like to pay/i, expect: [/voice note/i] },
      { say: "bill ka payment UPI se karunga", expect: [/by upi received/i] },
      { say: "bahut badiya tha", expect: [/so happy you enjoyed/i], note: "Hindi for \"it was very good\": should count as positive." },
      { kitchen: true, expect: [/less sugar and extra ginger/i], audio: true }
    ]
  }
];

const botCount = (p) => p.$$eval("#msgs .msg.bot:not(.typing)", (a) => a.length);
async function collectSince(p, before) {
  return p.$$eval("#msgs .msg.bot:not(.typing)", (a, n) => a.slice(n).map((x) => ({ text: x.innerText.trim(), veg: x.querySelectorAll(".mark:not(.nv)").length, nonveg: x.querySelectorAll(".mark.nv").length })), before);
}
async function waitReply(p, before, timeout = 8000) {
  await p.waitForFunction((n) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > n && !document.querySelector("#msgs .typing"), before, { timeout });
  await p.waitForTimeout(300);
}

async function runScenario(browser, sc) {
  const dir = path.join(OUT, `scenario-${sc.id}-${sc.slug}`);
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ["microphone"] });
  await ctx.addInitScript(FAKE_SPEECH);
  const p = await ctx.newPage();
  const consoleErrors = [];
  p.on("pageerror", (e) => consoleErrors.push(e.message));
  p.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  await p.goto(BASE + "/#home");
  await p.waitForFunction(() => window.__nash && document.querySelectorAll("#msgs .msg.bot").length > 0, null, { timeout: 10000 });
  const mode = await p.evaluate(() => window.__nash.mode);
  const results = [];
  let shot = 0;
  const snap = async (name) => { shot++; const f = `${String(shot).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: path.join(dir, f) }); return f; };

  for (const [i, st] of sc.steps.entries()) {
    const r = { step: i + 1, input: null, kind: null, outputs: [], checks: [], status: "PASS", started: new Date().toISOString() };
    try {
      if (st.say || st.chip || st.voice) {
        r.kind = st.say ? "chat" : st.chip ? "quick-reply" : "voice";
        r.input = st.say || st.chip || st.voice;
        if (p.url().indexOf("#home") < 0) { await p.goto(BASE + "/#home"); await p.waitForTimeout(400); }
        const before = await botCount(p);
        if (st.say) { await p.fill("#chat-text", st.say); await p.press("#chat-text", "Enter"); }
        else if (st.chip) await p.locator(".chips .chip", { hasText: st.chip }).last().click();
        else { await p.evaluate((t) => window.__speech.push(t), st.voice); await p.click("#mic-btn"); }
        await waitReply(p, before);
        r.outputs = await collectSince(p, before);
        if (st.voice) {
          const bubble = await p.$$eval("#msgs .msg.me", (a) => a[a.length - 1].innerText);
          r.checks.push({ check: "user bubble is labelled as transcribed voice", ok: /voice/i.test(bubble) && bubble.includes(st.voice), detail: bubble });
        }
      } else if (st.note || st.voiceNote) {
        const n = st.note || st.voiceNote;
        r.kind = st.note ? "chef-note (typed)" : "chef-note (voice)";
        r.input = st.note ? `Chef note on ${n.item}: "${n.text}"` : `Voice chef note on ${n.item}: (spoken) "${n.speech}"`;
        await p.goto(BASE + "/#menu"); await p.waitForTimeout(400);
        await p.click(`[data-note="${n.item}"]`);
        if (st.note) await p.fill("#note-text", n.text);
        else {
          await p.evaluate((t) => window.__speech.push(t), n.speech);
          await p.click("#rec-btn"); await p.waitForTimeout(1800); await p.click("#rec-btn"); await p.waitForTimeout(700);
          r.checks.push({ check: "recorder produced an audio clip", ok: await p.isVisible("#rec-audio"), detail: await p.textContent("#rec-status") });
        }
        await p.click("#note-save"); await p.waitForTimeout(700);
        const flag = await p.textContent(`[data-flag="${n.item}"]`);
        r.outputs = [{ text: "Menu card note flag: " + flag.trim() }];
        r.checks.push({ check: "note shows on the dish card", ok: st.expectFlag.test(flag), detail: flag.trim() });
        r.screenshot = await snap("chef-note");
      } else if (st.orderNote) {
        r.kind = "order note"; r.input = `Whole-order chef note: "${st.orderNote}"`;
        await p.goto(BASE + "/#checkout"); await p.waitForTimeout(400);
        await p.click('[data-note="__order"]'); await p.fill("#note-text", st.orderNote); await p.click("#note-save"); await p.waitForTimeout(600);
        const t = await p.textContent("#co-body");
        r.outputs = [{ text: "Checkout shows: " + (t.match(/“[^”]+”/g) || []).join(" ") }];
        r.checks.push({ check: "order note visible at checkout", ok: t.includes(st.orderNote), detail: "" });
      } else if (st.checkout) {
        r.kind = "checkout + place order"; r.input = `Checkout: ${st.checkout.mode === "dine" ? "dine-in, table " + st.checkout.table : "takeaway"}`;
        await p.goto(BASE + "/#checkout"); await p.waitForTimeout(500);
        await p.check(`#mode-${st.checkout.mode}`, { force: true });
        if (st.checkout.table) await p.fill("#co-table", st.checkout.table);
        r.screenshot = await snap("checkout");
        const before = await botCount(p);
        await p.click("#place-btn");
        await p.waitForFunction(() => location.hash === "#home");
        await waitReply(p, before);
        r.outputs = await collectSince(p, before);
      } else if (st.waitFor) {
        r.kind = "order lifecycle (automatic)"; r.input = "(waiting for kitchen updates, bill and payment prompt)";
        const before = await botCount(p);
        const t0 = Date.now();
        await p.waitForFunction((src) => new RegExp(src, "i").test(document.querySelector("#msgs").innerText), st.waitFor.source, { timeout: 25000 });
        await p.waitForTimeout(500);
        r.outputs = await collectSince(p, before - 1);
        r.elapsedMs = Date.now() - t0;
        r.screenshot = await snap("bill");
      } else if (st.kitchen) {
        r.kind = "kitchen display"; r.input = "Open Kitchen page";
        await p.goto(BASE + "/#kitchen"); await p.waitForTimeout(1200);
        const t = await p.textContent("#kitchen-body");
        r.outputs = [{ text: t.replace(/\s+/g, " ").trim().slice(0, 600) }];
        if (st.audio) r.checks.push({ check: "voice note audio player present for the chef", ok: (await p.$$("#kitchen-body audio")).length > 0, detail: "" });
        r.screenshot = await snap("kitchen");
      } else if (st.api === "emptyOrder") {
        r.kind = "API edge case"; r.input = "POST /api/sessions/:id/orders with an empty cart";
        const res = await p.evaluate(async () => { const sid = localStorage.getItem("nash-session-id"); const x = await fetch(`/api/sessions/${sid}/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); return { status: x.status, body: await x.text() }; });
        r.outputs = [{ text: `HTTP ${res.status} ${res.body}` }];
      }
      const all = r.outputs.map((o) => o.text).join("\n");
      (st.expect || []).forEach((re) => r.checks.push({ check: `reply matches ${re}`, ok: re.test(all) }));
      (st.expectNot || []).forEach((re) => r.checks.push({ check: `reply does NOT match ${re}`, ok: !re.test(all) }));
      if (st.allVeg) { const nv = r.outputs.reduce((a, o) => a + o.nonveg, 0), v = r.outputs.reduce((a, o) => a + o.veg, 0); r.checks.push({ check: "every suggested dish is veg", ok: nv === 0 && v > 0, detail: `${v} veg, ${nv} non-veg` }); }
      if (st.allNonVeg) { const nv = r.outputs.reduce((a, o) => a + o.nonveg, 0), v = r.outputs.reduce((a, o) => a + o.veg, 0); r.checks.push({ check: "every suggested dish is non-veg", ok: v === 0 && nv > 0, detail: `${v} veg, ${nv} non-veg` }); }
      if (st.note) r.note = st.note;
    } catch (e) {
      r.checks.push({ check: "step ran without error", ok: false, detail: e.message.split("\n")[0] });
    }
    r.status = r.checks.every((c) => c.ok) ? "PASS" : "FAIL";
    r.outputs = r.outputs.map((o) => ({ text: o.text }));
    results.push(r);
    console.log(`  [${r.status}] ${sc.id}.${r.step} ${r.kind}: ${String(r.input).slice(0, 60)}`);
  }
  await p.goto(BASE + "/#home"); await p.waitForTimeout(300);
  const finalShot = await snap("final-chat");
  const sid = await p.evaluate(() => localStorage.getItem("nash-session-id"));
  const server = await (await fetch(`${BASE}/api/sessions/${sid}`)).json();
  fs.writeFileSync(path.join(dir, "transcript.server.json"), JSON.stringify(server, null, 2));
  const summary = { id: sc.id, title: sc.title, baseUrl: BASE, mode, sessionId: sid, ranAt: new Date().toISOString(), passed: results.filter((r) => r.status === "PASS").length, total: results.length, consoleErrors, finalScreenshot: finalShot, steps: results };
  fs.writeFileSync(path.join(dir, "result.json"), JSON.stringify(summary, null, 2));
  await ctx.close();
  return summary;
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const all = [];
  for (const sc of SCENARIOS) { console.log(`Scenario ${sc.id}: ${sc.title}`); all.push(await runScenario(browser, sc)); }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(all.map((s) => ({ id: s.id, title: s.title, passed: s.passed, total: s.total, mode: s.mode, failed: s.steps.filter((x) => x.status === "FAIL").map((x) => ({ step: x.step, input: x.input, failedChecks: x.checks.filter((c) => !c.ok) })) })), null, 2));
  console.log("\nDone:", all.map((s) => `S${s.id} ${s.passed}/${s.total}`).join("  "));
})();
