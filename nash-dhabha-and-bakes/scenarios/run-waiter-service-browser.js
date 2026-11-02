/** AI-waiter service features in a real browser against the backend.
 *  node scenarios/run-waiter-service-browser.js http://localhost:4000 -> scenarios/results/waiter-service-browser/ */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:4000";
const OUT = path.join(__dirname, "results", "waiter-service-browser"); fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  const steps = []; const check = (step, name, ok, detail) => { steps.push({ step, check: name, ok: !!ok, detail: String(detail || "").replace(/\s+/g, " ").slice(0, 300) }); console.log(`[${ok ? "PASS" : "FAIL"}] ${step}: ${name}${ok ? "" : " — " + String(detail).replace(/\s+/g, " ").slice(0, 160)}`); };
  await p.goto(BASE + "/#home"); await p.waitForFunction(() => window.__nash && document.querySelectorAll("#msgs .msg.bot").length);
  const ask = async (t) => { const n = await p.$$eval("#msgs .msg.bot", (a) => a.length); await p.fill("#chat-text", t); await p.press("#chat-text", "Enter"); await p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k && !document.querySelector(".typing"), n, { timeout: 10000 }); await sleep(400); return p.$$eval("#msgs .msg.bot:not(.typing)", (a, k) => a.slice(k).map((x) => x.innerText).join("\n"), n); };
  const st = () => p.evaluate(() => window.__nash.state);
  let o = await ask("Hello!"); check("1 Hello!", "welcome", /welcome/i.test(o), o);
  o = await ask("hello i am mailesh"); check("2 name", "name kept", /Mailesh/.test(o), o);
  o = await ask("Can I get an extra chair?"); check("3 extra chair", "staff notified tag shown", /extra chair/i.test(o) && (await p.$$(".staff-tag")).length >= 1, o);
  o = await ask("I'm allergic to peanuts."); check("4 peanut allergy", "names Lemon Rice + staff confirm", /Lemon Rice/.test(o) && /confirm/i.test(o), o);
  // language switch via the header button
  let n0 = await p.$$eval("#msgs .msg.bot", (a) => a.length); await p.click('.lang-seg [data-lang="hi"]'); await p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k && !document.querySelector(".typing"), n0); await sleep(400);
  o = await p.$$eval("#msgs .msg.bot", (a) => a[a.length - 1].innerText);
  check("5 हिं button", "replies in Hindi; voice language hi-IN", /[ऀ-ॿ]/.test(o) && (await st()).lang === "hi", o);
  o = await ask("आज का स्पेशल क्या है?"); check("6 Hindi question", "today's special understood from Hindi words", /special|स्पेशल/i.test(o) && /₹/.test(o), o);
  await p.screenshot({ path: path.join(OUT, "1-hindi.png") });
  n0 = await p.$$eval("#msgs .msg.bot", (a) => a.length); await p.click('.lang-seg [data-lang="en"]'); await p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k, n0); await sleep(400);
  // the sample conversation from the brief
  o = await ask("Can you suggest a vegetarian dish?"); check("7 suggest veg", "Paneer Butter Masala with Butter Naan", /Paneer Butter Masala/.test(o) && /Butter Naan/.test(o), o);
  o = await ask("Yes. Also, is it very spicy?"); check("8 price + spice", "₹260 and mild, can make milder", /₹260/.test(o) && /mild/i.test(o), o);
  o = await ask("Okay, I'll order it."); check("9 order it", "added + asks to send to kitchen", /added/i.test(o) && /kitchen/i.test(o), o);
  o = await ask("yes"); check("10 yes", "asks table", /table/i.test(o), o);
  o = await ask("table 5"); check("11 table 5", "sent to the kitchen", /sent to the kitchen/i.test(o) && (await st()).order, o);
  o = await ask("Can I change my order?"); check("12 change order (not cooking yet)", "moved back to the cart", /cart/i.test(o) && (await st()).cart.count > 0, o);
  o = await ask("add 1 masala chai"); o = await ask("send it to the kitchen"); check("13 send again", "re-sent without asking table", /sent to the kitchen/i.test(o), o);
  await p.waitForFunction(() => window.__nash.state.order && window.__nash.state.order.stage >= 2, null, { timeout: 15000 });
  o = await ask("Can I cancel my order?"); check("14 cancel while cooking", "refuses, calls staff", /already|cooking/i.test(o) && /staff/i.test(o) && !(await st()).order.cancelled, o);
  o = await ask("Where is my order?"); check("15 where is my order", "status with order number", /NDB-\d+/.test(o), o);
  o = await ask("My food is cold."); check("16 complaint", "apology + staff", /sorry/i.test(o) && /staff/i.test(o), o);
  await p.waitForFunction(() => /how would you like to pay/i.test(document.querySelector("#msgs").innerText), null, { timeout: 25000 }); await sleep(500);
  o = await ask("Can I split the bill between 2?"); const total = (await st()).order.bill.total; check("17 split bill", "per-person amount", new RegExp("₹" + Math.ceil(total / 2).toLocaleString("en-IN")).test(o), o + " | total " + total);
  o = await ask("Can I get the bill?"); check("18 get bill", "bill shown", (await p.$$(".receipt")).length >= 2, o);
  o = await ask("UPI"); o = await ask("★★★★ Good"); check("19 pay + feedback", "paid, 4-star thanks", /4-star/.test(o), o);
  o = await ask("Do you have parking?"); check("20 unknown question", "doesn't guess, offers staff", /don't want to guess/i.test(o), o);
  o = await ask("Yes, call staff"); check("21 call staff", "staff asked", /staff member/i.test(o), o);
  await p.locator("#chat").screenshot({ path: path.join(OUT, "2-conversation.png") });
  // staff desk
  await p.goto(BASE + "/#staff"); await sleep(1500);
  let t = await p.textContent("#staff-body");
  check("22 staff desk", "chair, allergy, complaint, cancel and question requests listed", /extra chair/i.test(t) && /Allergy/i.test(t) && /Food quality/i.test(t) && /cancel/i.test(t) && /parking/i.test(t), t.slice(0, 300));
  check("23 satisfaction", "average rating shown", /4\.0|\d\.\d/.test(t) && /review/i.test(t), t.slice(0, 200));
  const before = (await p.$$("[data-req-done]")).length; await p.click("[data-req-done]"); await sleep(1200);
  check("24 mark done", "one fewer open request", (await p.$$("[data-req-done]")).length === before - 1, `${before} -> ${(await p.$$("[data-req-done]")).length}`);
  await p.screenshot({ path: path.join(OUT, "3-staff-desk.png"), fullPage: true });
  check("no page errors", "clean console", errs.length === 0, errs.join("; "));
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify({ ranAt: new Date().toISOString(), baseUrl: BASE, passed: steps.filter((s) => s.ok).length, total: steps.length, steps }, null, 2));
  console.log(`Waiter-service browser tests: ${steps.filter((s) => s.ok).length}/${steps.length}`);
  await b.close();
})();
