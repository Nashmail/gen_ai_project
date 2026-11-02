/** Renders video/stage.html frame by frame and encodes the MP4 with music.
 *  node video/render.js [fps] [--preview t1,t2,...] */
const fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");
const FPS = +process.argv[2] || 30;
const VO = path.join(__dirname, "build", "voiceover.json");
const vo = fs.existsSync(VO) ? JSON.parse(fs.readFileSync(VO)) : null;
const WARP = vo ? vo.warp : [[0, 0], [51, 51]];
const DUR = WARP[WARP.length - 1][1];
// video time -> stage time (scenes stretched to fit the voiceover)
function stageTime(tv) {
  for (let i = 1; i < WARP.length; i++) { const [s0, v0] = WARP[i - 1], [s1, v1] = WARP[i]; if (tv <= v1) return v1 === v0 ? s0 : s0 + (tv - v0) * (s1 - s0) / (v1 - v0); }
  return WARP[WARP.length - 1][0];
}
const preview = (process.argv.find((a) => a.startsWith("--preview=")) || "").split("=")[1];
const B = path.join(__dirname, "build"), FR = path.join(B, "frames");

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await p.goto("file://" + path.join(__dirname, "stage.html"));
  await p.evaluate(() => document.fonts.ready);
  const m = JSON.parse(fs.readFileSync(path.join(B, "markers.json")));
  await p.evaluate((f) => window.setFrames(f), m.frames);
  if (preview) {
    for (const t of preview.split(",").map(Number)) { await p.evaluate((x) => window.render(x), t); await p.waitForTimeout(60); await p.screenshot({ path: path.join(B, `preview-${t}.jpg`), type: "jpeg", quality: 80 }); }
    await browser.close(); return;
  }
  const encodeOnly = process.argv.includes("--encode-only");
  if (!encodeOnly) { fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true }); }
  const total = encodeOnly ? 0 : Math.round(DUR * FPS), t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await p.evaluate((x) => window.render(x), stageTime(i / FPS));
    await p.screenshot({ path: path.join(FR, `s_${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (i % 150 === 0) console.log(`frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await browser.close();
  const out = path.join(__dirname, "NASH-Dhabha-Masala-Mitra-LinkedIn.mp4");
  const args = ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(FR, "s_%05d.jpg"), "-i", path.join(B, "music.wav")];
  if (vo) {
    // build/mix.wav = voice + ducked music (video/mix.py); here: one linear gain to -14 LUFS + true-peak limit
    args.splice(args.indexOf(path.join(B, "music.wav")), 1, path.join(B, "mix.wav"));
    const meas = require("child_process").spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(B, "mix.wav"), "-af", "loudnorm=I=-14:TP=-1.5:print_format=json", "-f", "null", "-"]).stderr.toString();
    const j = JSON.parse(meas.slice(meas.lastIndexOf("{")));
    const gain = (-14.5 - parseFloat(j.input_i)).toFixed(2);
    args.push("-af", `volume=${gain}dB,alimiter=limit=0.7:attack=3:release=80:level=false,aresample=44100`);
    console.log("mix loudness", j.input_i, "LUFS -> gain", gain, "dB");
  }
  args.push("-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-t", String(DUR), out);
  execFileSync("ffmpeg", args);
  console.log("wrote", out);
})();
