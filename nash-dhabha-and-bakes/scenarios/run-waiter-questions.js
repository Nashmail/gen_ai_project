/**
 * AI-waiter question bank (sections A–F from the project brief, plus multilingual,
 * the sample conversation and the "never guess, call staff" rule).
 *   node scenarios/run-waiter-questions.js <label>   -> scenarios/results/waiter-questions/<label>.json
 */
const fs = require("fs"), path = require("path");
const E = require("../shared/engine");
const label = process.argv[2] || "latest";

// helpers to put the conversation into a realistic state first
const T0 = Date.now();
function withOrder(S, stageMs) {
  E.chat(S, "add 1 paneer butter masala and 2 butter naan");
  E.placeOrder(S, { mode: "dine", table: "5" }, T0);
  if (stageMs) E.advanceOrder(S, T0 + stageMs);
}
const reqs = (S) => S.requests || [];
const lastReq = (S) => reqs(S)[reqs(S).length - 1] || null;
const has = (re) => (c) => re.test(c.text);
const and = (...f) => (c) => f.every((x) => x(c));
const not = (f) => (c) => !f(c);
const items = (pred) => (c) => c.items.length > 0 && c.items.every(pred);
const incl = (...ids) => (c) => ids.every((id) => c.items.some((i) => i.id === id));
const request = (re, prio) => (c) => { const r = lastReq(c.S); return !!r && re.test(r.type + " " + r.text) && (!prio || r.priority === prio); };
const M = E.ITEM;

