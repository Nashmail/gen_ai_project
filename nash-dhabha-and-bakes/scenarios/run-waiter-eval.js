/**
 * Waiter evaluation: 50 real customer questions, each with a rule for what a
 * good waiter answer must contain. The rules use the menu itself as ground truth.
 *   node scenarios/run-waiter-eval.js <label>     -> scenarios/results/waiter-eval/<label>.json
 */
const fs = require("fs"), path = require("path");
const E = require("../shared/engine");
const M = E.ITEM;
const label = process.argv[2] || "latest";

// ground truth helpers (independent of the engine's own tagging)
const DRY = new Set(E.MENU.filter((i) => i.cat === "starters").map((i) => i.id).concat(["kadai-paneer"]));
const has = (i, re) => re.test(i.name + " " + i.desc);
const prot = {
  chicken: (i) => has(i, /chicken/i), mutton: (i) => has(i, /mutton|keema/i), fish: (i) => has(i, /\bfish\b/i), prawn: (i) => has(i, /prawn/i),
  egg: (i) => has(i, /\begg\b|contains egg/i), paneer: (i) => has(i, /paneer/i), dal: (i) => has(i, /\bdal\b|lentil/i)
};
const COLD_DESSERT = new Set(["rasmalai-2-pcs", "rice-kheer", "shahi-tukda"]);
const nonEmpty = (it) => it.length > 0;
const all = (f) => (it) => nonEmpty(it) && it.every(f);
const first = (f) => (it) => nonEmpty(it) && f(it[0]);
const includes = (...ids) => (it) => ids.every((id) => it.some((i) => i.id === id));
const and = (...fs) => (it, tx) => fs.every((f) => f(it, tx));
const text = (re) => (it, tx) => re.test(tx);
const noItems = (it) => it.length === 0;
const minPrice = (cat) => Math.min(...E.MENU.filter((i) => i.cat === cat).map((i) => i.price));

