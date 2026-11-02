/**
 * Voice tests in a real Chromium browser.
 * - The microphone is Chromium's fake audio device fed with a real WAV file, so
 *   recording, upload, server storage and kitchen playback are tested for real.
 * - Speech-to-text uses a stand-in recogniser (headless Chromium has no Google
 *   speech service), so the transcript text is scripted; the app's handling of it is real.
 * Results: scenarios/results/voice-tests/
 *   node scenarios/run-voice-tests.js http://localhost:4000
 */
const fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:4000";
const OUT = path.join(__dirname, "results", "voice-tests");
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 3-second test clip: a voice-like tone sweep, 16-bit mono WAV
function makeWav(file, secs = 3, rate = 16000) {
  const n = secs * rate, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / rate, f = 180 + 60 * Math.sin(t * 3), env = 0.5 + 0.5 * Math.sin(t * 9); buf.writeInt16LE(Math.round(9000 * env * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t))), 44 + i * 2); }
  fs.writeFileSync(file, buf);
}
const WAV = path.join(OUT, "test-voice-clip.wav"); makeWav(WAV);

const speechStub = (mode) => `
  window.__speech = [];
  ${mode === "none" ? "delete window.SpeechRecognition; delete window.webkitSpeechRecognition; Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined});" : `
  class StubSR { constructor(){ this.continuous=false; }
    start(){ window.__srStarted=(window.__srStarted||0)+1; const t=window.__speech.shift()||"";
      setTimeout(()=>{ ${mode === "denied" ? "this.onerror&&this.onerror({error:'not-allowed'}); this.onend&&this.onend(); return;" : ""}
        const words=t.split(' '); let said='';
        words.forEach((w,i)=>setTimeout(()=>{ said+=(i?' ':'')+w; const r=[{transcript:said}]; r.isFinal=i===words.length-1; this.onresult&&this.onresult({results:[r]}); if(i===words.length-1&&!this.continuous) setTimeout(()=>this.onend&&this.onend(),150); }, i*120));
      }, 250); }
    stop(){ this.onend&&this.onend(); } }
  window.SpeechRecognition=StubSR; window.webkitSpeechRecognition=StubSR;`}`;

const results = [];
async function test(id, title, fn) {
  const r = { id, title, checks: [], output: "", status: "PASS" };
  const check = (name, ok, detail) => r.checks.push({ check: name, ok: !!ok, detail: detail === undefined ? "" : String(detail).slice(0, 300) });
  try { r.output = (await fn(check, r)) || ""; } catch (e) { check("test ran without error", false, e.message.split("\n")[0]); }
  r.status = r.checks.every((c) => c.ok) ? "PASS" : "FAIL"; results.push(r);
  console.log(`[${r.status}] ${id} ${title}`); r.checks.filter((c) => !c.ok).forEach((c) => console.log("     x", c.check, c.detail));
}
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: opts.noMic ? [] : ["microphone"] });
  await ctx.addInitScript(speechStub(opts.speech || "ok"));
  const p = await ctx.newPage(); p.__errors = []; p.on("pageerror", (e) => p.__errors.push(e.message));
  await p.goto(BASE + "/#home"); await p.waitForFunction(() => window.__nash && document.querySelectorAll("#msgs .msg.bot").length > 0);
  return { ctx, p };
}
const lastBot = (p) => p.$$eval("#msgs .msg.bot:not(.typing)", (a) => a[a.length - 1].innerText);
const bots = (p) => p.$$eval("#msgs .msg.bot:not(.typing)", (a) => a.length);
const waitBot = (p, n) => p.waitForFunction((k) => document.querySelectorAll("#msgs .msg.bot:not(.typing)").length > k && !document.querySelector("#msgs .typing"), n, { timeout: 10000 });
const duration = (file) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString()) || 0;
const voiceFile = (url) => path.join(__dirname, "..", "backend", "data", "voice", path.basename(url));

