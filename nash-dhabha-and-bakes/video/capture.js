/** Records real footage of the app (phone size, 2x pixels) for the LinkedIn video.
 *  Output: video/build/footage/f_XXXXX.jpg + markers.json (frame timestamps and scene markers) */
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:4000";
const OUT = path.join(__dirname, "build", "footage");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const WAV = path.join(__dirname, "..", "scenarios", "results", "voice-tests", "test-voice-clip.wav");
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + WAV] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  // stand-in speech recogniser (word-by-word, like real dictation) so the voice UI can be filmed headless
  await ctx.addInitScript(`window.__speech=[];class SR{constructor(){this.continuous=false}start(){const t=window.__speech.shift()||"";const w=t.split(" ");let s="";setTimeout(()=>{w.forEach((x,i)=>setTimeout(()=>{s+=(i?" ":"")+x;const r=[{transcript:s}];r.isFinal=i===w.length-1;this.onresult&&this.onresult({results:[r]});if(i===w.length-1&&!this.continuous)setTimeout(()=>this.onend&&this.onend(),500)},i*230))},700)}stop(){this.onend&&this.onend()}};window.SpeechRecognition=SR;window.webkitSpeechRecognition=SR;`);
  const p = await ctx.newPage();
  await p.goto(BASE + "/#home");
  await p.waitForFunction(() => window.__nash && document.querySelectorAll("#msgs .msg.bot").length > 0);
  await p.addStyleTag({ content: ".toast{bottom:120px!important} *{scroll-behavior:auto!important}" });
  await sleep(800);

  const frames = [], markers = [];
  let rec = true, n = 0; const t0 = Date.now();
  const loop = (async () => { while (rec) { const t = Date.now() - t0; const f = `f_${String(n++).padStart(5, "0")}.jpg`; await p.screenshot({ path: path.join(OUT, f), type: "jpeg", quality: 88 }); frames.push({ f, t }); } })();
  const mark = (name) => { markers.push({ name, t: Date.now() - t0 }); console.log("mark", name, Date.now() - t0); };
  const smoothScroll = async (y, ms = 700) => { const steps = Math.round(ms / 40); const y0 = await p.evaluate(() => scrollY); for (let i = 1; i <= steps; i++) { const k = i / steps, e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await p.evaluate((v) => scrollTo(0, v), y0 + (y - y0) * e); await sleep(40); } };
  const type = async (text) => { await p.click("#chat-text"); await p.type("#chat-text", text, { delay: 55 }); await sleep(250); await p.press("#chat-text", "Enter"); };
  const waitBot = async (n0) => { await p.waitForFunction((n) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > n && !document.querySelector("#msgs .typing"), n0); await sleep(900); };
  const bots = () => p.$$eval("#msgs .msg.bot:not(.typing)", (a) => a.length);

  mark("home"); await sleep(1500);
  const chatTop = await p.evaluate(() => document.querySelector("#chat").getBoundingClientRect().top + scrollY - 70);
  await smoothScroll(chatTop, 900);
  mark("chat"); await sleep(500);
  let b = await bots(); await type("hi"); await waitBot(b);
  b = await bots(); await type("I am Mailesh"); await waitBot(b);
  mark("mood"); b = await bots(); await p.evaluate(() => window.__speech.push("I'm feeling tired today")); await p.click("#mic-btn"); await waitBot(b); await sleep(1400);
  mark("add"); b = await bots(); await p.locator(".chips .chip", { hasText: "Yes, add it" }).last().click(); await waitBot(b);
  b = await bots(); await type("add 2 butter naan and dal makhani"); await waitBot(b); await sleep(600);
  mark("menu"); await p.evaluate(() => (location.hash = "menu")); await sleep(900);
  await smoothScroll(900, 1400); await sleep(400); await smoothScroll(2600, 1600); await sleep(400);
  await p.evaluate(() => (location.hash = "home")); await p.evaluate(() => (location.hash = "menu")); await sleep(600);
  const naan = await p.evaluate(() => document.querySelector('[data-note="garlic-naan"]').getBoundingClientRect().top + scrollY - 420);
  await smoothScroll(naan, 900); await sleep(300);
  mark("chefnote"); await p.click('[data-note="butter-naan"]'); await sleep(500);
  await p.evaluate(() => window.__speech.push("Extra butter and well done please")); await p.click("#rec-btn"); await sleep(3200); await p.click("#rec-btn"); await sleep(1300);
  await p.click("#note-save"); await sleep(1300);
  mark("checkout"); await p.evaluate(() => (location.hash = "checkout")); await sleep(1300);
  await smoothScroll(700, 1000); await sleep(400);
  await p.fill("#co-table", "7"); await smoothScroll(1500, 1000); await sleep(600);
  mark("place"); b = await bots(); await p.click("#place-btn"); await waitBot(b);
  const chatTop2 = await p.evaluate(() => document.querySelector("#chat").getBoundingClientRect().top + scrollY - 70);
  await smoothScroll(chatTop2, 600);
  mark("tracking");
  await p.waitForFunction(() => /how would you like to pay/i.test(document.querySelector("#msgs").innerText), null, { timeout: 30000 });
  await sleep(1500);
  mark("bill"); await p.evaluate(() => { const m = document.querySelector("#msgs"); const r = [...m.querySelectorAll(".receipt")].pop(); if (r) m.scrollTop = r.closest(".msg").offsetTop - 60; }); await sleep(2200);
  await p.evaluate(() => { const m = document.querySelector("#msgs"); m.scrollTop = m.scrollHeight; }); await sleep(600);
  mark("pay"); b = await bots(); await p.locator(".chips .chip", { hasText: "UPI" }).last().click(); await waitBot(b); await sleep(700);
  mark("feedback"); b = await bots(); await p.locator(".chips .chip", { hasText: "Loved it" }).last().click(); await waitBot(b); await sleep(1800);
  mark("end");
  rec = false; await loop;
  fs.writeFileSync(path.join(__dirname, "build", "markers.json"), JSON.stringify({ frames, markers }, null, 1));
  console.log("frames", frames.length, "duration", frames[frames.length - 1].t);
  await browser.close();
})();
