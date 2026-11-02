/**
 * NASH Dhabha & Bakes — backend API
 * Masala Mitra chatbot (retrieval-augmented over the menu knowledge base),
 * cart, chef notes (text + voice), orders, billing, payment and feedback.
 */
const path = require("path");
const express = require("express");
const cors = require("cors");
const E = require("../../shared/engine");
const NashLLM = require("../../shared/llm");
// Optional: put GEMINI_API_KEY in backend/.env or the host's environment settings
try { require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8").split("\n").forEach((l) => { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }); } catch (e) {}
const LLM = { key: process.env.GEMINI_API_KEY || "", model: process.env.GEMINI_MODEL || NashLLM.DEFAULT_MODEL };
LLM.enabled = !!LLM.key;
const store = require("./store");

const PORT = process.env.PORT || 4000;
const app = express();

const origins = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: origins.includes("*") ? true : origins }));
app.use(express.json({ limit: "12mb" }));

// ---------- helpers ----------
function session(req, res) {
  const s = store.getSession(req.params.sid);
  if (!s) { res.status(404).json({ error: "SESSION_NOT_FOUND", message: "Session expired or unknown. Start a new chat." }); return null; }
  return s;
}
function publicState(S) {
  return { name: S.name, diet: S.diet, awaiting: S.awaiting, cart: E.cartView(S), order: S.order };
}
function reply(res, s, messages) {
  messages.forEach((m) => store.log(s.id, m));
  if (s.state.order) store.upsertOrder(s.id, s.state.order);
  store.saveSession();
  res.json({ messages, state: publicState(s.state) });
}

// ---------- routes ----------
app.get("/api/health", (req, res) => res.json({ ok: true, service: "nash-dhabha-api", bot: E.BOT_NAME, items: E.MENU.length, llm: LLM.enabled ? { provider: "gemini", model: LLM.model } : null, time: new Date().toISOString() }));

app.get("/api/menu", (req, res) => res.json({ categories: E.CATS, items: E.MENU, info: E.INFO, stages: E.STAGES }));

app.post("/api/sessions", (req, res) => {
  const s = store.newSession(E.createState());
  const messages = E.welcome();
  messages.forEach((m) => store.log(s.id, m));
  res.status(201).json({ sessionId: s.id, messages, state: publicState(s.state) });
});

app.get("/api/sessions/:sid", (req, res) => {
  const s = session(req, res); if (!s) return;
  res.json({ sessionId: s.id, state: publicState(s.state), transcript: s.transcript });
});

app.post("/api/sessions/:sid/chat", async (req, res) => {
  const s = session(req, res); if (!s) return;
  const text = String((req.body && req.body.text) || "").slice(0, 500);
  const history = s.transcript.filter((m) => m.role === "user" || m.role === "bot").slice(-6).map((m) => ({ role: m.role, text: m.text }));
  store.log(s.id, { role: "user", text, voice: !!req.body.voice });
  let messages;
  try { messages = E.chat(s.state, text); }
  catch (e) { console.error(e); messages = [{ role: "bot", text: "Sorry, something went wrong there. Could you say that again?" }]; }
  // RAG generation: let Gemini write menu answers from the retrieved context (rules stay as the safe fallback)
  if (LLM.enabled && E.LLM_ROUTES.has(messages.route)) {
    try {
      const ctx = E.contextFor(s.state, text, messages);
      const ans = await NashLLM.ask({ key: LLM.key, model: LLM.model, ctx, history, timeoutMs: 9000 });
      const ai = E.llmApply(s.state, ans, ctx);
      if (ai) messages = ai; else store.log(s.id, { role: "event", type: "llm-rejected", answer: ans });
    } catch (e) { store.log(s.id, { role: "event", type: "llm-error", error: String(e.message).slice(0, 200) }); }
  }
  reply(res, s, messages);
});

app.post("/api/sessions/:sid/cart", (req, res) => {
  const s = session(req, res); if (!s) return;
  const { id, qty, delta } = req.body || {};
  if (!E.ITEM[id]) return res.status(400).json({ error: "UNKNOWN_ITEM" });
  const current = s.state.cart[id] ? s.state.cart[id].qty : 0;
  E.setQty(s.state, id, typeof delta === "number" ? current + delta : Number(qty) || 0);
  store.log(s.id, { role: "event", type: "cart", id, qty: s.state.cart[id] ? s.state.cart[id].qty : 0 });
  store.saveSession();
  res.json({ state: publicState(s.state) });
});

// Chef note: text and/or voice (base64 audio). Voice files are stored for the kitchen.
app.post("/api/sessions/:sid/notes", (req, res) => {
  const s = session(req, res); if (!s) return;
  const { id, note, transcript, audio, mime, keepVoice } = req.body || {};
  if (id !== "__order" && !E.ITEM[id]) return res.status(400).json({ error: "UNKNOWN_ITEM" });
  let voice = null;
  if (audio) {
    const ext = /ogg/.test(mime || "") ? "ogg" : /mp4|m4a|aac/.test(mime || "") ? "m4a" : /mpeg|mp3/.test(mime || "") ? "mp3" : /wav/.test(mime || "") ? "wav" : "webm";
    const file = store.saveVoice(Buffer.from(String(audio).split(",").pop(), "base64"), ext);
    voice = { url: "/voice/" + file, transcript: String(transcript || "").slice(0, 500) };
  } else if (keepVoice) {
    voice = id === "__order" ? s.state.orderVoice : (s.state.cart[id] && s.state.cart[id].voice) || null;
  }
  E.setNote(s.state, id, String(note || "").slice(0, 300), voice);
  store.log(s.id, { role: "event", type: "chef-note", id, note: note || "", voice: voice ? voice.url : null, transcript: voice ? voice.transcript : "" });
  store.saveSession();
  res.json({ state: publicState(s.state) });
});

app.post("/api/sessions/:sid/orders", (req, res) => {
  const s = session(req, res); if (!s) return;
  try {
    const { order, messages } = E.placeOrder(s.state, req.body || {});
    store.log(s.id, { role: "event", type: "order-placed", orderNo: order.no, total: order.bill.total });
    reply(res.status(201), s, messages);
  } catch (e) {
    if (e.message === "EMPTY_CART") return res.status(400).json({ error: "EMPTY_CART", message: "Your cart is empty." });
    throw e;
  }
});

// Polled by the frontend: moves the order through its stages and returns new chat messages.
app.get("/api/sessions/:sid/progress", (req, res) => {
  const s = session(req, res); if (!s) return;
  reply(res, s, E.advanceOrder(s.state, Date.now()));
});

// Kitchen display + admin views
app.get("/api/kitchen/orders", (req, res) => res.json({ orders: store.orders().map((o) => Object.assign({ stageLabel: o.stage >= 7 ? "Done" : E.STAGES[o.stage] }, o)) }));
app.get("/api/feedback", (req, res) => res.json({ feedback: store.feedback() }));

app.use("/voice", express.static(store.VOICE_DIR, { maxAge: "1h" }));

// The backend can also serve the frontend (one URL), while the frontend stays a separate app.
const FRONTEND = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(FRONTEND));

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") return res.status(400).json({ error: "BAD_REQUEST", message: "The request body is not valid JSON." });
  console.error(err); res.status(500).json({ error: "SERVER_ERROR", message: "Something went wrong on the server." }); });

if (require.main === module) {
  app.listen(PORT, () => console.log(`NASH Dhabha API listening on http://localhost:${PORT}`));
  process.on("SIGINT", () => { store.flush(); process.exit(0); });
  process.on("SIGTERM", () => { store.flush(); process.exit(0); });
}
module.exports = app;
