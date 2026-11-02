/* API client with automatic offline fallback.
   Live mode talks to the backend; offline mode runs NashEngine in the browser. Both expose the same methods. */
(function () {
  "use strict";
  const E = window.NashEngine;
  const base = String((window.NASH_CONFIG && window.NASH_CONFIG.apiBase) || "").replace(/\/$/, "");
  const SID_KEY = "nash-session-id";
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

  async function http(method, path, body) {
    const res = await fetch(base + path, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.message || "Request failed"); err.code = data.error || res.status; throw err; }
    return data;
  }
  const blobToDataUrl = (blob) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });

  function Live() {
    let sid = null;
    return {
      mode: "live",
      voiceUrl: (v) => (v && v.url ? (/^(blob:|data:|https?:)/.test(v.url) ? v.url : base + v.url) : ""),
      async start() {
        const saved = store.get(SID_KEY);
        if (saved) {
          try { const r = await http("GET", `/api/sessions/${saved}`); sid = saved; return { resumed: true, transcript: r.transcript, state: r.state }; }
          catch (e) { store.del(SID_KEY); }
        }
        const r = await http("POST", "/api/sessions"); sid = r.sessionId; store.set(SID_KEY, sid);
        return { messages: r.messages, state: r.state };
      },
      chat: (text, voice) => http("POST", `/api/sessions/${sid}/chat`, { text, voice: !!voice }),
      setQty: (id, qty) => http("POST", `/api/sessions/${sid}/cart`, { id, qty }),
      async note(id, note, voice) {
        const body = { id, note };
        if (voice && voice.blob) { body.audio = await blobToDataUrl(voice.blob); body.mime = voice.blob.type; body.transcript = voice.transcript || ""; }
        else if (voice && voice.keep) body.keepVoice = true;
        return http("POST", `/api/sessions/${sid}/notes`, body);
      },
      order: (details) => http("POST", `/api/sessions/${sid}/orders`, details),
      progress: () => http("GET", `/api/sessions/${sid}/progress`),
      kitchen: () => http("GET", "/api/kitchen/orders"),
      staffRequests: () => http("GET", "/api/staff/requests"),
      staffDone: (id) => http("POST", `/api/staff/requests/${encodeURIComponent(id)}`, { status: "done" }),
      staffSummary: () => http("GET", "/api/staff/summary"),
      reset() { store.del(SID_KEY); }
    };
  }

  function Offline() {
    const S = E.createState();
    const orders = [], history = [];
    const pub = () => ({ name: S.name, diet: S.diet, awaiting: S.awaiting, lang: S.lang || "en", table: S.table || null, cart: E.cartView(S), order: S.order });
    const ok = (messages) => Promise.resolve({ messages: messages || [], state: pub() });
    const track = () => { if (S.order) { const i = orders.findIndex((o) => o.no === S.order.no); if (i < 0) orders.unshift(S.order); } };
    return {
      mode: "offline",
      voiceUrl: (v) => (v && v.url) || "",
      start: () => Promise.resolve({ messages: E.welcome(), state: pub() }),
      async chat(text) {
        const prev = history.slice(-6);
        let m = E.chat(S, text);
        const key = AI.key();
        if (key && window.NashLLM && E.LLM_ROUTES.has(m.route)) {
          try {
            const ctx = E.contextFor(S, text, m);
            const ans = await window.NashLLM.ask({ key, model: AI.model(), ctx, history: prev, timeoutMs: 9000 });
            const ai = E.llmApply(S, ans, ctx);
            if (ai) m = ai; else AI.last = "rejected";
            AI.last = ai ? "ok" : "rejected";
          } catch (e) { AI.last = "error: " + e.message; }
        }
        history.push({ role: "user", text }); m.forEach((x) => history.push({ role: "bot", text: x.text }));
        track(); return ok(m);
      },
      setQty(id, qty) { E.setQty(S, id, qty); return ok(); },
      note(id, note, voice) {
        let v = null;
        if (voice && voice.blob) v = { url: URL.createObjectURL(voice.blob), transcript: voice.transcript || "" };
        else if (voice && voice.keep) v = id === "__order" ? S.orderVoice : (S.cart[id] && S.cart[id].voice) || null;
        E.setNote(S, id, note, v); return ok();
      },
      order(details) {
        try { const r = E.placeOrder(S, details); track(); return ok(r.messages); }
        catch (e) { const err = new Error("Your cart is empty."); err.code = e.message; return Promise.reject(err); }
      },
      progress() { return ok(E.advanceOrder(S, Date.now())); },
      kitchen: () => Promise.resolve({ orders: orders.map((o) => Object.assign({ stageLabel: o.cancelled ? "Cancelled" : o.stage >= 7 ? "Done" : E.STAGES[o.stage] }, o)) }),
      staffRequests: () => Promise.resolve({ requests: (S.requests || []).slice().reverse() }),
      staffDone(id) { const r = (S.requests || []).find((x) => x.id === id); if (r) { r.status = "done"; r.doneAt = Date.now(); } return Promise.resolve({ request: r }); },
      staffSummary: () => Promise.resolve(E.satisfaction(orders.filter((o) => o.feedback).map((o) => Object.assign({ customer: o.customer }, o.feedback)).reverse(), S.requests)),
      reset() {}
    };
  }

  async function connect() {
    if (/^https?:$/.test(location.protocol) || base) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 3000);
        const r = await fetch(base + "/api/health", { signal: ctl.signal }); clearTimeout(t);
        const h = r.ok ? await r.json() : null;
        if (h && h.ok) { const l = Live(); l.llm = h.llm; return l; }
      } catch (e) { /* fall through to offline */ }
    }
    return Offline();
  }
  // Bring-your-own Gemini key (offline mode). Stored only in this browser.
  const AI = {
    last: null,
    key: () => store.get("nash-gemini-key") || "",
    model: () => store.get("nash-gemini-model") || (window.NashLLM && window.NashLLM.DEFAULT_MODEL) || "gemini-2.5-flash",
    save(key, model) { if (key) store.set("nash-gemini-key", key.trim()); else store.del("nash-gemini-key"); if (model) store.set("nash-gemini-model", model); }
  };
  window.NashAPI = { connect, AI };
})();
