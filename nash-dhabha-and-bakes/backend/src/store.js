/**
 * Small JSON-file store. Keeps everything in memory and writes it to
 * data/db.json (debounced). Good for a single-instance restaurant app;
 * swap for Postgres/SQLite when you need several servers.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const VOICE_DIR = path.join(DATA_DIR, "voice");
fs.mkdirSync(VOICE_DIR, { recursive: true });

let db = { sessions: {}, orders: [], feedback: [] };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, "utf8"))); } catch (e) { /* first run */ }

let timer = null;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    fs.writeFile(DB_FILE + ".tmp", JSON.stringify(db, null, 2), (err) => {
      if (!err) fs.rename(DB_FILE + ".tmp", DB_FILE, () => {});
    });
  }, 150);
}
function flush() { clearTimeout(timer); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

const id = () => crypto.randomUUID();

module.exports = {
  VOICE_DIR,
  newSession(state) {
    const s = { id: id(), createdAt: Date.now(), state, transcript: [] };
    db.sessions[s.id] = s; persist(); return s;
  },
  getSession(sid) { return db.sessions[sid] || null; },
  log(sid, entry) {
    const s = db.sessions[sid]; if (!s) return;
    s.transcript.push(Object.assign({ at: Date.now() }, entry)); persist();
  },
  saveSession() { persist(); },
  upsertOrder(sessionId, order) {
    const i = db.orders.findIndex((o) => o.no === order.no);
    const rec = Object.assign({ sessionId }, JSON.parse(JSON.stringify(order)));
    if (i >= 0) db.orders[i] = rec; else db.orders.push(rec);
    if (order.feedback && !db.feedback.find((f) => f.orderNo === order.no)) db.feedback.push(Object.assign({ orderNo: order.no, customer: order.customer }, order.feedback));
    persist();
  },
  orders() { return db.orders.slice().reverse(); },
  feedback() { return db.feedback.slice().reverse(); },
  saveVoice(buf, ext) {
    const name = id() + "." + ext;
    fs.writeFileSync(path.join(VOICE_DIR, name), buf);
    return name;
  },
  flush
};