const CASES = [
  ["dry non veg", "Only dry non-veg dishes (starters/kebabs), no curries", all((i) => !i.veg && DRY.has(i.id))],
  ["dry veg starters", "Dry veg starters", all((i) => i.veg && DRY.has(i.id))],
  ["something spicy and veg", "Veg dishes that are medium or hot", all((i) => i.veg && i.spice >= 2)],
  ["non veg but not spicy", "Non-veg, mild or not spicy", all((i) => !i.veg && i.spice <= 1)],
  ["mild chicken dish", "Chicken, mild or not spicy", all((i) => prot.chicken(i) && i.spice <= 1)],
  ["cheapest dessert", "Cheapest dessert first", first((i) => i.cat === "desserts" && i.price === minPrice("desserts"))],
  ["biryani under 250", "Biryani priced ₹250 or less", all((i) => i.cat === "biryani" && i.price <= 250)],
  ["veg biryani options", "Only veg biryanis", all((i) => i.veg && i.cat === "biryani")],
  ["do you have fish?", "Yes + both fish dishes", and(includes("kerala-fish-curry", "amritsari-fish"), text(/\byes\b/i))],
  ["do you have pizza?", "Says we don't have it, no dishes pushed", and(noItems, text(/don.t have|couldn.t find|not on our menu/i))],
  ["chicken gravy", "Chicken curries only", all((i) => prot.chicken(i) && i.cat === "gravy")],
  ["mutton dishes", "Mutton dishes only", all((i) => prot.mutton(i))],
  ["something cold to drink", "Cold drinks only", all((i) => i.cat === "juices")],
  ["hot drinks", "Hot drinks only", all((i) => i.cat === "chai")],
  ["eggless cake or pastry", "Eggless cakes/pastries only", all((i) => i.cat === "bakes" && i.veg && /cake|pastry/i.test(i.name))],
  ["what goes with butter chicken", "Breads or rice", all((i) => ["bread", "rice"].includes(i.cat))],
  ["what goes well with biryani", "Raita-style drinks: chaas or lassi", all((i) => i.cat === "juices")],
  ["is butter chicken spicy", "Says it's mild", text(/butter chicken[^.]*\bmild\b|\bmild\b[^.]*butter chicken/i)],
  ["is egg curry veg", "Says it's non-veg", text(/non-veg/i)],
  ["how much is paneer tikka", "Gives ₹250", text(/₹250/)],
  ["what is shahi tukda", "Describes it", text(/fried bread|rabri/i)],
  ["how many gulab jamun in one plate", "2 pieces", text(/\b2\b|two/i)],
  ["what is your bestseller", "Bestseller dishes", all((i) => ["butter-chicken", "chicken-dum-biryani", "dal-makhani", "paneer-butter-masala", "butter-naan", "paneer-tikka", "chicken-65", "hyderabadi-mutton-biryani", "mango-lassi", "gulab-jamun-2-pcs", "masala-chai", "chocolate-truffle-pastry", "tandoori-chicken-half"].includes(i.id))],
  ["something light for dinner", "Light dishes, nothing heavy", all((i) => /light|healthy|soothing/.test(i.tags) && !/filling|hearty|rich/.test(i.tags))],
  ["starters under 200", "Starters ₹200 or less", all((i) => i.cat === "starters" && i.price <= 200)],
  ["any prawn dish", "Prawn Biryani", includes("prawn-biryani")],
  ["paneer dishes", "Paneer dishes only", all((i) => prot.paneer(i))],
  ["i want rice without meat", "Veg rice dishes only", all((i) => i.veg && ["rice", "biryani"].includes(i.cat))],
  ["food for kids", "Not spicy", all((i) => i.spice <= 1)],
  ["veg gravy that is spicy", "Veg curries, medium or hot", all((i) => i.veg && i.cat === "gravy" && i.spice >= 2)],
  ["non veg bread", "Keema Naan", and(includes("keema-naan"), all((i) => i.cat === "bread" && !i.veg))],
  ["chilled dessert", "Cold desserts or ice cream", all((i) => i.cat === "icecream" || COLD_DESSERT.has(i.id))],
  ["dry and spicy chicken", "Dry chicken, medium or hot", all((i) => prot.chicken(i) && DRY.has(i.id) && i.spice >= 2)],
  ["cheap snacks", "Cheapest snack first", first((i) => i.price <= 45)],
  ["most expensive biryani", "Prawn Biryani first", first((i) => i.id === "prawn-biryani")],
  ["do you have dal", "Both dals", includes("dal-makhani", "dal-tadka")],
  ["south indian food", "South Indian dishes", all((i) => /chettinad|kerala|ambur|lemon rice|curd rice|filter coffee|mushroom biryani|65/i.test(i.name))],
  ["is mango lassi cold", "Says it's cold/chilled", text(/cold|chilled/i)],
  ["give me something sweet", "Sweets only", all((i) => ["desserts", "icecream", "bakes"].includes(i.cat) && /sweet/.test(i.tags))],
  ["lassi", "Lassis", all((i) => /lassi/i.test(i.name))],
  ["tea or coffee", "Tea/coffee", all((i) => i.cat === "chai")],
  ["something healthy", "Healthy/light dishes", all((i) => /healthy|light/.test(i.tags))],
  ["non veg starters", "Non-veg starters", all((i) => !i.veg && i.cat === "starters")],
  ["veg main course", "Veg curries", all((i) => i.veg && i.cat === "gravy")],
  ["fish fry", "Amritsari Fish first", first((i) => i.id === "amritsari-fish")],
  ["tandoori items", "Tandoor dishes", all((i) => /tandoor/i.test(i.name + i.desc))],
  ["which biryani is best", "A biryani recommendation", first((i) => i.cat === "biryani")],
  ["I want something with egg", "Egg dishes", all((i) => prot.egg(i))],
  ["what ice creams do you have", "Ice creams/kulfi", all((i) => i.cat === "icecream")],
  ["sweet without egg", "Eggless sweets", all((i) => i.veg && /sweet/.test(i.tags))]
];

