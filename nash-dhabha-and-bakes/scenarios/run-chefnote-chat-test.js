/** Chef notes from the chat (typed, dictated, recorded), in a real browser against the backend.
 *  node scenarios/run-chefnote-chat-test.js http://localhost:4000 -> scenarios/results/chef-note-chat/ */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:4000";
const OUT = path.join(__dirname, "results", "chef-note-chat"); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const WAV = path.join(__dirname, "results", "voice-tests", "test-voice-clip.wav");
(async () => {
  const b = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + WAV] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone"] });
  await ctx.addInitScript(`window.__speech=[];class SR{start(){const t=window.__speech.shift()||"";setTimeout(()=>{const r=[{transcript:t}];r.isFinal=true;this.onresult&&this.onresult({results:[r]});if(!this.continuous)this.onend&&this.onend()},300)}stop(){this.onend&&this.onend()}};window.SpeechRecognition=SR;window.webkitSpeechRecognition=SR;`);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const steps = []; const check = (step, name, ok, detail) => { steps.push({ step, check: name, ok: !!ok, detail: String(detail || "").replace(/\s+/g, " ").slice(0, 300) }); console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${name}${ok ? "" : " — " + String(detail).replace(/\s+/g, " ").slice(0, 160)}`); };
  await p.goto(BASE + "/#home"); await p.waitForFunction(() => window.__nash && document.querySelectorAll("#msgs .msg.bot").length);
  const ask = async (t, voice) => { const n = await p.$$eval("#msgs .msg.bot", (a) => a.length); if (voice) { await p.evaluate((x) => window.__speech.push(x), t); await p.click("#mic-btn"); } else { await p.fill("#chat-text", t); await p.press("#chat-text", "Enter"); } await p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k && !document.querySelector(".typing"), n, { timeout: 10000 }); await p.waitForTimeout(400); return p.$$eval("#msgs .msg.bot:not(.typing)", (a, k) => a.slice(k).map((x) => x.innerText).join("\n"), n); };
  const cart = () => p.evaluate(() => window.__nash.state.cart);
  let o = await ask("mushroom biryani");
  check("1 · mushroom biryani", "Mitra offers it", /Can I add Mushroom Biryani/i.test(o), o);
  o = await ask("add it also chief note");
  check("2 · add it also chief note", "adds the dish and asks for the note", /Added Mushroom Biryani/i.test(o) && /What should I tell the chef about Mushroom Biryani/i.test(o), o);
  check("2 · add it also chief note", "shows a Record voice note button", await p.isVisible("[data-note-open='mushroom-biryani']"));
  o = await ask("less spicy and no onion");
  let c = await cart(); let l = c.lines.find((x) => x.id === "mushroom-biryani");
  check("3 · less spicy and no onion", "note saved on the dish", l && /less spicy and no onion/i.test(l.note), JSON.stringify(l));
  await p.locator("#chat").screenshot({ path: path.join(OUT, "1-typed-note.png") });
  // dictated note
  await ask("add 1 butter naan");
  o = await ask("add chef note");
  check("4 · add chef note", "asks about the last dish added (Butter Naan)", /about Butter Naan/i.test(o), o);
  o = await ask("extra butter on top", true);
  c = await cart(); l = c.lines.find((x) => x.id === "butter-naan");
  check("5 · (spoken) extra butter on top", "dictated note saved", l && /extra butter on top/i.test(l.note), JSON.stringify(l));
  // recorded voice note via the chat button
  await ask("add 1 dal makhani");
  o = await ask("cheif note");
  await p.click("[data-note-open='dal-makhani']"); await p.waitForTimeout(300);
  check("6 · Record voice note button", "opens the recorder for Dal Makhani", /Dal Makhani/.test(await p.textContent("#note-title")), await p.textContent("#note-title"));
  await p.evaluate(() => window.__speech.push("make it less spicy for my kid")); await p.click("#rec-btn"); await p.waitForTimeout(2200); await p.click("#rec-btn"); await p.waitForTimeout(700);
  await p.click("#note-save"); await p.waitForTimeout(1200);
  c = await cart(); l = c.lines.find((x) => x.id === "dal-makhani");
  check("6 · recorded voice note", "voice note + transcript stored on the server", l && l.voice && /voice\//.test(l.voice.url) && /less spicy for my kid/i.test(l.voice.transcript || l.note), JSON.stringify(l));
  o = await ask("show my cart");
  check("7 · show my cart (after voice note)", "next message is NOT taken as a note", /Your cart has/i.test(o) && !/Noted/.test(o), o);
  // one-line and whole-order notes
  o = await ask("tell the chef to make the butter naan crispy");
  check("8 · tell the chef … butter naan crispy", "saved on Butter Naan", /Butter Naan/.test(o) && /crispy/i.test((await cart()).lines.find((x) => x.id === "butter-naan").note), o);
  o = await ask("note for chef: please pack everything separately for the whole order");
  check("9 · note for chef … whole order", "saved as whole-order note", /whole order/i.test(o) && /pack everything separately/i.test((await cart()).orderNote), o);
  await p.goto(BASE + "/#checkout"); await p.waitForTimeout(600);
  const co = await p.textContent("#co-body");
  check("10 · checkout", "all notes visible at checkout", /less spicy and no onion/i.test(co) && /extra butter/i.test(co) && /pack everything separately/i.test(co) && (await p.$$("#co-body audio")).length > 0, co.slice(0, 300));
  await p.screenshot({ path: path.join(OUT, "2-checkout-notes.png") });
  await p.fill("#co-table", "4"); await p.click("#place-btn"); await p.waitForFunction(() => location.hash === "#home"); await p.waitForTimeout(2600);
  await p.goto(BASE + "/#kitchen"); await p.waitForTimeout(1500);
  const k = await p.locator(".ticket", { hasText: "Mushroom Biryani" }).first().innerText();
  check("11 · kitchen", "chef sees typed, dictated and recorded notes", /less spicy and no onion/i.test(k) && /extra butter/i.test(k) && /less spicy for my kid/i.test(k) && /pack everything separately/i.test(k), k);
  await p.locator(".ticket", { hasText: "Mushroom Biryani" }).first().screenshot({ path: path.join(OUT, "3-kitchen-ticket.png") });
  check("no page errors", "clean console", errs.length === 0, errs.join("; "));
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ ranAt: new Date().toISOString(), baseUrl: BASE, passed: steps.filter((s) => s.ok).length, total: steps.length, steps }, null, 2));
  console.log(`Chef-note chat tests: ${steps.filter((s) => s.ok).length}/${steps.length}`);
  await b.close();
})();
