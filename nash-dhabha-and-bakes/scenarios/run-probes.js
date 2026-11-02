/** Extra edge-case probes run directly against the shared engine. Results: scenarios/results/extra-probes.json */
const fs = require("fs"), path = require("path");
const E = require("../shared/engine");
const PROBES = [
  { setup: ["hi", "Meena", "happy"], input: "I want something not spicy", expect: "Mild or non-spicy dishes", verdict: (o) => !/Chicken 65|Chettinad|Kolhapuri/.test(o) },
  { input: "add 3 butter naans", expect: "3 × Butter Naan added (plural handled)", verdict: (o) => /3 × Butter Naan/.test(o) },
  { input: "cancel my order", expect: "Cancel the order or explain how", verdict: (o) => /cancel/i.test(o) },
  { input: "enaku biryani venum", expect: "Biryani options (Tamil-English)", verdict: (o) => /Biryani/.test(o) },
  { input: "do you deliver to my home?", expect: "A delivery answer", verdict: (o) => /deliver/i.test(o) },
  { input: "what is the cheapest dessert?", expect: "Gulab Jamun (₹90), the cheapest dessert", verdict: (o) => /^.*Gulab Jamun/.test(o.split("Can I add")[0]) && o.indexOf("Gulab") < o.indexOf("Rice Kheer") },
  { input: "add 100 butter naan", expect: "100 added, or a clear message about the limit", verdict: (o, S) => E.cartView(S).count === 100 || /limit|maximum|max/i.test(o) },
  { input: "where are you located?", expect: "The restaurant address", verdict: (o) => /address|road|street/i.test(o) }
];
const out = PROBES.map((p) => {
  const S = E.createState();
  (p.setup || []).forEach((t) => E.chat(S, t));
  const msgs = E.chat(S, p.input);
  const text = msgs.map((m) => m.text + (m.items ? " [" + m.items.map((i) => `${i.name} ₹${i.price}`).join(", ") + "]" : "")).join(" || ").replace(/\*\*/g, "").replace(/\n/g, " ");
  return { input: p.input, setup: p.setup || [], expected: p.expect, output: text, status: p.verdict(text, S) ? "PASS" : "FAIL" };
});
fs.mkdirSync(path.join(__dirname, "results"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "results", "extra-probes.json"), JSON.stringify(out, null, 2));
out.forEach((r) => console.log(`[${r.status}] ${r.input}\n      ${r.output.slice(0, 160)}`));
