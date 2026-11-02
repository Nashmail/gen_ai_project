/** Opens the single-file app (dist/NASH-Dhabha-voice-app.html) straight from disk in Chromium,
 *  with a fake microphone, and runs a full visit: voice chat, waiter call, menu, voice chef note,
 *  order, payment, feedback, Staff desk and Hindi.
 *  node scenarios/run-standalone-test.js -> scenarios/results/standalone-html/ */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const FILE = path.join(__dirname, "..", "dist", "NASH-Dhabha-voice-app.html");
const OUT = path.join(__dirname, "results", "standalone-html"); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Speech-to-text stub: the browser "hears" the next phrase in window.__speech (real Chrome uses Google's recogniser)
const speechStub = `
  window.__speech = [];
  class StubSR { constructor(){ this.continuous=false; }
    start(){ window.__srLang=this.lang; const t=window.__speech.shift()||""; setTimeout(()=>{ const r=[{transcript:t}]; r.isFinal=true; this.onresult&&this.onresult({results:[r]}); setTimeout(()=>this.onend&&this.onend(),150); }, 300); }
    stop(){ this.onend&&this.onend(); } }
  window.SpeechRecognition=StubSR; window.webkitSpeechRecognition=StubSR;`;

(async () => {
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--allow-file-access-from-files"] });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(speechStub);
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const steps = [];
  const check = (step, name, ok, detail) => { steps.push({ step, check: name, ok: !!ok, detail: String(detail || "").replace(/\s+/g, " ").slice(0, 300) }); console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${name}${ok ? "" : " — " + String(detail).replace(/\s+/g, " ").slice(0, 160)}`); };
  const botCount = () => p.$$eval("#msgs .msg.bot:not(.typing)", (a) => a.length);
  const waitBot = (n) => p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k && !document.querySelector(".typing"), n, { timeout: 15000 }).then(() => sleep(400));
  const newText = (n) => p.$$eval("#msgs .msg.bot:not(.typing)", (a, k) => a.slice(k).map((x) => x.innerText).join("\n"), n);
  const ask = async (t) => { const n = await botCount(); await p.fill("#chat-text", t); await p.press("#chat-text", "Enter"); await waitBot(n); return newText(n); };
  const speak = async (t) => { const n = await botCount(); await p.evaluate((s) => window.__speech.push(s), t); await p.click("#mic-btn"); await waitBot(n); return newText(n); };

  await p.goto("file://" + FILE + "#home");
  await p.waitForFunction(() => document.querySelectorAll("#msgs .msg.bot").length);
  check("1 open from disk", "page loads with no server, title shown", /NASH/i.test(await p.title()) && /NASH Dhabha/i.test(await p.textContent("body")), await p.title());

  let o = await speak("hi i am mailesh");
  check("2 voice: name", "speech is transcribed and the name is kept", /Mailesh/.test(o) && !/your name/i.test(o), o);
  const userBubble = await p.$$eval("#msgs .msg.me", (a) => a.map((x) => x.innerText).join(" | "));
  check("2 voice: transcript", "spoken words appear as the customer's message", /hi i am mailesh/i.test(userBubble), userBubble);

  o = await speak("I want the waiter to come to my table");
  check("3 voice: call waiter", "waiter called, staff notified, asks table", /waiter/i.test(o) && /table number/i.test(o) && (await p.$$(".staff-tag")).length >= 1, o);
  o = await ask("table 4");
  check("4 table number", "table 4 attached to the request", /Table 4 noted/i.test(o), o);
  await p.locator("#chat").screenshot({ path: path.join(OUT, "1-waiter-call.png") });

  // menu
  await p.goto("file://" + FILE + "#menu"); await sleep(800);
  const dishes = await p.$$eval("#view-menu [data-ctl]", (a) => a.length);
  check("5 menu", "all dishes listed", dishes >= 70, dishes + " dishes");
  await p.click("#view-menu button.add[data-inc]"); await sleep(400);
  check("6 add from menu", "cart badge shows 1", (await p.textContent("#cart-count")).trim() === "1", await p.textContent("#cart-count"));
  await p.screenshot({ path: path.join(OUT, "2-menu.png") });

  // voice chef note from the cart
  await p.goto("file://" + FILE + "#checkout"); await sleep(800);
  await p.click("#view-checkout [data-note]"); await p.waitForSelector("#note-modal:not([hidden])");
  await p.fill("#note-text", "less oil please");
  await p.click("#rec-btn"); await sleep(2000); await p.click("#rec-btn"); await sleep(1200);
  const recStatus = await p.textContent("#rec-status").catch(() => "");
  const hasAudio = await p.$$eval("#note-modal audio", (a) => a.length);
  check("7 voice chef note", "microphone recording saved", hasAudio > 0 || /recorded|saved|\d+s/i.test(recStatus), `audio=${hasAudio} status=${recStatus}`);
  await p.click("#note-save"); await sleep(600);
  const co = await p.textContent("#view-checkout");
  check("8 note on cart", "chef note shown in the cart", /less oil/i.test(co), co.slice(0, 200));

  // place the order
  if (await p.$("#co-table")) await p.fill("#co-table", "4");
  let n = await botCount();
  await p.click("#place-btn"); await waitBot(n);
  o = await newText(n);
  check("9 place order", "order placed in the chat", /NDB-\d+|order/i.test(o), o);
  await p.waitForFunction(() => /how would you like to pay/i.test(document.querySelector("#msgs").innerText), null, { timeout: 40000 }); await sleep(500);
  const all = await p.textContent("#msgs");
  check("10 order updates", "kitchen updates and bill in the chat", /chef|kitchen|cooking/i.test(all) && (await p.$$(".receipt")).length >= 1, "");
  o = await ask("UPI"); o = await ask("★★★★★ Excellent");
  check("11 pay + feedback", "paid by UPI, thanked for 5 stars", /5-star/.test(o), o);
  await p.locator("#chat").screenshot({ path: path.join(OUT, "3-order-and-bill.png") });

  // staff desk
  await p.goto("file://" + FILE + "#staff"); await sleep(1500);
  const sd = await p.textContent("#staff-body");
  check("12 staff desk", "waiter request for table 4 listed", /Waiter requested/i.test(sd) && /\b4\b/.test(sd), sd.slice(0, 250));
  check("13 satisfaction", "rating shown", /5\.0/.test(sd), sd.slice(0, 250));
  await p.screenshot({ path: path.join(OUT, "4-staff-desk.png"), fullPage: true });

  // Hindi
  await p.goto("file://" + FILE + "#home"); await sleep(600);
  n = await botCount(); await p.click('.lang-seg [data-lang="hi"]'); await waitBot(n);
  o = await speak("waiter ko bulao");
  check("14 Hindi voice", "Hindi reply, mic set to hi-IN", /[ऀ-ॿ]/.test(o) && (await p.evaluate(() => window.__srLang)) === "hi-IN", o + " | " + (await p.evaluate(() => window.__srLang)));
  await p.locator("#chat").screenshot({ path: path.join(OUT, "5-hindi.png") });
  check("15 no page errors", "clean console", errs.length === 0, errs.join("; "));

  const passed = steps.filter((s) => s.ok).length;
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ ranAt: new Date().toISOString(), file: "dist/NASH-Dhabha-voice-app.html", opened: "file:// (no server)", passed, total: steps.length, steps }, null, 2));
  console.log(`Standalone HTML test: ${passed}/${steps.length}`);
  await b.close();
})();
