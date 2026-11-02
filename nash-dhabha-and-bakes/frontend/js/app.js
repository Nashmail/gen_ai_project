/* NASH Dhabha & Bakes — frontend app (vanilla JS, no build step) */
(async function () {
  "use strict";
  const E = window.NashEngine;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  const rs = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const markHtml = (veg) => `<span class="mark${veg ? "" : " nv"}" title="${veg ? "Veg" : "Non-veg"}"></span>`;
  const ui = { diet: "all", search: "", tts: false };
  let API = null;
  let ST = { name: "", cart: { lines: [], count: 0, bill: E.bill(0), orderNote: "", orderVoice: null }, order: null };
  const qtyOf = (id) => { const l = ST.cart.lines.find((x) => x.id === id); return l ? l.qty : 0; };
  const lineOf = (id) => ST.cart.lines.find((x) => x.id === id);
  $("#year").textContent = new Date().getFullYear();

  /* ================= CHAT ================= */
  const msgs = $("#msgs");
  const scrollDown = () => { msgs.scrollTop = msgs.scrollHeight; };
  const clearChips = () => $$(".chips", msgs).forEach((c) => c.remove());
  function userBubble(text, voice) {
    clearChips();
    const d = document.createElement("div"); d.className = "msg me";
    d.innerHTML = (voice ? '<span class="via">Voice · transcribed</span>' : "") + esc(text);
    msgs.appendChild(d); scrollDown();
  }
  function itemsHtml(items) {
    return `<div class="mini">${items.map((i) => `<div class="mini-item">${markHtml(i.veg)}<span class="nm">${i.qty ? i.qty + " × " : ""}${esc(i.name)}<small>${i.note ? "Chef note: " + esc(i.note) : esc(i.cat) + (i.spice ? " · " + esc(i.spice) : "")}</small>${i.desc && !i.qty ? `<em class="dd">${esc(i.desc)}</em>` : ""}</span><span class="pr">${rs(i.price)}</span>${i.add ? `<button class="mini-add" type="button" data-chat-add="${esc(i.id)}">Add</button>` : ""}</div>`).join("")}</div>`;
  }
  function billHtml(b) {
    const d = new Date(b.at);
    return `<div class="receipt"><div class="rh"><b>NASH DHABHA &amp; BAKES</b><br>Bill ${esc(b.no)} · ${d.toLocaleDateString("en-IN")} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}<br>${b.mode === "dine" ? "Dine-in · Table " + esc(b.table || "-") : "Takeaway"}${b.customer ? " · " + esc(b.customer) : ""}</div><table>
      ${b.lines.map((l) => `<tr><td>${l.qty} × ${esc(l.name)}</td><td>${rs(l.amount)}</td></tr>`).join("")}
      <tr class="sep"><td>Subtotal</td><td>${rs(b.sub)}</td></tr><tr><td>CGST 2.5%</td><td>${rs(b.cgst)}</td></tr><tr><td>SGST 2.5%</td><td>${rs(b.sgst)}</td></tr>
      ${b.round ? `<tr><td>Round off</td><td>${b.round > 0 ? "+" : ""}${b.round.toFixed(2)}</td></tr>` : ""}
      <tr class="sep tot"><td>Total</td><td>${rs(b.total)}</td></tr></table></div>`;
  }
  function botBubble(m, opts) {
    const live = !opts || !opts.replay;
    const d = document.createElement("div"); d.className = "msg bot";
    d.innerHTML = md(m.text) + (m.items && m.items.length ? itemsHtml(m.items) : "") + (m.bill ? billHtml(m.bill) : "") + (m.noteFor ? `<div class="row" style="margin-top:8px"><button class="mini-add note-open" type="button" data-note-open="${esc(m.noteFor)}">🎙 Record voice note</button></div>` : "") + (m.source ? `<span class="src${m.ai ? " ai" : ""}">${m.ai ? "✦ " : "Source: "}${esc(m.source)}</span>` : "");
    msgs.appendChild(d);
    if (m.chips && m.chips.length && live) {
      const c = document.createElement("div"); c.className = "chips";
      m.chips.forEach((t) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = t; b.onclick = () => send(t); c.appendChild(b); });
      msgs.appendChild(c);
    }
    scrollDown();
    if (live) speak(m.text.replace(/\*\*/g, ""));
    if (live && m.action && m.action.type === "navigate") setTimeout(() => { closeDrawer(); location.hash = m.action.to; }, 700);
  }
  const render = (m, opts) => (m.role === "user" ? userBubble(m.text, m.voice) : m.role === "bot" ? botBubble(m, opts) : null);
  let typingEl = null;
  function typing(on) {
    if (on && !typingEl) { typingEl = document.createElement("div"); typingEl.className = "msg bot typing"; typingEl.innerHTML = "<i></i><i></i><i></i>"; msgs.appendChild(typingEl); scrollDown(); }
    if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  }
  let busy = Promise.resolve();
  function send(text, voice) {
    text = String(text || "").trim(); if (!text) return;
    userBubble(text, voice); typing(true);
    busy = busy.then(async () => {
      try {
        const [r] = await Promise.all([API.chat(text, voice), sleep(350)]);
        typing(false); r.messages.forEach((m) => render(m)); applyState(r.state);
      } catch (e) { typing(false); botBubble({ text: e.code === "SESSION_NOT_FOUND" ? "Your chat session expired. Refresh the page to start again." : "I couldn't reach the kitchen server. Check your connection and try again." }); }
    });
  }
  $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#chat-text"); const v = i.value; i.value = ""; send(v, false); });
  msgs.addEventListener("click", async (e) => {
    const nb = e.target.closest("[data-note-open]"); if (nb) { openNote(nb.dataset.noteOpen); return; }
    const b = e.target.closest("[data-chat-add]"); if (!b) return;
    b.disabled = true; b.textContent = "Added";
    await changeQty(b.dataset.chatAdd, qtyOf(b.dataset.chatAdd) + 1, true);
  });

  /* order tracker inside the chat */
  function renderTracker() {
    const o = ST.order, el = $("#tracker");
    if (!o) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="tracker-title"><span>Order <b>${esc(o.no)}</b> · ${o.mode === "dine" ? "Dine-in, table " + esc(o.table || "-") : "Takeaway"}</span><b>${rs(o.bill.total)}</b></div>` +
      E.STAGES.map((s, i) => `<span class="step ${i < o.stage ? "done" : i === o.stage ? "now" : ""}">${s}</span>`).join("");
  }
  let pollT = null;
  function ensurePolling() {
    const need = ST.order && !ST.order.paid && ST.order.stage < 4;
    if (need && !pollT) pollT = setInterval(poll, 1000);
    if (!need && pollT) { clearInterval(pollT); pollT = null; }
  }
  async function poll() {
    try { const r = await API.progress(); r.messages.forEach((m) => render(m)); applyState(r.state); } catch (e) { /* retry on next tick */ }
  }

  /* ================= STATE ================= */
  function applyState(state) {
    if (!state) return;
    ST = state;
    const n = ST.cart.count;
    $("#cart-count").textContent = n;
    $("#bar-count").textContent = n + (n === 1 ? " item" : " items");
    $("#bar-total").textContent = rs(ST.cart.bill.sub);
    const bar = n > 0 && cur() === "menu";
    $("#cartbar").hidden = !bar; document.body.classList.toggle("has-bar", bar);
    $$("[data-ctl]").forEach((el) => (el.innerHTML = ctlHtml(el.dataset.ctl)));
    $$("[data-flag]").forEach((el) => (el.innerHTML = flagHtml(el.dataset.flag)));
    if (cur() === "checkout") renderCheckout();
    renderTracker(); ensurePolling();
  }
  async function changeQty(id, qty, announce) {
    try {
      const had = qtyOf(id);
      const r = await API.setQty(id, qty); applyState(r.state);
      if (announce || (!had && qty > 0)) toast(E.ITEM[id].name + " added to cart");
    } catch (e) { toast("Couldn't update the cart. Try again."); }
  }

  /* ================= MENU ================= */
  const icon = (cat) => `<svg><use href="#c-${cat}"/></svg>`;
  function renderHomeCats() {
    $("#cat-grid").innerHTML = E.CATS.map((c) => `<a class="cat-card" href="#menu" data-jump="cat-${c.id}" data-cat="${c.id}"><span class="ci">${icon(c.id)}</span><b>${esc(c.label)}</b><small>${E.MENU.filter((i) => i.cat === c.id).length} dishes</small></a>`).join("");
  }
  function ctlHtml(id) {
    const q = qtyOf(id);
    return q ? `<span class="stepper"><button type="button" data-dec="${id}" aria-label="One less">−</button><span>${q}</span><button type="button" data-inc="${id}" aria-label="One more">+</button></span>` : `<button class="add" type="button" data-inc="${id}">Add</button>`;
  }
  function flagHtml(id) {
    const l = lineOf(id); if (!l || (!l.note && !l.voice)) return "";
    return `<span class="note-flag">To chef: ${l.note ? "“" + esc(l.note) + "”" : ""}${l.voice ? (l.note ? " + " : "") + "voice note" : ""}</span>`;
  }
  function dishCard(i) {
    return `<article class="dish" data-cat="${i.cat}"><div class="thumb">${icon(i.cat)}<span class="tag">${markHtml(i.veg)}${i.veg ? "Veg" : "Non-veg"}</span>${i.spice ? `<span class="spice">${E.SPICE[i.spice]}</span>` : ""}</div>
      <div class="dish-body"><h3>${esc(i.name)}</h3><p>${esc(i.desc)}</p>
      <div class="dish-foot"><span class="price">${rs(i.price)}</span><span data-ctl="${i.id}">${ctlHtml(i.id)}</span></div>
      <button class="note-btn" type="button" data-note="${i.id}"><svg><use href="#i-chef"/></svg>Chef note</button><span data-flag="${i.id}">${flagHtml(i.id)}</span></div></article>`;
  }
  function renderMenu() {
    const q = E.norm(ui.search);
    const filt = (i) => (ui.diet === "all" || (ui.diet === "veg" ? i.veg : !i.veg)) && (!q || E.norm(i.name + " " + i.desc + " " + E.CATNAME[i.cat]).includes(q));
    let shown = 0;
    $("#cat-nav").innerHTML = E.CATS.map((c) => `<a href="#menu" data-jump="cat-${c.id}" data-navcat="${c.id}">${esc(c.label)}<span>${E.MENU.filter((i) => i.cat === c.id && filt(i)).length}</span></a>`).join("");
    $("#menu-body").innerHTML = E.CATS.map((c) => {
      const items = E.MENU.filter((i) => i.cat === c.id && filt(i)); shown += items.length;
      if (!items.length) return "";
      return `<section class="cat-sec" id="cat-${c.id}" data-cat="${c.id}"><div class="cat-title"><span class="ci">${icon(c.id)}</span><div><h2>${esc(c.label)}</h2><p>${esc(c.blurb)}</p></div></div><div class="dish-grid">${items.map(dishCard).join("")}</div></section>`;
    }).join("");
    $("#menu-empty").hidden = shown > 0;
    observeSections();
  }
  let io = null;
  function observeSections() {
    if (io) io.disconnect();
    if (!("IntersectionObserver" in window)) return;
    io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) $$("[data-navcat]").forEach((a) => a.classList.toggle("active", a.dataset.navcat === en.target.dataset.cat)); });
    }, { rootMargin: "-30% 0px -60% 0px" });
    $$(".cat-sec").forEach((s) => io.observe(s));
  }
  $$(".seg button").forEach((b) => b.addEventListener("click", () => { ui.diet = b.dataset.diet; $$(".seg button").forEach((x) => x.setAttribute("aria-pressed", x === b)); renderMenu(); }));
  $("#menu-search").addEventListener("input", (e) => { ui.search = e.target.value; renderMenu(); });

  document.addEventListener("click", (e) => {
    const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]"), nt = e.target.closest("[data-note]"), j = e.target.closest("[data-jump]");
    if (inc) changeQty(inc.dataset.inc, qtyOf(inc.dataset.inc) + 1);
    if (dec) changeQty(dec.dataset.dec, qtyOf(dec.dataset.dec) - 1);
    if (nt) openNote(nt.dataset.note);
    if (j) {
      e.preventDefault();
      const go = () => { const el = document.getElementById(j.dataset.jump); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); };
      if (cur() !== "menu") { location.hash = "menu"; setTimeout(go, 120); } else go();
    }
  });

  /* ================= CHECKOUT ================= */
  const coForm = { mode: "dine", table: "5", name: "" };
  function renderCheckout() {
    const body = $("#co-body"), c = ST.cart;
    const nameEl = $("#co-name"); if (nameEl) { coForm.name = nameEl.value; coForm.table = $("#co-table").value; coForm.mode = ($("input[name=mode]:checked") || {}).value || "dine"; }
    if (!c.lines.length) {
      body.innerHTML = `<div class="card empty" style="margin-block:28px 80px"><b>Your cart is empty</b><p>${ST.order && !ST.order.paid ? "Order " + esc(ST.order.no) + " is in progress. Follow it in the chat on the home page." : "Add dishes from the menu or ask Masala Mitra in the chat."}</p><div class="row" style="justify-content:center"><a class="btn btn-primary" href="#menu">Browse menu</a><a class="btn btn-ghost" href="#home">Chat with Masala Mitra</a></div></div>`;
      return;
    }
    const b = c.bill, ov = c.orderVoice;
    body.innerHTML = `<div class="co-grid"><div>
      <div class="card"><h2>Your order (${c.count} item${c.count > 1 ? "s" : ""})</h2>
        ${c.lines.map((l) => `<div class="line">${markHtml(l.veg)}<div class="nm"><b>${esc(l.name)}</b><small>${rs(l.price)} each</small></div><div class="amt">${rs(l.amount)}</div>
          <div class="sub"><span class="stepper"><button type="button" data-dec="${l.id}" aria-label="One less">−</button><span>${l.qty}</span><button type="button" data-inc="${l.id}" aria-label="One more">+</button></span>
          <button class="note-btn" type="button" data-note="${l.id}"><svg><use href="#i-chef"/></svg>${l.note || l.voice ? "Edit chef note" : "Add chef note"}</button>
          ${l.note || l.voice ? `<span class="note-flag">${l.note ? "“" + esc(l.note) + "”" : ""}${l.voice ? (l.note ? " + " : "") + "voice note" : ""}</span>` : ""}
          ${l.voice ? `<audio controls preload="none" src="${esc(API.voiceUrl(l.voice))}"></audio>` : ""}</div></div>`).join("")}
      </div>
      <div class="card"><h2>Order details</h2>
        <div class="opt-row" role="radiogroup" aria-label="Order type"><label class="opt"><input type="radio" name="mode" value="dine" id="mode-dine"><span>Dine-in</span></label><label class="opt"><input type="radio" name="mode" value="take" id="mode-take"><span>Takeaway</span></label></div>
        <label class="field" id="table-field">Table number<input id="co-table" inputmode="numeric" maxlength="4"></label>
        <label class="field">Name on the bill<input id="co-name" placeholder="Your name" maxlength="40"></label>
        <div class="field">Note for the chef (whole order)
          <div class="row"><button class="btn btn-ghost" type="button" data-note="__order"><svg><use href="#i-chef"/></svg>${c.orderNote || ov ? "Edit note" : "Add note or voice note"}</button></div>
          ${c.orderNote || ov ? `<span class="note-flag">${c.orderNote ? "“" + esc(c.orderNote) + "”" : ""}${ov ? (c.orderNote ? " + " : "") + "voice note" : ""}</span>` : ""}
          ${ov ? `<audio controls preload="none" src="${esc(API.voiceUrl(ov))}"></audio>` : ""}
        </div>
      </div></div>
      <aside class="card summary"><h2>Bill summary</h2>
        <div class="sum"><div><span>Subtotal</span><span>${rs(b.sub)}</span></div><div><span>CGST 2.5%</span><span>${rs(b.cgst)}</span></div><div><span>SGST 2.5%</span><span>${rs(b.sgst)}</span></div>${b.round ? `<div><span>Round off</span><span>${b.round > 0 ? "+" : ""}${b.round.toFixed(2)}</span></div>` : ""}<div class="grand"><span>Total</span><span>${rs(b.total)}</span></div></div>
        <button class="btn btn-accent btn-lg place" id="place-btn" type="button">Place order · ${rs(b.total)}</button>
        <p class="fine">After you place the order, Masala Mitra updates you in the chat, then shares the bill and payment options.</p>
      </aside></div>`;
    $(`input[name=mode][value=${coForm.mode}]`).checked = true;
    $("#co-table").value = coForm.table; $("#co-name").value = coForm.name || ST.name || "";
    const syncT = () => { $("#table-field").hidden = ($("input[name=mode]:checked") || {}).value !== "dine"; };
    syncT(); $$("input[name=mode]").forEach((r) => r.addEventListener("change", syncT));
    $("#place-btn").addEventListener("click", placeOrder);
  }
  async function placeOrder() {
    const btn = $("#place-btn"); btn.disabled = true;
    const details = { mode: ($("input[name=mode]:checked") || {}).value || "dine", table: $("#co-table").value.trim(), name: $("#co-name").value.trim() };
    if (details.mode === "dine" && !details.table) { toast("Enter your table number"); btn.disabled = false; $("#co-table").focus(); return; }
    try {
      const r = await API.order(details);
      location.hash = "home";
      await sleep(250);
      r.messages.forEach((m) => render(m)); applyState(r.state);
      toast("Order placed");
    } catch (e) { btn.disabled = false; toast(e.message || "Couldn't place the order. Try again."); }
  }

  /* ================= KITCHEN ================= */
  async function renderKitchen() {
    const body = $("#kitchen-body");
    let data;
    try { data = await API.kitchen(); } catch (e) { body.innerHTML = `<div class="card empty" style="margin-block:28px"><b>Can't reach the kitchen server</b><p>Check the backend and press Refresh.</p></div>`; return; }
    if (!data.orders.length) { body.innerHTML = `<div class="card empty" style="margin-block:28px 80px"><b>No orders yet</b><p>Orders appear here as soon as a guest places one.</p></div>`; return; }
    const vn = (v) => (v ? `<audio controls preload="none" src="${esc(API.voiceUrl(v))}"></audio>${v.transcript ? `<span class="cnote">Transcript: “${esc(v.transcript)}”</span>` : ""}` : "");
    body.innerHTML = `<div class="k-grid">${data.orders.map((o) => `<article class="ticket"><div class="ticket-head"><div><b>${esc(o.no)}</b><small>${new Date(o.placedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · ${o.mode === "dine" ? "Table " + esc(o.table || "-") : "Takeaway"}${o.customer ? " · " + esc(o.customer) : ""}</small></div><span class="stage-pill ${o.paid ? "paid" : ""}">${esc(o.stageLabel)}</span></div>
      <ul>${o.items.map((x) => `<li><div><span class="qty">${x.qty}×</span>${markHtml(x.veg)}<span>${esc(x.name)}</span></div>${x.note ? `<span class="cnote">Chef note: “${esc(x.note)}”</span>` : ""}${vn(x.voice)}</li>`).join("")}
      ${o.note || o.voice ? `<li><div><b>Whole order</b></div>${o.note ? `<span class="cnote">“${esc(o.note)}”</span>` : ""}${vn(o.voice)}</li>` : ""}</ul>
      <div class="ticket-foot"><span>Total ${rs(o.bill.total)}${o.payment ? " · " + esc(o.payment.method) : ""}</span><span>${o.feedback ? "★".repeat(o.feedback.stars) + " feedback" : ""}</span></div></article>`).join("")}</div>`;
  }
  $("#kitchen-refresh").addEventListener("click", renderKitchen);
  let kT = null;

  /* ================= VOICE ================= */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function dictate({ onText, onEnd, onError, continuous }) {
    if (!SR) { onError && onError("unsupported"); return null; }
    let r; try { r = new SR(); } catch (e) { onError && onError("unsupported"); return null; }
    r.lang = "en-IN"; r.interimResults = true; r.continuous = !!continuous;
    r.onresult = (e) => { let s = ""; for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript; onText(s); };
    r.onerror = (e) => onError && onError(e.error);
    r.onend = () => onEnd && onEnd();
    try { r.start(); } catch (e) { onError && onError("start"); return null; }
    return r;
  }
  let chatRec = null;
  $("#mic-btn").addEventListener("click", () => {
    const btn = $("#mic-btn"), inp = $("#chat-text");
    if (chatRec) { chatRec.stop(); return; }
    let heard = "", failed = false;
    btn.classList.add("on"); inp.placeholder = "Listening… speak now";
    const reset = () => { btn.classList.remove("on"); inp.placeholder = "Say hi, or ask for a dish…"; chatRec = null; };
    chatRec = dictate({
      onText: (s) => { heard = s; inp.value = s; },
      onEnd: () => { reset(); if (!failed && heard.trim()) { inp.value = ""; send(heard, true); } },
      onError: (err) => {
        failed = true; reset();
        botBubble({ text: err === "unsupported" ? "Voice input isn't supported in this browser. Please type, or open the app in Chrome or Edge to speak." : err === "no-speech" ? "I didn't catch that. Tap the mic and try again." : err === "network" ? "Voice recognition needs an internet connection. Check your connection and try again." : "The microphone is blocked on this page. If you're in the Claude preview, open the app in Chrome or Edge to talk to me. Otherwise allow microphone access in your browser settings. You can always type." });
      }
    });
  });
  function speak(s) { if (!ui.tts || !window.speechSynthesis) return; try { const u = new SpeechSynthesisUtterance(s.replace(/₹/g, "rupees ").slice(0, 400)); u.lang = "en-IN"; speechSynthesis.speak(u); } catch (e) {} }
  $("#tts-btn").addEventListener("click", (e) => { ui.tts = !ui.tts; e.currentTarget.setAttribute("aria-pressed", ui.tts); if (!ui.tts && window.speechSynthesis) speechSynthesis.cancel(); toast(ui.tts ? "Masala Mitra will read replies aloud" : "Read-aloud off"); });

  /* ================= CHEF NOTE MODAL ================= */
  let noteFor = null, rec = null, draft = null;
  function openNote(id) {
    noteFor = id;
    const isOrder = id === "__order", l = lineOf(id);
    const note = isOrder ? ST.cart.orderNote : l ? l.note : "";
    const v = isOrder ? ST.cart.orderVoice : l ? l.voice : null;
    $("#note-title").textContent = isOrder ? "Note for the chef" : "Chef note · " + E.ITEM[id].name;
    $("#note-sub").textContent = isOrder ? "Anything the chef should know about the whole order: allergies, spice level, timing." : "Type it or record a voice note. It goes to the chef with this dish." + (l ? "" : " The dish will be added to your cart.");
    $(".rec-phone").classList.remove("btn-primary");
    $("#note-text").value = note || ""; draft = v ? { keep: true, url: API.voiceUrl(v) } : null;
    showDraft(); $("#rec-status").textContent = ""; $("#rec-file").value = "";
    $("#note-modal").hidden = false; setTimeout(() => $("#note-text").focus(), 50);
  }
  function showDraft() { const a = $("#rec-audio"); if (draft) { a.src = draft.url; a.hidden = false; $("#rec-clear").hidden = false; } else { a.removeAttribute("src"); a.hidden = true; $("#rec-clear").hidden = true; } }
  function closeNote() { stopRec(); $("#note-modal").hidden = true; noteFor = null; }
  async function startRec() {
    const st = $("#rec-status"), btn = $("#rec-btn");
    if (!navigator.mediaDevices || !window.MediaRecorder) { st.textContent = "Recording isn't supported in this browser. Type your note or attach an audio file."; return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) {
      st.textContent = "This page isn't allowed to use the microphone here. Tap “Record with your phone's recorder” below instead, or allow the mic in your browser settings.";
      $(".rec-phone").classList.add("btn-primary"); $(".rec-phone").focus();
      return;
    }
    const mr = new MediaRecorder(stream), chunks = [], base = $("#note-text").value.trim();
    let said = "";
    const done = new Promise((ok) => {
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" }); draft = { blob, url: URL.createObjectURL(blob), transcript: said }; showDraft(); st.textContent = said ? "Voice note saved and transcribed." : "Voice note saved."; ok(); };
    });
    mr.start();
    const sr = dictate({ continuous: true, onText: (s) => { said = s.trim(); $("#note-text").value = (base ? base + " " : "") + said; }, onError: () => {} });
    rec = { mr, sr, done }; btn.classList.add("rec"); btn.querySelector("span").textContent = "Stop recording"; st.textContent = "Recording… speak your note.";
  }
  function stopRec() {
    if (!rec) return Promise.resolve();
    const r = rec; rec = null;
    try { if (r.mr.state !== "inactive") r.mr.stop(); } catch (e) {}
    try { r.sr && r.sr.stop(); } catch (e) {}
    const b = $("#rec-btn"); b.classList.remove("rec"); b.querySelector("span").textContent = "Record voice note";
    return r.done;
  }
  $("#rec-btn").addEventListener("click", () => (rec ? stopRec() : startRec()));
  $("#rec-clear").addEventListener("click", () => { draft = null; showDraft(); });
  $("#rec-file").addEventListener("change", (e) => { const f = e.target.files[0]; if (!f) return; draft = { blob: f, url: URL.createObjectURL(f), transcript: "" }; showDraft(); $("#rec-status").textContent = "Attached " + f.name; });
  $("#note-cancel").addEventListener("click", closeNote);
  $("#note-x").addEventListener("click", closeNote);
  $("#note-modal").addEventListener("click", (e) => { if (e.target.id === "note-modal") closeNote(); });
  $("#note-save").addEventListener("click", async () => {
    const btn = $("#note-save"); btn.disabled = true;
    await stopRec();
    const id = noteFor, txt = $("#note-text").value.trim();
    try {
      const r = await API.note(id, txt, draft ? (draft.blob ? { blob: draft.blob, transcript: draft.transcript } : { keep: true }) : null);
      applyState(r.state); closeNote();
      toast(txt || draft ? "Note sent to the chef" : "Note cleared");
    } catch (e) { toast("Couldn't save the note. Try again."); }
    btn.disabled = false;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if (!$("#note-modal").hidden) closeNote(); else closeDrawer(); } });

  /* ================= ROUTING ================= */
  const VIEWS = ["home", "menu", "checkout", "kitchen"];
  const cur = () => { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : "home"; };
  function route() {
    const v = cur();
    VIEWS.forEach((x) => ($("#view-" + x).hidden = x !== v));
    $$("[data-nav]").forEach((a) => { if (a.dataset.nav === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    closeDrawer();
    if (v === "home") $("#home-slot").appendChild($("#chat"));
    $("#fab").hidden = v === "home";
    if (v === "checkout") renderCheckout();
    clearInterval(kT); if (v === "kitchen") { renderKitchen(); kT = setInterval(renderKitchen, 4000); }
    applyState(ST);
    window.scrollTo(0, 0); scrollDown();
  }
  function openDrawer() { $("#drawer-slot").appendChild($("#chat")); $("#drawer").hidden = false; $("#scrim").hidden = false; scrollDown(); setTimeout(() => $("#chat-text").focus(), 50); }
  function closeDrawer() { if ($("#drawer").hidden) return; $("#drawer").hidden = true; $("#scrim").hidden = true; if (cur() === "home") $("#home-slot").appendChild($("#chat")); }
  $("#fab").addEventListener("click", openDrawer);
  $("#scrim").addEventListener("click", closeDrawer);
  $("#drawer-close").addEventListener("click", closeDrawer);
  $("#focus-chat").addEventListener("click", () => { $("#chat").scrollIntoView({ behavior: "smooth", block: "center" }); $("#chat-text").focus(); });
  window.addEventListener("hashchange", route);
  let tt; function toast(s) { const t = $("#toast"); t.textContent = s; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 2000); }

  /* ================= BOOT ================= */
  renderHomeCats(); renderMenu(); route();
  API = await window.NashAPI.connect();
  $("#conn-dot").className = "dot " + API.mode;
  const setLabel = () => {
    const ai = API.mode === "live" ? !!API.llm : !!window.NashAPI.AI.key();
    $("#conn-label").textContent = API.mode === "live" ? (ai ? "Online · Gemini + our menu" : "Online · answers from our menu") : (ai ? "Gemini + our menu · in your browser" : "Answers from our menu · runs in your browser");
    $("#ai-btn").setAttribute("aria-pressed", ai);
  };
  setLabel();
  /* AI settings (Google Gemini) */
  $("#ai-btn").addEventListener("click", () => {
    const live = API.mode === "live";
    $("#ai-form").hidden = live; $("#ai-actions").hidden = live;
    const st = $("#ai-status"); st.className = "status";
    if (live) st.textContent = API.llm ? `Connected on the server: ${API.llm.model}. Every menu answer is written by Gemini from our menu.` : "Not set up on this server. The owner adds GEMINI_API_KEY to the backend settings. Until then, the built-in answers are used.";
    else { $("#ai-key").value = window.NashAPI.AI.key(); $("#ai-model").value = window.NashAPI.AI.model(); st.textContent = window.NashAPI.AI.key() ? "A key is saved in this browser." : ""; }
    $("#ai-modal").hidden = false;
  });
  const closeAI = () => ($("#ai-modal").hidden = true);
  $("#ai-x").addEventListener("click", closeAI);
  $("#ai-modal").addEventListener("click", (e) => { if (e.target.id === "ai-modal") closeAI(); });
  $("#ai-remove").addEventListener("click", () => { window.NashAPI.AI.save("", null); $("#ai-key").value = ""; const st = $("#ai-status"); st.className = "status"; st.textContent = "Key removed. Built-in answers are used."; setLabel(); });
  $("#ai-save").addEventListener("click", async () => {
    const key = $("#ai-key").value.trim(), st = $("#ai-status"), btn = $("#ai-save");
    if (!key) { st.className = "status err"; st.textContent = "Paste your Gemini key first."; return; }
    btn.disabled = true; st.className = "status"; st.textContent = "Checking the key with Google…";
    try {
      const models = await window.NashLLM.testKey(key);
      window.NashAPI.AI.save(key, $("#ai-model").value);
      st.className = "status ok"; st.textContent = `Connected. ${models.length} Gemini models available. Ask Masala Mitra anything.`;
      setLabel(); setTimeout(closeAI, 1400);
    } catch (e) {
      st.className = "status err";
      st.textContent = e instanceof TypeError ? "This page can't reach Google (the Claude preview blocks outside connections). Download the app file and open it in Chrome or Edge." : "Google rejected the key: " + e.message;
    }
    btn.disabled = false;
  });
  try {
    const r = await API.start();
    if (r.resumed) { r.transcript.forEach((m, i, a) => render(m, { replay: i < a.length - 1 || m.role !== "bot" })); }
    else r.messages.forEach((m) => render(m));
    applyState(r.state);
  } catch (e) { botBubble({ text: "I couldn't start the chat. Refresh the page to try again." }); }
  window.__nash = { get state() { return ST; }, get mode() { return API.mode; } };
})();