// Held-out questions: written after tuning, never used to tune. Run with --holdout.
const HOLDOUT = [
  ["any veg starters that are not spicy", "Veg starters, mild", all((i) => i.veg && i.cat === "starters" && i.spice <= 1)],
  ["kebabs", "Kebabs", all((i) => /kebab/i.test(i.name))],
  ["something chilled and sweet", "Cold sweets", all((i) => (i.cat === "icecream" || i.cat === "juices" || COLD_DESSERT.has(i.id)) && /sweet/.test(i.tags))],
  ["spicy chicken curry", "Chicken curry, medium or hot", all((i) => prot.chicken(i) && i.cat === "gravy" && i.spice >= 2)],
  ["budget veg meal", "Veg, cheapest first", and(all((i) => i.veg), first((i) => i.price <= 60))],
  ["fish curry", "Kerala Fish Curry first", first((i) => i.id === "kerala-fish-curry")],
  ["egg dishes under 200", "Egg dishes ₹200 or less", all((i) => prot.egg(i) && i.price <= 200)],
  ["do you have mutton biryani", "Hyderabadi Mutton Biryani", includes("hyderabadi-mutton-biryani")],
  ["naan options", "Naans", all((i) => /naan/i.test(i.name))],
  ["what drinks do you have", "Drinks", all((i) => ["juices", "chai"].includes(i.cat))],
  ["is chicken 65 very spicy", "Says it's hot", text(/\bhot\b/i)],
  ["how much does hyderabadi mutton biryani cost", "₹380", text(/₹380/)],
  ["is the red velvet pastry eggless", "Says eggless", text(/eggless/i)],
  ["veg dishes for kids", "Veg, mild", all((i) => i.veg && i.spice <= 1)],
  ["paneer starter", "Paneer Tikka", first((i) => i.id === "paneer-tikka")],
  ["something filling and veg", "Veg, filling", all((i) => i.veg && /filling|hearty/.test(i.tags))],
  ["do you have soup", "Says we don't have it", and(noItems, text(/don.t have/i))],
  ["mild biryani", "Mild biryani", all((i) => i.cat === "biryani" && i.spice <= 1)],
  ["coffee", "Filter Coffee", includes("filter-coffee")],
  ["prawns", "Prawn Biryani", includes("prawn-biryani")],
  ["what can I have with naan", "Curries", all((i) => i.cat === "gravy")],
  ["cold coffee", "Says we don't have it (closest options ok)", text(/don.t have/i)],
  ["non veg biryani under 300", "Non-veg biryani ₹300 or less", all((i) => !i.veg && i.cat === "biryani" && i.price <= 300)],
  ["tandoori chicken price", "₹300", text(/₹300/)],
  ["sweet dish without egg under 120", "Eggless sweets ₹120 or less", all((i) => i.veg && /sweet/.test(i.tags) && i.price <= 120)]
];
// Real-world chat-speak, typos and Indian spellings (includes the 4 messages from user testing)
const VEGAN = new Set(["tandoori-roti", "steamed-basmati", "lemon-rice", "chole-masala", "mix-veg-kolhapuri", "crispy-corn", "gobi-65", "fresh-lime-soda", "watermelon-juice", "mosambi-juice", "pineapple-juice"]);
const POP = ["butter-chicken", "chicken-dum-biryani", "dal-makhani", "paneer-butter-masala", "butter-naan", "paneer-tikka", "chicken-65", "hyderabadi-mutton-biryani", "mango-lassi", "gulab-jamun-2-pcs", "masala-chai", "chocolate-truffle-pastry", "tandoori-chicken-half"];
const CHATSPEAK = [
  ["what is spl herre", "House specials (bestsellers)", all((i) => POP.includes(i.id))],
  ["do u hv parota", "Yes + parathas", and(includes("lachha-paratha", "aloo-paratha"), text(/\byes\b/i))],
  ["vegan meat food", "No plant-based meat; vegan dishes only", and(text(/don.t have|no plant|no mock/i), all((i) => VEGAN.has(i.id)))],
  ["sugg any sweet gravy", "Mildly sweet curries (makhani)", and(all((i) => i.cat === "gravy"), includes("paneer-butter-masala"))],
  ["wat r ur specials", "House specials", all((i) => POP.includes(i.id))],
  ["any chiken items", "Chicken dishes", all((i) => prot.chicken(i))],
  ["plz sugst sumthing spicy veg", "Spicy veg", all((i) => i.veg && i.spice >= 2)],
  ["do u hav dosa", "Says we don't have it", and(noItems, text(/don.t have/i))],
  ["chapati", "Rotis", all((i) => i.cat === "bread" && /roti/i.test(i.name))],
  ["gobhi", "Gobi 65", includes("gobi-65")],
  ["chana masala", "Chole Masala", first((i) => i.id === "chole-masala")],
  ["payasam", "Rice Kheer", includes("rice-kheer")],
  ["cold drinkss", "Cold drinks", all((i) => i.cat === "juices")],
  ["nonveg starterz", "Non-veg starters", all((i) => !i.veg && i.cat === "starters")],
  ["biriyani under 300", "Biryani ≤ ₹300", all((i) => i.cat === "biryani" && i.price <= 300)],
  ["is panner butter masala sweet", "Says it's mildly sweet", text(/mildly sweet|slightly sweet|sweet/i)],
  ["hw much is chiken biryani", "Gives chicken biryani prices", text(/₹290|₹300/)],
  ["somthing light n healthy", "Light/healthy dishes", all((i) => /light|healthy/.test(i.tags))],
  ["noodles", "Says we don't have it", and(noItems, text(/don.t have/i))],
  ["dal fry", "Dal Tadka", includes("dal-tadka")],
  ["vegan options", "Vegan dishes", all((i) => VEGAN.has(i.id))],
  ["i dont eat egg, suggest a desert", "Eggless sweets", all((i) => i.veg && /sweet/.test(i.tags))],
  ["kulfi flavours", "Kulfis", all((i) => /kulfi/i.test(i.name))],
  ["veg n spicy starters plz", "Spicy veg starters", all((i) => i.veg && i.cat === "starters" && i.spice >= 2)],
  ["wht goes wid butter naan", "Curries", all((i) => i.cat === "gravy")]
];
// Fresh chat-speak held-out set: written after tuning, run once.
const HOLDOUT2 = [
  ["do u hv butter chiken", "Butter Chicken", includes("butter-chicken")],
  ["sumthing cold n sweet", "Cold sweets", all((i) => (i.cat === "icecream" || i.cat === "juices" || COLD_DESSERT.has(i.id)) && /sweet/.test(i.tags))],
  ["any non veg gravy below 350", "Non-veg curries ≤ ₹350", all((i) => !i.veg && i.cat === "gravy" && i.price <= 350)],
  ["rotii", "Rotis", all((i) => i.cat === "bread" && /roti/i.test(i.name))],
  ["spcl biryani", "A bestseller biryani first", first((i) => i.cat === "biryani" && POP.includes(i.id))],
  ["is gulab jamun hot or cold", "Says served hot", text(/served hot/i)],
  ["i m vegan wat can i eat", "Vegan dishes", all((i) => VEGAN.has(i.id))],
  ["kebab for 4 ppl", "Kebabs", all((i) => /kebab/i.test(i.name))],
  ["wat is chole", "Describes Chole Masala", text(/chickpea/i)],
  ["plz giv me lassi options", "Lassis", all((i) => /lassi/i.test(i.name))],
  ["no spicy food for my kid", "Not spicy", all((i) => i.spice <= 1)],
  ["pizzza", "Says we don't have it", and(noItems, text(/don.t have/i))],
  ["fish fryy", "Amritsari Fish first", first((i) => i.id === "amritsari-fish")],
  ["suggst mutton gravy", "Mutton curry", all((i) => prot.mutton(i) && i.cat === "gravy")],
  ["do u have eggless sweets", "Eggless sweets", all((i) => i.veg && /sweet/.test(i.tags))]
];
const SET = process.argv.includes("--holdout2") ? HOLDOUT2 : process.argv.includes("--holdout") ? HOLDOUT : process.argv.includes("--chatspeak") ? CHATSPEAK : CASES;
// --gemini: same questions, with Google Gemini writing menu answers (needs GEMINI_API_KEY)
const USE_AI = process.argv.includes("--gemini");
const L = require("../shared/llm");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
const rows = [];
for (const [q, expected, check] of SET) {
  const S = E.createState();
  let msgs = E.chat(S, q), via = "rules";
  if (USE_AI && E.LLM_ROUTES.has(msgs.route)) {
    try {
      const ctx = E.contextFor(S, q, msgs);
      const ans = await L.ask({ key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL, ctx, history: [], timeoutMs: 20000 });
      const ai = E.llmApply(S, ans, ctx);
      if (ai) { msgs = ai; via = "gemini"; } else via = "rules (gemini answer rejected: " + JSON.stringify(ans).slice(0, 160) + ")";
    } catch (e) { via = "rules (gemini error: " + e.message.slice(0, 80) + ")"; }
    await sleep(+process.env.GEMINI_GAP_MS || 4500);   // stay inside the free-tier rate limit
  }
  const seen = new Set(), items = [];
  msgs.forEach((m) => (m.items || []).forEach((r) => { if (!r.qty && !seen.has(r.id) && M[r.id]) { seen.add(r.id); items.push(M[r.id]); } }));
  const tx = msgs.map((m) => m.text).join("\n").replace(/\*\*/g, "");
  let ok = false; try { ok = !!check(items, tx); } catch (e) {}
  rows.push({ question: q, expected, pass: ok, via, reply: tx, dishes: items.map((i) => `${i.name} (${i.veg ? "veg" : "non-veg"}, ${E.CATNAME[i.cat]}, ₹${i.price}${i.spice ? ", " + E.SPICE[i.spice] : ""})`) });
}
const passed = rows.filter((r) => r.pass).length;
const out = path.join(__dirname, "results", "waiter-eval");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, label + ".json"), JSON.stringify({ label, ranAt: new Date().toISOString(), passed, total: rows.length, accuracy: Math.round((passed / rows.length) * 100) + "%", rows }, null, 2));
rows.forEach((r) => { if (!r.pass || process.argv.includes("-v")) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.question}\n      expected: ${r.expected}\n      got: ${r.reply.split("\n")[0].slice(0, 90)} | ${r.dishes.slice(0, 4).join("; ").slice(0, 160)}`); });
console.log(`\n${label}: ${passed}/${rows.length} (${Math.round((passed / rows.length) * 100)}%)`);
if (process.env.CI && passed < rows.length) process.exitCode = 1;
})();