(async () => {
  const withMic = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${WAV}`] });
  const noMic = await chromium.launch({ args: [] });

  await test("V1", "Talk to Masala Mitra with the mic (speech → text → reply)", async (check) => {
    const { ctx, p } = await open(withMic);
    await p.fill("#chat-text", "hi"); await p.press("#chat-text", "Enter"); await sleep(900);
    await p.evaluate(() => window.__speech.push("my name is Mailesh"));
    let n = await bots(p); await p.click("#mic-btn"); await sleep(200);
    check("mic button shows it is listening", await p.$eval("#mic-btn", (b) => b.classList.contains("on")));
    await waitBot(p, n); await sleep(300);
    const bubble = await p.$$eval("#msgs .msg.me", (a) => a[a.length - 1].innerText);
    check("spoken words appear as a 'Voice · transcribed' message", /voice/i.test(bubble) && /my name is Mailesh/i.test(bubble), bubble);
    check("bot answers the spoken name", /Mailesh/.test(await lastBot(p)));
    await p.evaluate(() => window.__speech.push("I am feeling very happy today"));
    n = await bots(p); await p.click("#mic-btn"); await waitBot(p, n); await sleep(300);
    const o = await lastBot(p), all = (await p.$$eval("#msgs .msg.bot", (a) => a.slice(-2).map((x) => x.innerText).join("\n")));
    check("bot understands the spoken mood (happy) and suggests dishes", /happy/i.test(all) && /can i add/i.test(o), all.slice(0, 200));
    check("no page errors", p.__errors.length === 0, p.__errors.join("; "));
    await p.screenshot({ path: path.join(OUT, "V1-voice-chat.png") }); await ctx.close();
    return all;
  });

  let kitchenOrder = null;
  await test("V2", "Record a chef voice note with the mic + live transcript, send to kitchen", async (check, r) => {
    const { ctx, p } = await open(withMic);
    await p.goto(BASE + "/#menu"); await sleep(400);
    await p.click('[data-note="dal-makhani"]'); await sleep(300);
    await p.evaluate(() => window.__speech.push("less oil and make it extra spicy please"));
    await p.click("#rec-btn"); await sleep(300);
    check("record button switches to 'Stop recording'", /stop recording/i.test(await p.textContent("#rec-btn")));
    await sleep(3200);
    check("live transcript fills the note box", /less oil and make it extra spicy please/i.test(await p.inputValue("#note-text")), await p.inputValue("#note-text"));
    await p.click("#rec-btn"); await sleep(800);
    check("recorded clip appears with a player", await p.isVisible("#rec-audio"));
    const localDur = await p.$eval("#rec-audio", (a) => new Promise((ok) => { if (a.readyState >= 1 && isFinite(a.duration)) ok(a.duration); a.onloadedmetadata = () => ok(a.duration); setTimeout(() => ok(-1), 3000); }));
    await p.screenshot({ path: path.join(OUT, "V2-recording-done.png") });
    await p.click("#note-save"); await sleep(1200);
    const st = await p.evaluate(async () => (await (await fetch(`/api/sessions/${localStorage.getItem("nash-session-id")}`)).json()).state);
    const line = st.cart.lines.find((l) => l.id === "dal-makhani");
    check("server stored the voice note and transcript", line && line.voice && /voice\//.test(line.voice.url) && /extra spicy/i.test(line.voice.transcript), JSON.stringify(line && line.voice));
    if (line && line.voice) {
      const f = voiceFile(line.voice.url), size = fs.statSync(f).size, d = duration(f);
      fs.copyFileSync(f, path.join(OUT, "V2-recorded-chef-note" + path.extname(f)));
      check("saved audio file is a real recording (≥ 2 s, > 5 KB)", d >= 2 && size > 5000, `${d.toFixed(2)} s, ${size} bytes`);
      r.audioSeconds = d;
    }
    await p.goto(BASE + "/#checkout"); await sleep(500); await p.fill("#co-table", "9"); await p.click("#place-btn");
    await p.waitForFunction(() => location.hash === "#home"); await sleep(1500);
    await p.goto(BASE + "/#kitchen"); await sleep(1500);
    const ticket = p.locator(".ticket", { hasText: "Dal Makhani" }).first();
    const tText = await ticket.innerText();
    check("kitchen ticket shows the note, transcript and an audio player", /extra spicy/i.test(tText) && (await ticket.locator("audio").count()) > 0, tText.replace(/\s+/g, " ").slice(0, 200));
    const kDur = await ticket.locator("audio").first().evaluate((a) => new Promise((ok) => { a.preload = "metadata"; a.load(); a.onloadedmetadata = () => ok(a.duration); a.onerror = () => ok(-2); setTimeout(() => ok(-1), 5000); }));
    check("chef can play it: kitchen audio loads from the server", kDur !== -2 && kDur !== -1, `duration reported ${kDur}`);
    await ticket.screenshot({ path: path.join(OUT, "V2-kitchen-ticket.png") });
    kitchenOrder = tText; await ctx.close();
    return `in-browser clip ${localDur} s · ${tText.replace(/\s+/g, " ").slice(0, 200)}`;
  });

  await test("V3", "Mic blocked (like the Claude preview): phone-recorder fallback", async (check) => {
    const { ctx, p } = await open(noMic, { noMic: true });
    await p.goto(BASE + "/#menu"); await sleep(400);
    await p.click('[data-note="masala-chai"]'); await sleep(300);
    await p.click("#rec-btn"); await sleep(1200);
    const status = await p.textContent("#rec-status");
    check("explains the mic is blocked and points to the recorder button", /record with your phone/i.test(status), status);
    check("phone-recorder button is highlighted", await p.$eval(".rec-phone", (b) => b.classList.contains("btn-primary")));
    check("file input asks the phone to capture audio", await p.$eval("#rec-file", (i) => i.accept === "audio/*" && i.hasAttribute("capture")));
    await p.setInputFiles("#rec-file", WAV); await sleep(600);
    check("attached recording shows a player", await p.isVisible("#rec-audio"));
    await p.fill("#note-text", "Less sugar"); await p.click("#note-save"); await sleep(1200);
    const st = await p.evaluate(async () => (await (await fetch(`/api/sessions/${localStorage.getItem("nash-session-id")}`)).json()).state);
    const line = st.cart.lines.find((l) => l.id === "masala-chai");
    check("server stored the attached recording", line && line.voice && /voice\//.test(line.voice.url), JSON.stringify(line && line.voice));
    if (line && line.voice) check("stored file is the full 3-second clip", Math.abs(duration(voiceFile(line.voice.url)) - 3) < 0.2, duration(voiceFile(line.voice.url)));
    await p.screenshot({ path: path.join(OUT, "V3-blocked-mic-fallback.png") }); await ctx.close();
    return status;
  });

  await test("V4", "Chat mic blocked: clear guidance instead of silence", async (check) => {
    const { ctx, p } = await open(withMic, { speech: "denied" });
    const n = await bots(p); await p.click("#mic-btn"); await waitBot(p, n); await sleep(300);
    const o = await lastBot(p);
    check("tells the user the mic is blocked and how to fix it", /microphone is blocked/i.test(o) && /chrome or edge/i.test(o), o);
    check("mic button returns to normal", !(await p.$eval("#mic-btn", (b) => b.classList.contains("on"))));
    await ctx.close(); return o;
  });

  await test("V5", "Browser without speech recognition (e.g. Firefox)", async (check) => {
    const { ctx, p } = await open(withMic, { speech: "none" });
    const n = await bots(p); await p.click("#mic-btn"); await waitBot(p, n); await sleep(300);
    const o = await lastBot(p);
    check("says voice isn't supported and suggests Chrome or Edge", /isn't supported/i.test(o) && /chrome or edge/i.test(o), o);
    check("typing still works", await (async () => { const k = await bots(p); await p.fill("#chat-text", "hi"); await p.press("#chat-text", "Enter"); await waitBot(p, k); return /name/i.test(await lastBot(p)); })());
    await ctx.close(); return o;
  });

  await test("V6", "Whole-order voice note at checkout reaches the kitchen", async (check) => {
    const { ctx, p } = await open(withMic);
    await p.fill("#chat-text", "add 1 veg puff"); await p.press("#chat-text", "Enter"); await sleep(1200);
    await p.goto(BASE + "/#checkout"); await sleep(500);
    await p.click('[data-note="__order"]'); await sleep(300);
    await p.evaluate(() => window.__speech.push("please pack it separately"));
    await p.click("#rec-btn"); await sleep(2600); await p.click("#rec-btn"); await sleep(800);
    await p.click("#note-save"); await sleep(1000);
    check("checkout shows the order voice note player", (await p.$$("#co-body audio")).length > 0);
    await p.check("#mode-take", { force: true }); await p.click("#place-btn"); await p.waitForFunction(() => location.hash === "#home"); await sleep(2800);
    const chat = await p.textContent("#msgs");
    check("chef confirmation mentions the voice note", /whole order[^•]*voice note/i.test(chat), chat.slice(-300));
    await p.goto(BASE + "/#kitchen"); await sleep(1500);
    const t = await p.locator(".ticket", { hasText: "Veg Puff" }).first().innerText();
    check("kitchen shows the whole-order voice note with its transcript", /whole order/i.test(t) && /pack it separately/i.test(t), t.replace(/\s+/g, " ").slice(0, 200));
    await ctx.close(); return t.replace(/\s+/g, " ").slice(0, 300);
  });

  await withMic.close(); await noMic.close();
  const summary = { ranAt: new Date().toISOString(), baseUrl: BASE, passed: results.filter((r) => r.status === "PASS").length, total: results.length,
    notTestable: "Real speech-recognition accuracy: headless Chromium has no Google speech service, so transcripts were scripted. Test real speech in Chrome or Edge.", tests: results };
  fs.writeFileSync(path.join(OUT, "result.json"), JSON.stringify(summary, null, 2));
  console.log(`\nVoice tests: ${summary.passed}/${summary.total}`);
})();