const CASES = [
  // A. Greeting and general interaction
  ["A", "Hello!", null, has(/welcome/i)],
  ["A", "How are you?", null, and(has(/doing great|doing well|i'm good/i), has(/help|assist/i))],
  ["A", "What can you do?", null, and(has(/menu/i), has(/recommend|suggest/i), has(/order/i), has(/restaurant|timings|information|info/i))],
  ["A", "Can you help me?", null, and(has(/of course|sure|happy to help/i), not(has(/couldn.t find/i)))],
  ["A", "Where should I sit?", null, and(has(/table/i), request(/seat|table/i))],
  // B. Menu and food
  ["B", "Show me the menu.", null, and(has(/menu/i), (c) => c.msgs.some((m) => m.action && m.action.to === "menu"))],
  ["B", "What is today's special?", null, and(has(/today/i), (c) => c.items.length > 0)],
  ["B", "What is your best-selling food?", null, and(has(/bestseller|popular|most/i), items((i) => i.popular))],
  ["B", "Do you have vegetarian food?", null, and(has(/\byes\b/i), items((i) => i.veg))],
  ["B", "Do you have spicy food?", null, and(has(/\byes\b/i), items((i) => i.spice >= 2))],
  ["B", "Is this food sweet or spicy?", (S) => E.chat(S, "tell me about paneer tikka"), and(has(/paneer tikka/i), has(/medium|spicy/i))],
  ["B", "What is the price of this dish?", (S) => E.chat(S, "tell me about butter chicken"), and(has(/butter chicken/i), has(/₹320/))],
  ["B", "Do you have Jain food?", null, and(has(/jain/i), has(/chef note|staff|request/i))],
  // C. Orders
  ["C", "I want to order food.", null, and(has(/what would you like|tell me|menu/i), not(has(/couldn.t find/i)))],
  ["C", "Can I change my order?", (S) => withOrder(S, 2500), and(has(/change|cart/i), (c) => !c.S.order || c.S.order.cancelled || c.S.order.stage <= 1)],
  ["C", "How long will my food take?", (S) => withOrder(S, 6000), has(/\d+\s*(–|-|to)?\s*\d*\s*minutes?/i)],
  ["C", "Where is my order?", (S) => withOrder(S, 6000), and(has(/NDB-\d+/), has(/cooking|kitchen|chef|ready/i))],
  ["C", "Can I cancel my order?", (S) => withOrder(S, 2500), and(has(/cancel/i), (c) => c.S.order && c.S.order.cancelled === true)],
  ["C", "Can I cancel my order? (already cooking)", (S) => withOrder(S, 6000), and(has(/already|cooking/i), request(/cancel|staff|human/i), (c) => !c.S.order.cancelled)],
  ["C", "Can I get extra water?", null, and(has(/staff|on its way|bring/i), request(/water/i))],
  // D. Customer assistance
  ["D", "Where is the washroom?", null, has(/washroom|restroom/i)],
  ["D", "Where is the drinking water?", null, has(/water/i)],
  ["D", "Can I get an extra chair?", null, request(/chair/i)],
  ["D", "Can I get a spoon?", null, request(/spoon/i)],
  ["D", "Can I speak to a human?", null, and(has(/staff|team member|someone/i), request(/human|staff/i))],
  ["D", "Where is the reception?", null, has(/reception/i)],
  ["D", "I want the waiter to come to my table.", null, and(has(/waiter/i), has(/table number/i), request(/waiter/i))],
  ["D", "table 4 (after calling the waiter)", (S) => E.chat(S, "I want the waiter to come to my table"), and(has(/table 4/i), (c) => lastReq(c.S).table === "4")],
  ["D", "Waiter please, we are at table 6.", null, and(has(/table 6/i), (c) => lastReq(c.S) && lastReq(c.S).type === "waiter" && lastReq(c.S).table === "6")],
  // E. Special requirements and complaints
  ["E", "I'm allergic to peanuts.", null, and(has(/lemon rice/i), has(/staff|confirm/i), request(/allerg/i))],
  ["E", "I don't eat spicy food.", null, items((i) => i.spice <= 1)],
  ["E", "My food is cold.", (S) => withOrder(S, 11000), and(has(/sorry/i), request(/cold|complaint/i, "high"))],
  ["E", "My order is incorrect.", (S) => withOrder(S, 11000), and(has(/sorry/i), request(/incorrect|wrong|complaint/i, "high"))],
  ["E", "The service is slow.", null, and(has(/sorry|apolog/i), request(/slow|complaint/i))],
  ["E", "I need assistance urgently.", null, and(has(/immediately|right away|now/i), request(/urgent|assist|help/i, "urgent"))],
  // F. Payment and feedback
  ["F", "Can I pay by UPI?", null, and(has(/\byes\b/i), has(/UPI/))],
  ["F", "Can I get the bill?", (S) => withOrder(S, 13000), and(has(/bill/i), (c) => c.msgs.some((m) => m.bill))],
  ["F", "Can I get the bill? (not ready yet)", (S) => withOrder(S, 2500), and(has(/bill/i), has(/ready|prepared/i))],
  ["F", "Can I split the bill between 3?", (S) => withOrder(S, 13000), (c) => { const t = c.S.order.bill.total; return new RegExp("₹" + Math.ceil(t / 3)).test(c.text) || new RegExp("₹" + (t / 3).toFixed(2)).test(c.text); }],
  ["F", "How can I give feedback?", null, and(has(/feedback|rate|rating/i), not(has(/couldn.t find/i)))],
  ["F", "Thank you!", null, has(/welcome/i)],
  // Advanced: multilingual
  ["G", "hindi mein baat karo", null, has(/[ऀ-ॿ]/)],
  ["G", "tamil la pesunga", null, has(/[஀-௿]/)],
  ["G", "नमस्ते", null, has(/[ऀ-ॿ]/)],
  ["G", "வணக்கம்", null, has(/[஀-௿]/)],
  // Never guess: hand over to staff
  ["H", "Do you have parking?", null, and(has(/not sure|don.t want to guess|don.t know/i), has(/staff/i))],
  ["H", "yes please (after the staff offer)", (S) => E.chat(S, "Do you have parking?"), request(/parking|question/i)],
];

// Held-out: new wording, written after tuning, run once (--holdout)
const HOLDOUT = [
  ["A", "hey, what all can you help me with?", null, and(has(/menu/i), has(/order/i))],
  ["A", "is there any table free for 4 people?", null, request(/seat|table/i)],
  ["B", "what's special today?", null, and(has(/today/i), (c) => c.items.length > 0)],
  ["B", "how much does this cost?", (S) => E.chat(S, "tell me about chicken 65"), has(/₹260/)],
  ["B", "any jain options?", null, has(/jain/i)],
  ["C", "i changed my mind, cancel the order", (S) => withOrder(S, 2500), (c) => c.S.order && c.S.order.cancelled === true],
  ["C", "how much longer for my food?", (S) => withOrder(S, 6000), has(/minutes/i)],
  ["D", "can you bring some napkins?", null, request(/napkin/i)],
  ["D", "where's the toilet?", null, has(/washroom/i)],
  ["D", "i want to talk to the manager", null, request(/human|staff|manager/i)],
  ["E", "i have a nut allergy", null, and(has(/nuts/i), request(/allerg/i))],
  ["E", "the biryani is too salty", (S) => withOrder(S, 11000), and(has(/sorry/i), request(/complaint|quality|salty/i))],
  ["E", "we've been waiting so long", null, and(has(/apolog|sorry/i), request(/slow|complaint/i))],
  ["F", "can we split it 4 ways", (S) => withOrder(S, 13000), (c) => new RegExp("₹" + Math.ceil(c.S.order.bill.total / 4)).test(c.text)],
  ["F", "do you take card?", null, and(has(/\byes\b/i), has(/card/i))],
  ["G", "mujhe hindi mein baat karni hai", null, has(/[\u0900-\u097F]/)],
  ["H", "do you have wifi?", null, and(has(/not sure|don.t want to guess/i), has(/staff/i))],
];

// The sample conversation from the brief, run as one dialogue
const CONVO = [
  ["Hello", has(/welcome/i)],
  ["Can you suggest a vegetarian dish?", and(has(/paneer butter masala/i), has(/naan/i))],
  ["Yes. Also, is it very spicy?", and(has(/₹260/), has(/mild|not very spicy|lightly/i), has(/milder|kitchen|chef/i))],
  ["Okay, I'll order it.", and(has(/cart|added/i), has(/kitchen|send|place/i))],
  ["yes", has(/table|takeaway/i)],
  ["table 5", and(has(/sent to the kitchen|NDB-\d+/i))],
];

function run(q, setup) {
  const S = E.createState();
  if (setup) setup(S);
  const before = reqs(S).length;
  const msgs = E.chat(S, q.replace(/ \((?:after|already|not ready).*\)$/, ""));
  const seen = new Set(), its = [];
  msgs.forEach((m) => (m.items || []).forEach((r) => { if (!r.qty && !seen.has(r.id) && M[r.id]) { seen.add(r.id); its.push(M[r.id]); } }));
  return { S, msgs, items: its, text: msgs.map((m) => m.text).join("\n").replace(/\*\*/g, ""), newRequests: reqs(S).slice(before) };
}
const SET = process.argv.includes("--holdout") ? HOLDOUT : CASES;
const rows = SET.map(([cat, q, setup, check]) => {
  const c = run(q, setup);
  let ok = false; try { ok = !!check(c); } catch (e) {}
  return { section: cat, question: q, pass: ok, reply: c.text, dishes: c.items.map((i) => i.name), staffRequests: c.newRequests };
});
// conversation
const S = E.createState(); const convo = [];
for (const [q, check] of CONVO) {
  const msgs = E.chat(S, q);
  const text = msgs.map((m) => m.text).join("\n").replace(/\*\*/g, "");
  let ok = false; try { ok = !!check({ text, msgs, S }); } catch (e) {}
  convo.push({ customer: q, waiter: text, pass: ok });
}
const passed = rows.filter((r) => r.pass).length, cpassed = convo.filter((r) => r.pass).length;
const bySection = {};
rows.forEach((r) => { const b = (bySection[r.section] = bySection[r.section] || { passed: 0, total: 0 }); b.total++; if (r.pass) b.passed++; });
const out = path.join(__dirname, "results", "waiter-questions"); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, label + ".json"), JSON.stringify({ label, ranAt: new Date().toISOString(), passed, total: rows.length, bySection, conversation: { passed: cpassed, total: convo.length, turns: convo }, rows }, null, 2));
rows.forEach((r) => { if (!r.pass || process.argv.includes("-v")) console.log(`${r.pass ? "PASS" : "FAIL"} [${r.section}] ${r.question}\n      → ${r.reply.split("\n")[0].slice(0, 110)}`); });
convo.forEach((c) => { if (!c.pass || process.argv.includes("-v")) console.log(`${c.pass ? "PASS" : "FAIL"} [convo] ${c.customer}\n      → ${c.waiter.replace(/\n/g, " ").slice(0, 120)}`); });
console.log(`\n${label}: questions ${passed}/${rows.length} · sample conversation ${cpassed}/${convo.length} · by section ${Object.entries(bySection).map(([k, v]) => k + " " + v.passed + "/" + v.total).join(", ")}`);
if (process.env.CI && (passed < rows.length || cpassed < convo.length)) process.exitCode = 1;
