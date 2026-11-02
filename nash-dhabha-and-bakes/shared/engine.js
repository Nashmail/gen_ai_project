/*!
 * NASH Dhabha & Bakes — Masala Mitra engine
 * Retrieval-augmented chatbot: a TF-IDF retriever over the menu and house-info
 * knowledge base, plus a dialogue manager that grounds every answer in what it
 * retrieved. Runs unchanged in Node (backend) and the browser (offline mode).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NashEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BOT_NAME = "Masala Mitra";

  /* ------------------------------------------------------------------ */
  /* Knowledge base                                                      */
  /* ------------------------------------------------------------------ */
  const CATS = [
    { id: "bread", label: "Breads", blurb: "From the tandoor and tawa" },
    { id: "rice", label: "Rice", blurb: "Basmati and South Indian rice" },
    { id: "gravy", label: "Gravies & Curries", blurb: "Pair with breads or rice" },
    { id: "biryani", label: "Biryani", blurb: "Dum-cooked, served with raita" },
    { id: "starters", label: "Starters", blurb: "From the tandoor and the kadai" },
    { id: "juices", label: "Juices & Lassi", blurb: "Fresh and chilled" },
    { id: "chai", label: "Chai & Coffee", blurb: "Hot drinks" },
    { id: "desserts", label: "Desserts", blurb: "Mithai and halwa" },
    { id: "icecream", label: "Ice Cream & Kulfi", blurb: "Cold sweets" },
    { id: "bakes", label: "Bakes", blurb: "Baked fresh every morning" }
  ];

  // name | category | veg(1/0) | price | spice(0-3) | description | retrieval tags
  const RAW = `Butter Naan|bread|1|60|0|Soft tandoor naan brushed with white butter.|comfort filling classic
Garlic Naan|bread|1|75|0|Naan topped with chopped garlic and coriander, baked in the tandoor.|bold filling
Tandoori Roti|bread|1|30|0|Whole-wheat roti baked on the tandoor wall.|light classic healthy
Lachha Paratha|bread|1|55|0|Flaky layered paratha, crisp outside and soft inside.|filling hearty
Aloo Paratha|bread|1|90|1|Stuffed potato paratha with butter and curd on the side.|comfort hearty filling breakfast
Paneer Kulcha|bread|1|110|1|Kulcha stuffed with spiced paneer and onion.|filling hearty
Missi Roti|bread|1|45|1|Gram-flour roti with ajwain and green chilli.|light healthy
Keema Naan|bread|0|150|2|Naan stuffed with spiced minced mutton.|bold hearty filling
Jeera Rice|rice|1|140|0|Basmati tempered with cumin and ghee.|light comfort
Steamed Basmati|rice|1|110|0|Plain long-grain basmati rice.|light soothing
Veg Pulao|rice|1|170|1|Basmati cooked with peas, carrots and whole spices.|comfort light
Curd Rice|rice|1|130|0|Cool curd rice with mustard tempering and pomegranate.|cool soothing light sick comfort calm
Lemon Rice|rice|1|130|1|Tangy rice with peanuts and curry leaves.|light refresh
Egg Fried Rice|rice|0|180|1|Wok-tossed rice with scrambled egg and spring onion.|filling energy
Chicken Fried Rice|rice|0|210|1|Wok-tossed rice with chicken and vegetables.|filling hearty
Dal Makhani|gravy|1|220|1|Black lentils slow-cooked overnight with butter and cream.|comfort rich classic warm sad
Dal Tadka|gravy|1|180|1|Yellow dal with ghee, garlic and red chilli tempering.|comfort light warm soothing sick
Paneer Butter Masala|gravy|1|260|1|Paneer in a creamy tomato-butter gravy.|rich comfort celebrate happy
Kadai Paneer|gravy|1|260|2|Paneer and peppers tossed in kadai masala.|bold spicy
Palak Paneer|gravy|1|240|1|Paneer cubes in smooth spinach gravy.|healthy light comfort
Chole Masala|gravy|1|200|2|Punjabi chickpea curry, dark and tangy.|hearty filling bold hungry
Mix Veg Kolhapuri|gravy|1|210|3|Mixed vegetables in fiery Kolhapuri masala.|spicy bold adventurous
Butter Chicken|gravy|0|320|1|Tandoori chicken in a velvety tomato-butter gravy.|rich comfort celebrate classic happy
Chicken Chettinad|gravy|0|320|3|Chettinad pepper-and-fennel chicken curry.|spicy bold adventurous
Mutton Rogan Josh|gravy|0|420|2|Kashmiri mutton curry with fennel and dry ginger.|rich hearty celebrate
Kerala Fish Curry|gravy|0|360|2|Fish in coconut milk with kudampuli.|bold new adventurous
Egg Curry|gravy|0|210|2|Boiled eggs in onion-tomato masala.|hearty energy
Veg Dum Biryani|biryani|1|240|1|Basmati and vegetables sealed and dum-cooked.|filling celebrate hungry
Paneer Tikka Biryani|biryani|1|280|2|Biryani layered with smoky paneer tikka.|filling bold celebrate
Mushroom Biryani|biryani|1|260|2|Seeraga samba rice with mushrooms, South Indian style.|filling new
Chicken Dum Biryani|biryani|0|290|2|Hyderabadi-style chicken dum biryani with raita.|filling hearty celebrate classic hungry
Ambur Chicken Biryani|biryani|0|300|2|Tamil Nadu style biryani with seeraga samba rice.|filling bold new
Hyderabadi Mutton Biryani|biryani|0|380|2|Kacchi mutton biryani with saffron and fried onion.|filling rich celebrate hearty hungry
Egg Biryani|biryani|0|230|2|Spiced eggs layered with biryani rice.|filling energy
Prawn Biryani|biryani|0|420|2|Coastal prawn biryani with mint.|bold new celebrate adventurous
Paneer Tikka|starters|1|250|2|Tandoor-charred paneer, peppers and onion.|bold share
Hara Bhara Kebab|starters|1|200|1|Spinach and green pea patties.|light healthy share
Crispy Corn|starters|1|180|1|Fried sweet corn tossed with pepper and onion.|crunchy share bored
Gobi 65|starters|1|190|2|Crisp cauliflower in a spicy red batter.|crunchy spicy bored
Tandoori Chicken Half|starters|0|300|2|Half chicken marinated in yoghurt and spices, roasted in the tandoor.|bold celebrate share
Chicken 65|starters|0|260|3|Deep-fried spicy chicken with curry leaves.|spicy crunchy bold bored adventurous
Mutton Seekh Kebab|starters|0|340|2|Minced mutton skewers off the tandoor.|bold rich share
Amritsari Fish|starters|0|330|2|Gram-flour battered fried fish with ajwain.|crunchy bold new
Fresh Lime Soda|juices|1|80|0|Sweet, salted or mixed.|refresh cool calm angry hot
Watermelon Juice|juices|1|100|0|Fresh watermelon, no added sugar.|refresh cool light hot
Mosambi Juice|juices|1|110|0|Fresh sweet-lime juice.|refresh light sick healthy
Pineapple Juice|juices|1|110|0|Fresh pineapple with a pinch of pepper.|refresh cool
Mango Lassi|juices|1|130|0|Thick yoghurt and Alphonso mango.|sweet cool happy
Sweet Lassi|juices|1|100|0|Punjabi lassi topped with malai.|sweet cool comfort
Masala Chaas|juices|1|70|0|Spiced buttermilk with roasted cumin.|cool light calm refresh angry
Rose Milk|juices|1|90|0|Chilled milk with rose syrup and sabja seeds.|sweet cool romantic
Masala Chai|chai|1|40|0|Kadak tea with ginger and cardamom.|energy warm calm tired stressed
Ginger Honey Lemon Tea|chai|1|60|0|Hot tea with ginger, honey and lemon.|soothing warm sick calm
Filter Coffee|chai|1|60|0|South Indian decoction coffee with frothy milk.|energy tired warm
Hot Badam Milk|chai|1|90|0|Almond milk with saffron.|warm soothing comfort sick
Gulab Jamun 2 pcs|desserts|1|90|0|Warm khoya dumplings in rose syrup.|sweet comfort warm happy sad
Rasmalai 2 pcs|desserts|1|120|0|Soft chenna discs in saffron milk.|sweet rich celebrate romantic
Gajar Halwa|desserts|1|130|0|Slow-cooked carrot halwa with khoya.|sweet warm comfort
Shahi Tukda|desserts|1|140|0|Fried bread soaked in rabri with nuts.|sweet rich romantic celebrate
Rice Kheer|desserts|1|110|0|Rice pudding with cardamom and nuts.|sweet comfort soothing
Jalebi with Rabri|desserts|1|140|0|Hot crisp jalebi with thick rabri.|sweet celebrate happy
Moong Dal Halwa|desserts|1|140|0|Rich ghee-roasted lentil halwa.|sweet rich warm
Kesar Pista Kulfi|icecream|1|110|0|Saffron and pistachio kulfi on a stick.|cool sweet happy
Malai Kulfi|icecream|1|100|0|Classic reduced-milk kulfi.|cool sweet calm
Mango Ice Cream|icecream|1|120|0|Two scoops of Alphonso mango ice cream.|cool sweet happy refresh hot
Chocolate Fudge Sundae|icecream|1|180|0|Chocolate ice cream, hot fudge and brownie bits.|sweet comfort happy celebrate sad
Butterscotch Scoop|icecream|1|110|0|Butterscotch ice cream with praline.|sweet cool
Royal Falooda|icecream|1|170|0|Rose milk, vermicelli, sabja and kulfi.|sweet cool celebrate romantic
Vanilla with Hot Gulab Jamun|icecream|1|160|0|Cold vanilla scoop over warm gulab jamun.|sweet comfort romantic happy
Chocolate Truffle Pastry|bakes|1|120|0|Eggless dark chocolate truffle pastry.|sweet comfort sad romantic
Red Velvet Pastry|bakes|1|130|0|Eggless red velvet with cream-cheese frosting.|sweet romantic celebrate
Black Forest Cake 500 g|bakes|1|550|0|Eggless whole cake with cherries and cream.|celebrate sweet share
Plum Cake Slice|bakes|0|90|0|Fruit plum cake (contains egg).|sweet warm
Banana Walnut Muffin|bakes|0|90|0|Moist muffin with walnuts (contains egg).|sweet energy
Butter Cookies 200 g|bakes|1|150|0|Eggless butter cookies, baked daily.|sweet share bored
Veg Puff|bakes|1|40|1|Flaky puff with spiced vegetable filling.|crunchy light bored
Egg Puff|bakes|0|45|1|Flaky puff with masala egg.|crunchy energy
Chicken Puff|bakes|0|70|1|Flaky puff with chicken masala.|crunchy filling`;

  const SPICE = ["", "Mild", "Medium", "Hot"];
  const MENU = RAW.split("\n").map(function (l) {
    const [n, c, v, p, s, d, t] = l.split("|");
    const name = n.replace(/ 2 pcs$/, " (2 pcs)").replace(/ (500 g|200 g)$/, " ($1)").replace(/ Half$/, " (Half)");
    return { id: n.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, cat: c, veg: v === "1", price: +p, spice: +s, desc: d, tags: t };
  });
  const ITEM = Object.fromEntries(MENU.map((i) => [i.id, i]));
  const CATNAME = Object.fromEntries(CATS.map((c) => [c.id, c.label]));

  /* What a waiter knows about each dish beyond the menu card */
  const POPULAR = new Set(["butter-chicken", "chicken-dum-biryani", "dal-makhani", "paneer-butter-masala", "butter-naan", "paneer-tikka", "chicken-65", "hyderabadi-mutton-biryani", "mango-lassi", "gulab-jamun-2-pcs", "masala-chai", "chocolate-truffle-pastry", "tandoori-chicken-half"]);
  // no dairy, egg or meat as listed (ask the chef to cook in oil, not ghee)
  const VEGAN = new Set(["tandoori-roti", "steamed-basmati", "lemon-rice", "chole-masala", "mix-veg-kolhapuri", "crispy-corn", "gobi-65", "fresh-lime-soda", "watermelon-juice", "mosambi-juice", "pineapple-juice"]);
  const HOT_SWEETS = new Set(["gulab-jamun-2-pcs", "gajar-halwa", "moong-dal-halwa", "jalebi-with-rabri"]);
  const COLD_SWEETS = new Set(["rasmalai-2-pcs", "rice-kheer", "shahi-tukda"]);
  MENU.forEach((i) => {
    const s = i.name + " " + i.desc;
    i.protein = /chicken/i.test(s) ? "chicken" : /mutton|keema/i.test(s) ? "mutton" : /prawn/i.test(s) ? "prawn" : /\bfish\b/i.test(s) ? "fish"
      : /\begg\b|contains egg/i.test(s) ? "egg" : /paneer/i.test(s) ? "paneer" : /mushroom/i.test(s) ? "mushroom"
      : i.cat === "gravy" && /\bdal\b|lentil/i.test(s) ? "dal" : /chickpea|chole/i.test(s) ? "chole" : null;
    i.egg = /\begg\b|contains egg/i.test(s);
    i.texture = i.cat === "starters" ? "dry" : i.id === "kadai-paneer" ? "semi-dry" : i.cat === "gravy" ? "gravy" : null;
    i.temp = ["juices", "icecream"].includes(i.cat) || COLD_SWEETS.has(i.id) ? "cold" : i.cat === "chai" || HOT_SWEETS.has(i.id) ? "hot" : null;
    i.popular = POPULAR.has(i.id);
    i.south = /chettinad|kerala|ambur|lemon rice|curd rice|filter coffee|mushroom biryani|\b65\b/i.test(i.name);
    i.tandoor = /tandoor/i.test(s);
    i.vegan = VEGAN.has(i.id);
    i.sweetish = ["paneer-butter-masala", "butter-chicken"].includes(i.id);
    i.portion = /\(2 pcs\)/.test(i.name) ? "2 pieces per plate" : /\(Half\)/.test(i.name) ? "a half chicken" : (/\((\d+ g)\)/.exec(i.name) || [])[1] || (/two scoops/i.test(i.desc) ? "two scoops" : null);
  });

  const INFO = [
    { id: "hours", title: "Timings", text: "We are open every day from 7:00 AM to 11:30 PM. The kitchen serves meals from 11:00 AM to 11:00 PM, and the bakery counter opens at 7:00 AM.", keys: "time timing timings open close closing hours when today morning night late" },
    { id: "pay", title: "Payment", text: "You can pay by UPI, debit or credit card, or cash. I'll generate your bill in this chat once your order is ready.", keys: "payment pay upi card cash gpay phonepe paytm bill accept credit debit" },
    { id: "vegkitchen", title: "Veg and non-veg", text: "Veg and non-veg dishes are cooked in separate tandoors and utensils. A green dot means veg; a brown triangle means non-veg (egg items count as non-veg). Most pastries and cakes are eggless.", keys: "veg vegetarian nonveg separate kitchen egg eggless pure jain mark symbol" },
    { id: "chefnote", title: "Chef notes", text: "Every dish on the menu has a Chef note button. Type your request or record a voice note, like 'less oil' or 'extra spicy', and it goes straight to the chef with your order.", keys: "chef note voice instruction request custom customise less oil special" },
    { id: "spice", title: "Spice levels", text: "Each dish shows its spice level: Mild, Medium or Hot. Want it changed? Add a chef note such as 'make it mild' or 'extra spicy'.", keys: "spice spicy mild hot chilli level heat" },
    { id: "jain", title: "Allergies and Jain food", text: "Jain preparation (no onion, garlic or root vegetables) is possible for most gravies on request. Add it as a chef note. Bakes contain wheat and dairy; kulfi and desserts may contain nuts. Tell the chef about any allergy in the chef note.", keys: "jain allergy allergic nut nuts gluten dairy lactose onion garlic" },
    { id: "time", title: "Preparation time", text: "Most orders are ready in 15 to 25 minutes. Biryani and tandoor items take a little longer at peak hours.", keys: "how long wait time ready prepare preparation minutes fast quick delay" },
    { id: "tax", title: "Bill and taxes", text: "Bills include 5% GST, split as 2.5% CGST and 2.5% SGST. Totals are rounded to the nearest rupee.", keys: "gst tax taxes cgst sgst charge service total bill round" },
    { id: "about", title: "About us", text: "NASH Dhabha & Bakes is a highway-style dhaba with a bakery counter. We serve North and South Indian food from the tandoor and kadai, dum biryani, fresh juices, kulfi and bakes made every morning.", keys: "about nash dhabha dhaba bakes bakery who restaurant cuisine north south indian" },
    { id: "order", title: "Ordering", text: "Tell me a dish and I'll add it, or tap Direct me to menu. When you're ready, open the cart, check your chef notes and press Place order. I'll keep you updated here until the bill and payment.", keys: "how order ordering cart checkout place takeaway dine dine-in table parcel" }
  ];

  /* ------------------------------------------------------------------ */
  /* Retriever: TF-IDF with synonym expansion                           */
  /* ------------------------------------------------------------------ */
  const STOP = new Set("a an the is are am was were be to of in on for with and or but at by from it its this that these those i me my we our you your he she they them do does did can could would should will shall have has had please pls what which who whom how any some show tell give get want like need just also there here than then so too very really much more most about as if not no yes ok okay".split(" "));
  const SYN = { sweet: "dessert sweet", sweets: "dessert sweet", dessert: "sweet", cold: "cool", chilled: "cool", drink: "juice lassi chai cool", drinks: "juice lassi chai", beverage: "juice chai", tea: "chai", coffee: "chai", juice: "refresh", bread: "naan roti paratha", breads: "naan roti paratha", roti: "bread", naan: "bread", curry: "gravy", curries: "gravy", gravy: "curry", meat: "nonveg chicken mutton", cake: "bakes pastry", pastry: "bakes cake", bakery: "bakes", snack: "starters puff crunchy", snacks: "starters puff crunchy", starter: "starters", icecream: "icecream kulfi cool", ice: "icecream", kulfi: "icecream", spicy: "spicy hot bold", healthy: "light healthy", heavy: "filling hearty", biriyani: "biryani", briyani: "biryani", biriani: "biryani", desert: "dessert sweet", deserts: "dessert sweet", timing: "time hours", open: "hours" };
  const TYPO = { biriyani: "biryani", briyani: "biryani", biriani: "biryani", nan: "naan", panner: "paneer", panir: "paneer", chiken: "chicken", chikken: "chicken", lasi: "lassi", gulabjamun: "gulab jamun", desert: "dessert", deserts: "dessert" };

  function norm(s) {
    return String(s).toLowerCase()
      .replace(/\bi['’]m\b/g, "im").replace(/\b(\w+)['’]s\b/g, "$1s")
      .replace(/non[\s-]*veg(etarian)?/g, "nonveg")
      .replace(/ice[\s-]*cream/g, "icecream")
      .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function stem(w) {
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }
  function toks(s) {
    return norm(s).split(" ").filter((w) => w && !STOP.has(w)).map((w) => TYPO[w] || w).join(" ").split(" ").map(stem);
  }
  function expand(t) {
    const out = t.slice();
    t.forEach((w) => { if (SYN[w]) out.push(...SYN[w].split(" ").map(stem)); });
    return out;
  }

  const DOCS = [
    ...MENU.map((i) => ({ kind: "item", ref: i, text: `${i.name} ${i.name} ${CATNAME[i.cat]} ${i.cat} ${i.veg ? "veg vegetarian" : "nonveg meat"} ${i.desc} ${i.tags} ${SPICE[i.spice]} ${i.spice >= 2 ? "spicy" : ""}` })),
    ...INFO.map((d) => ({ kind: "info", ref: d, text: `${d.title} ${d.keys} ${d.keys} ${d.text}` }))
  ];
  const DF = {};
  DOCS.forEach((d) => {
    d.tf = {};
    toks(d.text).forEach((w) => (d.tf[w] = (d.tf[w] || 0) + 1));
    Object.keys(d.tf).forEach((w) => (DF[w] = (DF[w] || 0) + 1));
  });
  const IDF = (w) => Math.log(1 + DOCS.length / (1 + (DF[w] || 0)));
  DOCS.forEach((d) => {
    d.vec = {}; let n = 0;
    for (const w in d.tf) { const v = (1 + Math.log(d.tf[w])) * IDF(w); d.vec[w] = v; n += v * v; }
    d.norm = Math.sqrt(n) || 1;
  });

  function retrieve(query, opts) {
    const { k = 5, kind = null, diet = null } = opts || {};
    const q = expand(toks(query));
    if (!q.length) return [];
    const qv = {}; q.forEach((w) => (qv[w] = (qv[w] || 0) + IDF(w)));
    let qn = 0; for (const w in qv) qn += qv[w] * qv[w]; qn = Math.sqrt(qn) || 1;
    return DOCS
      .filter((d) => (!kind || d.kind === kind) && (!diet || d.kind !== "item" || (diet === "veg" ? d.ref.veg : !d.ref.veg)))
      .map((d) => { let s = 0; for (const w in qv) if (d.vec[w]) s += qv[w] * d.vec[w]; return { d, score: s / (qn * d.norm) }; })
      .filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  }

  const nameToks = (i) => toks(i.name).filter((w) => !/^\d+$/.test(w) || w === "65").filter((w) => !["pc", "pcs", "g", "half"].includes(w));
  function matchItems(q) {
    const qt = toks(q);
    if (!qt.length) return [];
    return MENU.map((i) => {
      const nt = nameToks(i);
      const ov = nt.filter((w) => qt.includes(w)).length;
      return { i, ov, s: ov / nt.length + 0.5 * ov / qt.length };
    }).filter((r) => r.ov > 0).sort((a, b) => b.s - a.s);
  }

  /* ------------------------------------------------------------------ */
  /* Cart and bill                                                      */
  /* ------------------------------------------------------------------ */
  function createState() {
    return { name: "", diet: null, awaiting: null, pending: null, lastMood: null, cart: {}, orderNote: "", orderVoice: null, order: null };
  }
  const cartCount = (S) => Object.values(S.cart).reduce((a, c) => a + c.qty, 0);
  const cartSub = (S) => Object.entries(S.cart).reduce((a, [id, c]) => a + (ITEM[id] ? ITEM[id].price * c.qty : 0), 0);
  function addToCart(S, id, qty) {
    if (!ITEM[id]) throw new Error("UNKNOWN_ITEM");
    const c = S.cart[id] || (S.cart[id] = { qty: 0, note: "", voice: null });
    c.qty = Math.min(50, c.qty + (qty || 1));
    S.lastItem = id;
    return c;
  }
  function setQty(S, id, q) {
    if (!ITEM[id]) throw new Error("UNKNOWN_ITEM");
    if (q <= 0) delete S.cart[id];
    else (S.cart[id] || (S.cart[id] = { qty: 0, note: "", voice: null })).qty = Math.min(50, q);
  }
  function setNote(S, id, note, voice) {
    if (S.awaiting === "note" && S.noteFor === id) { S.awaiting = null; S.noteFor = null; }
    if (id === "__order") { S.orderNote = note || ""; S.orderVoice = voice || null; return; }
    if (!ITEM[id]) throw new Error("UNKNOWN_ITEM");
    if (!S.cart[id]) addToCart(S, id, 1);
    S.cart[id].note = note || ""; S.cart[id].voice = voice || null;
  }
  function bill(sub) {
    const cg = Math.round(sub * 2.5) / 100, sg = cg, raw = sub + cg + sg, tot = Math.round(raw);
    return { sub, cgst: cg, sgst: sg, round: Math.round((tot - raw) * 100) / 100, total: tot };
  }
  function cartView(S) {
    const lines = Object.entries(S.cart).filter(([id]) => ITEM[id]).map(([id, c]) => ({ id, name: ITEM[id].name, veg: ITEM[id].veg, price: ITEM[id].price, qty: c.qty, amount: ITEM[id].price * c.qty, note: c.note, voice: c.voice }));
    return { lines, count: cartCount(S), bill: bill(cartSub(S)), orderNote: S.orderNote, orderVoice: S.orderVoice };
  }

  /* ------------------------------------------------------------------ */
  /* Dialogue manager                                                    */
  /* ------------------------------------------------------------------ */
  const MOODS = {
    happy: { w: "khush khushi mast happy good great awesome excited cheerful fantastic amazing super joy joyful celebrate celebrating celebration birthday party fine nice wonderful glad chill relaxed", r: "Love that energy! Let's celebrate with something rich.", q: "celebrate happy rich sweet" },
    sad: { w: "udaas udas dukhi sad down low upset depressed lonely blue bad crying heartbroken unhappy meh gloomy", r: "Sorry you're feeling low. Some comfort food should help.", q: "comfort sad warm sweet" },
    tired: { w: "thaka thaki thakan tired sleepy exhausted lazy drained fatigued weary", r: "Long day? Let's get your energy back.", q: "energy tired warm" },
    stressed: { w: "tension pareshan stressed stress tense anxious pressure worried busy overwhelmed hectic nervous", r: "Take a breath. Something calming and comforting is on the way.", q: "calm comfort soothing stressed" },
    angry: { w: "gussa angry irritated annoyed frustrated mad furious", r: "Let's cool things down a little.", q: "cool refresh calm angry" },
    hungry: { w: "bhookh bhook bhukh hungry starving famished starved", r: "Then let's fill you up properly!", q: "filling hearty hungry" },
    sick: { w: "bimaar bimar bukhar sick fever unwell ill cough cold flu headache", r: "Get well soon. Here's something light and soothing.", q: "soothing light sick warm" },
    romantic: { w: "romantic love date partner anniversary lovely", r: "A sweet mood deserves sweet food.", q: "romantic rich sweet" },
    adventurous: { w: "adventurous bold experiment spicy wild adventure", r: "Let's try something bold and spicy.", q: "spicy bold adventurous new" },
    hot: { w: "garmi hot sweaty thirsty summer heat sweating", r: "It's hot out there. Something cool first.", q: "cool refresh hot" },
    bored: { w: "bored boring", r: "Let's crunch the boredom away.", q: "crunchy bored share" }
  };
  const MOOD_CHIPS = ["Happy", "Hungry", "Tired", "Stressed", "Sad", "Adventurous"];
  // Yes/no must be the whole message, so "add <dish>" is never mistaken for "yes".
  const YES = /^((yes|yeah|yep|yup|ya|yah|sure|ok|okay|okk|haan|han|ha|haa|ji|please|go ahead|do it|of course|why not|definitely|confirm|y|add it|add that|kar do|daal do)\s*)+$/;
  const NO = /^((no|nope|nah|not now|skip|next|other|another|something else|nahi|na|show( me)? (another|other|next|something else)( one)?|n|thanks|thank you)\s*)+$/;
  const GREET = /^(hi+|hello+|hey+|hai|hii|namaste|namaskar|vanakkam|hola|good (morning|afternoon|evening)|yo|sup)\b/;
  const NUM = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, single: 1, double: 2 };
  const NOTNAME = new Set("hi hello hey yes no ok okay veg nonveg menu cart thanks thank biryani naan food order hungry".split(" "));
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const rs = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  const comma = (S) => (S.name ? ", " + S.name : "");

  function detectMood(t) {
    if (/\b(not|no|never)\s+(so\s+|very\s+|that\s+|feeling\s+)?(good|great|happy|fine|well|nice|ok|okay)\b/.test(t)) return "sad";
    if (/\b(accha|achha|acha|theek|thik|thick|sahi|badiya|badhiya)\s+(nahi|nai|nhi)\b/.test(t)) return "sad";
    const w = t.split(" ");
    for (const m in MOODS) { const set = MOODS[m].w.split(" "); if (w.some((x) => set.includes(x) || set.includes(stem(x)))) return m; }
    return null;
  }
  function detectDiet(S, t) {
    if (/\bnonveg\b/.test(t)) S.diet = "nonveg";
    else if (/\b(veg|vegetarian|pure veg|only veg)\b/.test(t)) S.diet = "veg";
  }
  function extractName(s) {
    const m = s.match(/\b(?:i am|i'm|im|it's|its|name)\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?)/i);
    let n = m ? m[1] : null;
    if (!n) { const c = s.trim(); if (/^[A-Za-z][A-Za-z.'\s-]{0,30}$/.test(c) && c.split(/\s+/).length <= 3) n = c; }
    if (!n) return null;
    const nt = norm(n);
    if (detectMood(nt) || nt.split(" ").some((w) => NOTNAME.has(w))) return null;
    return n.split(/\s+/).slice(0, 2).map(cap).join(" ");
  }
  const itemRef = (i, extra) => Object.assign({ id: i.id, name: i.name, price: i.price, veg: i.veg, cat: CATNAME[i.cat], spice: SPICE[i.spice], desc: i.desc }, extra || {});
  function pickDiverse(results, n) {
    const seen = new Set(), out = [];
    for (const r of results) { if (seen.has(r.d.ref.cat)) continue; seen.add(r.d.ref.cat); out.push(r.d.ref); if (out.length === n) break; }
    return out;
  }
  function parseQty(p) {
    const m = p.trim().match(/^(\d{1,3}|one|a|an|two|three|four|five|six|seven|eight|nine|ten|single|double)\s*(?:x|nos?|pcs?|pieces?|plates?)?\s+(.*)$/);
    if (m) { const q = /^\d/.test(m[1]) ? +m[1] : NUM[m[1]]; if (q > 0 && q <= 999) return { qty: q, rest: m[2] }; }
    const m2 = p.trim().match(/^(.*?)\s+(?:x\s*)?(\d{1,2})$/);
    if (m2 && +m2[2] <= 20 && !/\b(chicken|gobi)$/.test(m2[1])) return { qty: +m2[2], rest: m2[1] };
    return { qty: 1, rest: p };
  }

  /**
   * One chat turn. Returns an array of bot messages:
   * { role:"bot", text, items?:[{id,name,price,veg,cat,spice,qty?,add?}], chips?:[], source?, bill?, action? }
   * `text` uses **bold** markup only; the client escapes everything else.
   */
  /* ---------- understand chat-speak, Indian spellings and typos ---------- */
  const SLANG = { u: "you", ur: "your", hv: "have", hav: "have", r: "are", pls: "please", plz: "please", plzz: "please", sugg: "suggest", sugst: "suggest", suggst: "suggest", sugest: "suggest", recom: "recommend", reco: "recommend", recomend: "recommend",
    spl: "special", spcl: "special", specl: "special", spcls: "specials", wat: "what", wht: "what", wt: "what", hw: "how", abt: "about", n: "and", nd: "and", wid: "with", wth: "with", gud: "good", thx: "thanks", tnx: "thanks", tq: "thanks", sumthing: "something", smthng: "something", somthing: "something", anythin: "anything", dont: "dont", nv: "nonveg",
    parota: "paratha", parotta: "paratha", porotta: "paratha", prantha: "paratha", paranta: "paratha", chapati: "roti", chapathi: "roti", chapatti: "roti", phulka: "roti", gobhi: "gobi", gobhii: "gobi", chana: "chole", channa: "chole", chickpeas: "chole", payasam: "kheer", payasa: "kheer", kheer: "kheer",
    chief: "chef", cheif: "chef", shef: "chef", chefs: "chef", cheff: "chef", daal: "dal", dhal: "dal", alu: "aloo", jamoon: "jamun", halva: "halwa", panir: "paneer", panner: "paneer", muton: "mutton", chiken: "chicken", chikken: "chicken", chikan: "chicken", biriyani: "biryani", briyani: "biryani", biriani: "biryani", lasi: "lassi", nan: "naan", desert: "dessert", deserts: "desserts", fry: "fry" };
  const COMMON = new Set("well good great nice best better go goes going gone along side also like love loved want wants wanted need needs know think make made take taken come came see look looking find found try tried keep give gave get got put say said tell told ask asked help call feel felt seem leave left work works play run let mean means move live believe bring happen write sit stand lose pay meet include continue set learn change lead understand watch follow stop create speak read allow add spend grow open walk win offer remember consider appear buy wait serve served serving die send expect build stay fall cut reach kill remain suggest raise pass sell require report decide pull also just only even back still too much more most many such own same other another every each few little long great old big high different small large next early young important public bad able last first new right good free full sure true whole real best hard clear easy late hot cold warm fresh fast quick slow ready done people time year way day thing man woman child world life hand part place case week point home water room mother area money story fact month lot study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information school face others level office door health person art war history party result morning reason research girl guy moment air teacher force education foot boy age policy process music market sense nation plan college interest death experience effect use class control care field development role effort rate heart drug show leader light voice wife police mind price report decision son view relationship town road arm difference value building action model season society tax director position player record paper space ground form event official matter center couple site project activity star table need court oil situation cost industry figure street image phone data picture practice piece land product doctor wall patient worker news test movie north love support technology step baby computer type attention film tree source organization hair window evidence population site everyone everything someone nothing please thank thanks sorry okay yes yeah sure maybe today tonight tomorrow now later soon here there where when why how what which who whom whose this that these those my mine your yours our ours their his her its them they he she we you i me us him replace replaced swap change set update remove delete cancel clear empty instead actually proceed confirm checkout cart basket quantity make made meal meals lunch dinner breakfast snack hi hello hey namaste add remove cart checkout menu yes no ok okay please thanks name my is are am i you your we our the a an and or with for to of in on at it this that what which how much many when where who why do does have has can could would want need like give get show tell suggest recommend special specials something anything any some food dish dishes item items order bill pay upi card cash eat drink here there today now very really not dont mood happy sad tired hungry stressed angry sick bored hot cold veg nonveg vegan meat spicy mild sweet dry gravy cheap price cost under below above options kids light healthy heavy plz".split(" "));
  let FOOD = null;
  function foodVocab() {
    if (FOOD) return FOOD;
    FOOD = new Set();
    MENU.forEach((i) => norm(i.name + " " + i.desc + " " + CATNAME[i.cat]).split(" ").forEach((w) => w.length > 3 && FOOD.add(w)));
    CAT_WORDS.forEach(([re]) => (re.source.match(/[a-z]{4,}/g) || []).forEach((w) => FOOD.add(w)));
    "vegan veg nonveg spicy mild sweet dry gravy special specials starters drinks dessert desserts icecream biryani curry curries snacks bread breads paratha roti naan kebab kebabs lassi kulfi tandoori popular bestseller suggest recommend something anything options please".split(" ").forEach((w) => FOOD.add(w));
    return FOOD;
  }
  let VOCAB = null;
  function vocab() {
    if (VOCAB) return VOCAB;
    VOCAB = new Set(COMMON);
    DOCS.forEach((d) => norm(d.text).split(" ").forEach((w) => w.length > 2 && VOCAB.add(w)));
    NEED_WORDS.forEach((w) => VOCAB.add(w)); STOP.forEach((w) => VOCAB.add(w));
    Object.values(MOODS).forEach((m) => m.w.split(" ").forEach((w) => VOCAB.add(w)));
    return VOCAB;
  }
  function dist(a, b, max) { // Damerau-Levenshtein (optimal string alignment), early exit
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) { let best = 99;
      for (let j = 1; j <= b.length; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        best = Math.min(best, d[i][j]);
      }
      if (best > max) return max + 1; }
    return d[a.length][b.length];
  }
  const fixCache = {};
  function fixWord(w) {
    if (SLANG[w]) return SLANG[w];
    if (w.length < 4 || /\d/.test(w)) return w;
    const V = vocab();
    if (V.has(w) || V.has(stem(w))) return w;
    if (fixCache[w] !== undefined) return fixCache[w];
    if (/(.)\1$/.test(w) && V.has(w.slice(0, -1))) return (fixCache[w] = w.slice(0, -1));   // "drinkss"
    if (/z$/.test(w) && V.has(w.slice(0, -1) + "s")) return (fixCache[w] = w.slice(0, -1) + "s"); // "starterz"
    const max = w.length >= 7 ? 2 : 1;
    let best = w, bd = max + 1;
    // never "correct" a word into a diet-critical word (meal -> meat would be a serious mistake)
    const PROTECT = new Set(["meat", "egg", "eggs", "veg", "nonveg", "vegan", "fish", "chicken", "mutton", "prawn", "beef", "pork", "not", "dont", "without", "spicy", "jain"]);
    foodVocab().forEach((v) => { if (v.length < 3 || PROTECT.has(v)) return; const k = dist(w, v, max); if (k < bd || (k === bd && v.length === w.length)) { bd = k; best = v; } });
    return (fixCache[w] = bd <= max ? best : w);
  }
  const fixWords = (t) => t.split(" ").map(fixWord).join(" ").replace(/\bdont\b/g, "dont");

  function chat(S, raw) {
    const out = [];
    const say = (text, o) => out.push(Object.assign({ role: "bot", text }, o || {}));
    const text = String(raw || "").trim();
    if (!text) { say("Please type or say something."); return out; }
    const t = fixWords(norm(text));

    // quick-reply shortcuts
    if (/^(direct me to menu|open (the )?menu|go to menu|show menu)$/.test(t)) { say("Opening the menu for you.", { action: { type: "navigate", to: "menu" } }); return out; }
    if (t === "start a new order") { S.order = null; S.awaiting = "mood"; say(`Let's start a fresh order${comma(S)}! What's your mood now?`, { chips: MOOD_CHIPS }); return out; }
    if (t === "suggest a dessert" || t === "something sweet") { recommend(S, "sweet dessert", say); return out; }
    if (t === "something spicy") { recommend(S, "spicy bold", say); return out; }

    if (S.awaiting === "feedback") { feedback(S, text, t, say); return out; }
    if (S.awaiting === "note" || S.awaiting === "noteWhich") { if (noteReply(S, text, t, say)) return out; }
    if (NOTE_CUE.test(t)) { chefNote(S, text, t, say); return out; }
    if (S.awaiting === "payment") {
      const m = /upi|gpay|google pay|phonepe|paytm|bhim/.test(t) ? "UPI" : /card|credit|debit|visa|rupay|master/.test(t) ? "Card" : /cash/.test(t) ? "Cash" : null;
      if (m) { pay(S, m, say); return out; }
      if (!/\b(menu|add|order)\b/.test(t)) { say("Please choose how you'd like to pay: UPI, Card or Cash.", { chips: ["UPI", "Card", "Cash"] }); return out; }
    }
    const dietOnly = /^(only |pure )?(veg|vegetarian|nonveg)( only| please| food)?$/.test(t);
    detectDiet(S, t);
    if (dietOnly) {
      if (S.lastMood) { moodReply(S, S.lastMood, say, true); return out; }
      S.awaiting = "mood";
      say(`Got it, I'll stick to ${S.diet === "veg" ? "veg" : "non-veg"} dishes. What's your mood right now?`, { chips: MOOD_CHIPS });
      return out;
    }
    if (S.pending && YES.test(t)) { acceptPending(S, say); return out; }
    if (S.pending && NO.test(t)) { nextPending(S, say); return out; }
    const named = text.match(/\b(?:my name is|my name's|call me|this is|mera naam|mera name|mera nam|naam)\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)?)/i);
    if (named) { setName(S, named[1], say); return out; }
    // a name inside a longer message: "hi I'm Kavya and I'm really hungry"
    const inline = !S.name && text.match(/\b(?:i['’]?m|i am)\s+([A-Za-z][A-Za-z.'-]+)/i);
    if (inline && isNameWord(inline[1])) {
      S.name = cap(inline[1]);
      const m2 = detectMood(t);
      if (m2) { say(`Nice to meet you, **${S.name}**!`); moodReply(S, m2, say); return out; }
      setName(S, S.name, say); return out;
    }
    if (S.awaiting === "name") { const n = extractName(text); if (n) { setName(S, n, say); return out; } }
    if (GREET.test(t) && t.split(" ").length <= 4 && !detectMood(t) && !parseNeeds(t).has) {
      if (!S.name) { S.awaiting = "name"; say(`Hi! ${/\bhow (are|r) (you|u)\b/.test(t) ? "I'm doing great, thanks for asking. " : ""}Welcome to **NASH Dhabha & Bakes**. May I know your name?`); return out; }
      S.awaiting = "mood"; say(`Hi ${S.name}, good to see you! What is your mood right now? Type it or tap the mic and say it.`, { chips: MOOD_CHIPS }); return out;
    }
    const needs = parseNeeds(t);
    const menuAsk = needs.has && (needs.cats || needs.protein || needs.texture || needs.temp || needs.priceMax || needs.priceMin || needs.sort || needs.diet || needs.south || needs.tandoor);
    const mood = menuAsk && !/\b(feel|feeling|felt|mood)\b/.test(t) ? null : detectMood(t);
    if (mood && (S.awaiting === "mood" || /\b(feel|feeling|felt|mood|im|i am|am|so|very)\b/.test(t) || t.split(" ").length <= 2)) { moodReply(S, mood, say); return out; }
    if (/\b(pay|bill|payment)\b/.test(t) && !(S.order && S.order.stage >= 4 && !S.order.paid) && !/\b(how|what|which|accept|do you)\b/.test(t)) {
      if (S.order && !S.order.paid) say(`Your order **${S.order.no}** is still being prepared. I'll share the bill here as soon as it's ready, then you can pay by UPI, card or cash.`);
      else if (cartCount(S)) say("Place your order first from the cart. The bill comes once your food is ready.", { chips: ["Checkout"] });
      else say("There's nothing to pay for yet. Add a dish to get started.", { chips: ["Direct me to menu"] });
      return out;
    }
    if (editCmd(S, t, say)) return out;
    if (/\b(remove|delete|cancel|minus)\b/.test(t) && !/\border\b/.test(t)) { removeCmd(S, t, say); return out; }
    if (/\b(clear|empty)\b.*\bcart\b/.test(t)) { S.cart = {}; say("Your cart is now empty."); return out; }
    if (/\b(cart|basket|my order|what did i order)\b/.test(t) && !/\b(add|put)\b/.test(t)) { showCart(S, say); return out; }
    if (/\b(checkout|check out|place (the |my )?order|confirm order|proceed)\b/.test(t)) { goCheckout(S, say); return out; }
    if (/\b(bill|pay|payment)\b/.test(t) && S.order && S.order.stage >= 4 && !S.order.paid) { askPay(S, say); return out; }
    if (/\b(menu|categories|category|what do you (have|serve))\b/.test(t) && !/\b(add|want|order)\b/.test(t)) { out.route = "menu"; menuReply(say); return out; }
    // questions about one specific dish ("is butter chicken spicy?", "how much is paneer tikka?")
    const dish = strongDish(t);
    if (dish && FACT_CUE.test(t) && !/\b(add|order)\b/.test(t)) { out.route = "facts"; itemFacts(S, dish, t, say); return out; }
    if (PAIR_CUE.test(t)) { const rep0 = dish || (needs.cats && MENU.find((i) => i.cat === needs.cats[0] && i.popular)) || (needs.cats && MENU.find((i) => i.cat === needs.cats[0])); if (rep0) { out.route = "facts"; itemFacts(S, rep0, t, say, !dish && needs.catLabel); return out; } }
    const browse = /\b(something|anything|options|dishes|dish|items|some|any|which|what|kind|type|types)\b/.test(t);
    const explicitAdd = /\b(add|ill have|i ll have|i will have|bring|put)\b/.test(t) || /^\d+\s|^(one|two|three|four|five)\s/.test(t);
    const softAdd = /\b(want|order|get me|give me|can i have|can i get)\b/.test(t);
    if (explicitAdd || (softAdd && (dish || !needs.has) && !browse)) { addCmd(S, t, say, text); return out; }
    if (needs.has) { out.route = "waiter"; waiter(S, t, needs, say); return out; }
    if (/\b(suggest|recommend|recommendation|best|special|popular|famous|signature|what should i|what to eat|surprise)\b/.test(t)) { out.route = "recommend"; recommend(S, t, say); return out; }
    if (/\b(thank|thanks|thx|ty)\b/.test(t)) { say(`You're welcome${comma(S)}! Anything else I can get you?`); return out; }
    if (/^(bye|goodbye|see you|tata)\b/.test(t)) { say("Bye! Hope to see you again at NASH Dhabha & Bakes."); return out; }
    out.route = "answer";
    answer(S, t, say);
    return out;
  }

  const NOT_A_NAME = new Set("really very so feeling not a an the in at from here fine looking ordering craving hungry new back done ready good okay ok fine sure sorry starving just veg vegetarian nonveg vegan also going trying planning thinking with".split(" "));
  function isNameWord(w) { const x = String(w).toLowerCase(); return x.length > 1 && !NOT_A_NAME.has(x) && !NOTNAME.has(x) && !STOP.has(x) && !detectMood(x) && !matchItems(x).length; }
  function bestInCart(S, q) { const r = matchItems(q).filter((m) => S.cart[m.i.id]); return r.length ? r[0].i : null; }
  function bestItem(q) { const ms = matchItems(q); if (!ms.length) return null; const b = ms[0], ties = ms.filter((r) => Math.abs(r.s - b.s) < 0.01); return ties.length === 1 && b.ov / nameToks(b.i).length >= 0.5 ? b.i : null; }
  /** "replace X with Y", "make the X 4", "change X to 3" */
  function editCmd(S, t, say) {
    let m = t.match(/\b(?:make|change|set|update)\s+(?:the\s+|my\s+)?(.+?)\s+(?:to\s+|qty\s+|quantity\s+)?(\d{1,2})$/) || null;
    if (m) { const i = bestInCart(S, m[1]); if (i) { setQty(S, i.id, +m[2]); say(`Updated: **${m[2]} × ${i.name}**. Cart total: **${rs(cartSub(S))}**.`, { cartChanged: true, chips: ["Show my cart", "Checkout"] }); return true; } }
    m = t.match(/\bmake it\s+(\d{1,2})\s+(.+)$/);
    if (m) { const i = bestInCart(S, m[2]); if (i) { setQty(S, i.id, +m[1]); say(`Updated: **${m[1]} × ${i.name}**. Cart total: **${rs(cartSub(S))}**.`, { cartChanged: true }); return true; } }
    m = t.match(/\b(?:replace|swap|change)\s+(?:the\s+|my\s+)?(.+?)\s+(?:with|for|to)\s+(?:a\s+|an\s+|the\s+)?(.+)$/) || t.match(/\binstead of\s+(.+?)\s+(?:give me|get me|i want|add|make it)\s+(.+)$/);
    if (m) {
      const from = bestInCart(S, m[1]), to = bestItem(m[2]);
      if (from && to) { const q = S.cart[from.id].qty; const note = S.cart[from.id].note; setQty(S, from.id, 0); addToCart(S, to.id, q); if (note) S.cart[to.id].note = note; say(`Done. I replaced **${from.name}** with **${q} × ${to.name}**. Cart total: **${rs(cartSub(S))}**.`, { cartChanged: true, chips: ["Show my cart", "Checkout"] }); return true; }
      if (!from) { say(`I couldn't find “${m[1]}” in your cart.`, { chips: ["Show my cart"] }); return true; }
    }
    return false;
  }
  const NAME_FILLER = new Set(["hai", "h", "he", "hu", "hoon", "hun", "here", "ji", "please", "and", "i", "im", "am", "from", "hungry", "today", "now"]);
  /* ---------- chef notes from the chat ---------- */
  const NOTE_CUE = /^note for (the )?whole order$|\b(chef note|chef notes|note for (the )?chef|note to (the )?chef|tell (the )?chef|message (for|to) (the )?chef|chef instruction|special instruction|special request)\b|\bchef\b.*\bnote\b|\bnote\b.*\bchef\b/;
  const NOTE_CHIPS = ["Less spicy", "Extra spicy", "Less oil", "No onion, no garlic", "Make it mild for kids"];
  function noteTarget(S, t) {
    if (/\b(whole|entire|full|all|every)\s*(the\s+)?(order|thing|dishes|items)?\b|\beverything\b/.test(t)) return "__order";
    const inCart = matchItems(t.replace(NOTE_CUE, " ")).filter((r) => S.cart[r.i.id]);
    if (inCart.length) return inCart[0].i.id;
    if (S.lastItem && S.cart[S.lastItem]) return S.lastItem;
    const ids = Object.keys(S.cart);
    return ids.length === 1 ? ids[0] : null;
  }
  const noteName = (id) => (id === "__order" ? "your whole order" : "**" + ITEM[id].name + "**");
  function saveNote(S, id, note, say) {
    note = note.replace(/^[\s:,-]+|[\s.]+$/g, "");
    note = note.charAt(0).toUpperCase() + note.slice(1);
    if (id === "__order") S.orderNote = S.orderNote ? S.orderNote + "; " + note : note;
    else { const c = S.cart[id] || addToCart(S, id, 1); c.note = c.note ? c.note + "; " + note : note; }
    S.awaiting = null; S.noteFor = null;
    say(`Noted. I'll tell the chef “${note}” for ${noteName(id)}. You'll see it in your cart, and the chef gets it with your order.`, { chips: ["Show my cart", "Checkout", "Direct me to menu"], cartChanged: true });
  }
  function askNote(S, id, say, prefix) {
    S.awaiting = "note"; S.noteFor = id;
    const other = Object.keys(S.cart).length > 1 && id !== "__order" ? " Not this dish? Say another dish name or “whole order”." : "";
    say(`${prefix ? prefix + " " : ""}What should I tell the chef about ${noteName(id)}? Type it, tap the mic and say it, or record a voice note.${other}`, { chips: NOTE_CHIPS, noteFor: id });
  }
  function chefNote(S, text, t, say) {
    let prefix = "";
    // "add it also chef note" while a dish is being offered: add that dish first
    if (S.pending && /\b(add|yes|it|this|that)\b/.test(t)) {
      const id = S.pending.list[S.pending.idx]; S.pending = null; addToCart(S, id, 1);
      prefix = `Added **${ITEM[id].name}** to your cart.`;
    }
    // note text in the same message? ("chef note: less spicy", "tell the chef to make it mild")
    const m = text.match(/(?:chef|chief|cheif|shef)\s*(?:'s)?\s*(?:note|notes|instruction)?\s*(?:for|on)?\s*(?:the\s+)?[^:]*?(?::|-|that|to)\s*(.{3,})$/i) || text.match(/(?:chef|chief|cheif|shef)\s+(?:note|notes)\s+(.{3,})$/i);
    let note = m ? m[1].trim() : "";
    if (note && /^(add|please|pls|it|also|for|the|a)$/i.test(note)) note = "";
    if (note && matchItems(note).some((r) => S.cart[r.i.id] && r.ov / nameToks(r.i).length === 1) && note.split(" ").length <= 3) note = "";   // only a dish name, no instruction
    const id = noteTarget(S, t);
    if (!id) {
      if (!Object.keys(S.cart).length) { say(`${prefix}Add a dish first, then I'll pass your note to the chef. Or tell me the note for the whole order.`.trim(), { chips: ["Direct me to menu", "Note for the whole order"] }); return; }
      S.awaiting = "noteWhich"; S.noteText = note;
      say(`${prefix ? prefix + " " : ""}Which dish is the note for?`, { chips: Object.keys(S.cart).map((k) => ITEM[k].name).concat(["Whole order"]) });
      return;
    }
    if (note) { if (prefix) say(prefix); saveNote(S, id, note, say); return; }
    askNote(S, id, say, prefix);
  }
  function noteReply(S, text, t, say) {
    if (/^(cancel|skip|no|nothing|never mind|nevermind|leave it)$/.test(t)) { S.awaiting = null; S.noteFor = null; say("No problem, no note added."); return true; }
    if (/^(checkout|menu|show my cart|direct me to menu)$/.test(t)) { S.awaiting = null; return false; }
    if (S.awaiting === "noteWhich") {
      const id = /\bwhole|order|all|everything\b/.test(t) ? "__order" : (matchItems(t).filter((r) => S.cart[r.i.id])[0] || {}).i?.id;
      if (!id) { say("Which dish? Tap one of these.", { chips: Object.keys(S.cart).map((k) => ITEM[k].name).concat(["Whole order"]) }); return true; }
      const pre = S.noteText; S.noteText = null;
      if (pre) saveNote(S, id, pre, say); else askNote(S, id, say);
      return true;
    }
    // switching the dish: "dal makhani" / "whole order"
    if (/^(the )?(whole|full|entire)( order)?$|^all$|^everything$/.test(t)) { askNote(S, "__order", say); return true; }
    const sw = t.split(" ").length <= 4 && matchItems(t).filter((r) => S.cart[r.i.id] && r.ov / nameToks(r.i).length === 1)[0];
    if (sw && sw.i.id !== S.noteFor) { askNote(S, sw.i.id, say); return true; }
    saveNote(S, S.noteFor, text, say);
    return true;
  }

  function setName(S, n, say) {
    const words = n.split(/\s+/); const cut = words.findIndex((w, k) => k > 0 && (NAME_FILLER.has(w.toLowerCase()) || detectMood(w.toLowerCase())));
    S.name = (cut > 0 ? words.slice(0, cut) : words).filter((w) => !NAME_FILLER.has(w.toLowerCase())).slice(0, 2).map(cap).join(" ") || cap(words[0]);
    S.awaiting = "mood";
    say(`Nice to meet you, **${S.name}**! What is your mood today? Tell me in chat or tap the mic and say it.`, { chips: MOOD_CHIPS });
  }
  function moodReply(S, m, say, again) {
    S.lastMood = m; S.awaiting = null;
    const M = MOODS[m];
    const items = pickDiverse(retrieve(M.q, { k: 40, kind: "item", diet: S.diet }), 3);
    const intro = again ? `Here are ${S.diet === "veg" ? "veg" : "non-veg"} picks for your mood:` : `${M.r} You sound **${m === "hot" ? "overheated" : m}**${comma(S)}. From our menu:`;
    say(intro + (S.diet ? "" : "\nPrefer veg only? Just say “veg”."), { items: items.map((i) => itemRef(i, { add: true })), source: "Menu, matched to your mood" });
    offer(S, items, say);
  }
  function offer(S, items, say) { if (!items.length) return; S.pending = { list: items.map((i) => i.id), idx: 0 }; askPending(S, say); }
  function askPending(S, say) { const i = ITEM[S.pending.list[S.pending.idx]]; say(`Can I add **${i.name}** (${rs(i.price)}) to your cart?`, { chips: ["Yes, add it", "No, show another", "Direct me to menu"] }); }
  function acceptPending(S, say) {
    const id = S.pending.list[S.pending.idx]; S.pending = null; addToCart(S, id, 1);
    say(`Done! **${ITEM[id].name}** is in your cart. Cart total: **${rs(cartSub(S))}**.\nWant anything else? You can add a note for the chef from the menu or the cart.`, { chips: ["Suggest a dessert", "Show my cart", "Direct me to menu", "Checkout"], cartChanged: true });
  }
  function nextPending(S, say) {
    S.pending.idx++;
    if (S.pending.idx < S.pending.list.length) return askPending(S, say);
    S.pending = null;
    say("No problem. Tap **Direct me to menu** to see everything, or tell me any dish name and I'll add it.", { chips: ["Direct me to menu", "Something spicy", "Something sweet"] });
  }
  function addCmd(S, t, say, raw) {
    const FILL = /\b(please|pls|add|i want|want|order|get me|give me|ill have|i ll have|i will have|can i have|can i get|bring|put|to (my |the )?cart|in (my |the )?cart|to (my |the )?order|also|me|some|more|actually)\b/g;
    const rawParts = String(raw || t).split(/,|\+|&|\band\b|\baur\b|\bplus\b|\bwith\b/i).map((x) => norm(x).replace(FILL, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    const clean = t.replace(/\b(please|pls|add|i want|want|order|get me|give me|ill have|i ll have|i will have|can i have|can i get|bring|put|to (my |the )?cart|in (my |the )?cart|also|me|some|more)\b/g, " ");
    const parts = rawParts.length ? rawParts : clean.split(/\band\b|\bplus\b|\bwith\b|\baur\b/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    const added = [], missed = [], amb = [], capped = [];
    for (const p of parts) {
      const { qty, rest } = parseQty(p);
      const ms = matchItems(rest);
      if (!ms.length) { missed.push(rest); continue; }
      const best = ms[0], ties = ms.filter((r) => Math.abs(r.s - best.s) < 0.01);
      const coverName = best.ov / nameToks(best.i).length;
      if (ties.length > 1 || coverName < 0.5) { amb.push({ q: rest, opts: ms.slice(0, 4).map((r) => r.i) }); continue; }
      let q2 = qty; if (q2 > 50) { capped.push(best.i.name); q2 = 50; }
      addToCart(S, best.i.id, q2); added.push([best.i, S.cart[best.i.id].qty === 50 && q2 === 50 ? 50 : q2]);
    }
    if (added.length) say(`Added to your cart: ${added.map(([i, q]) => `**${q} × ${i.name}**`).join(", ")}. Cart total: **${rs(cartSub(S))}**.` + (missed.length ? `\nI couldn't find: ${missed.join(", ")}.` : "") + (capped.length ? `\nThe online limit is 50 per dish, so I added 50 ${capped.join(", ")}. For bigger orders, please talk to the counter.` : "") + (S.order && !S.order.paid ? `\nYour order **${S.order.no}** is already with the chef, so these are in a new cart. Place them as a separate order from checkout.` : ""), { chips: ["Show my cart", "Checkout", "Direct me to menu"], source: "Menu", cartChanged: true });
    amb.forEach((a) => say(`Which “${a.q.split(" ").map((w) => TYPO[w] || w).join(" ")}” do you mean? Tap **Add** on the one you want.`, { items: a.opts.map((i) => itemRef(i, { add: true })), source: "Menu" }));
    if (!added.length && !amb.length) {
      const r = retrieve(missed.join(" ") || t, { k: 3, kind: "item", diet: S.diet });
      if (r.length) say("I couldn't find that exact dish. Closest matches on our menu:", { items: r.map((x) => itemRef(x.d.ref, { add: true })), source: "Menu", chips: ["Direct me to menu"] });
      else say(`Sorry, I couldn't find “${missed.join(", ")}” on our menu. Try another name, or open the menu.`, { chips: ["Direct me to menu"] });
    }
  }
  function removeCmd(S, t, say) {
    const q = t.replace(/\b(remove|delete|cancel|minus|from|my|the|cart|please)\b/g, " ").trim();
    const { qty, rest } = parseQty(q);
    const inCart = matchItems(rest).filter((r) => S.cart[r.i.id]);
    if (!inCart.length) { say("That item isn't in your cart.", { chips: ["Show my cart"] }); return; }
    const i = inCart[0].i;
    setQty(S, i.id, S.cart[i.id].qty - (/^\d|^(one|two|three|a|an)\s/.test(q) ? qty : S.cart[i.id].qty));
    const left = S.cart[i.id] ? S.cart[i.id].qty : 0;
    say(left ? `Updated **${i.name}**. You now have **${left} × ${i.name}**. Cart total: **${rs(cartSub(S))}**.` : `Removed **${i.name}**. Cart total: **${rs(cartSub(S))}**.`, { chips: ["Show my cart"], cartChanged: true });
  }
  function showCart(S, say) {
    const v = cartView(S);
    if (!v.lines.length) { say("Your cart is empty. Tell me a dish or open the menu.", { chips: ["Direct me to menu"] }); return; }
    say(`Your cart has ${v.count} item${v.count > 1 ? "s" : ""}. Subtotal **${rs(v.bill.sub)}**, with 5% GST the total is **${rs(v.bill.total)}**.`, { items: v.lines.map((l) => itemRef(ITEM[l.id], { qty: l.qty, note: l.note || (l.voice ? "Voice note" : "") })), chips: ["Checkout", "Direct me to menu"] });
  }
  function goCheckout(S, say) {
    if (!cartCount(S)) { say("Your cart is empty right now. Add a dish first.", { chips: ["Direct me to menu"] }); return; }
    say("Taking you to checkout. Check your chef notes there and press **Place order**.", { action: { type: "navigate", to: "checkout" } });
  }
  function menuReply(say) {
    say(`We serve ${CATS.map((c) => "**" + c.label + "**").join(", ")}, with both veg and non-veg dishes.`, { chips: ["Direct me to menu", "Veg biryani", "Something sweet"], source: "Menu" });
  }
  /* ------------------------------------------------------------------ */
  /* Waiter brain: understand the request, filter the menu, answer like a waiter */
  const FACT_CUE = /\?|^(is|are|does|do|has|have|can|what|whats|which|how|tell|describe|kya)\b|\b(sweet|spicy|spice|veg|vegetarian|nonveg|egg|eggless|price|cost|how much|rate|how many|pieces|portion|quantity|plate|cold|chilled|hot|warm|contain|contains|made of|ingredients)\b/;
  const PAIR_CUE = /\b(goes with|go with|goes well|go well|pair|pairs|pairing|eat with|have with|along with|combo|side with)\b/;
  const CAT_WORDS = [
    [/\b(starter|starters|appetizer|appetizers|appetiser|kebab|kebabs|kabab)\b/, ["starters"], "starters"],
    [/\b(snack|snacks)\b/, ["starters", "bakes"], "snacks"],
    [/\b(bread|breads|roti|rotis|naan|naans|paratha|parathas|kulcha)\b/, ["bread"], "breads"],
    [/\b(biryani|biryanis)\b/, ["biryani"], "biryanis"],
    [/\b(rice|pulao)\b(?! pudding)/, ["rice", "biryani"], "rice dishes"],
    [/\b(gravy|gravies|curry|curries|main course|maincourse|mains|sabzi)\b/, ["gravy"], "curries"],
    [/\b(dessert|desserts|sweet|sweets|mithai|halwa)\b/, ["desserts", "icecream", "bakes"], "sweets"],
    [/\b(icecream|icecreams|kulfi|sundae|falooda|scoop)\b/, ["icecream"], "ice creams"],
    [/\b(tea|chai|coffee)\b/, ["chai"], "tea and coffee"],
    [/\b(drink|drinks|beverage|beverages|juice|juices|lassi|shake|soda|cooler)\b/, ["juices", "chai"], "drinks"],
    [/\b(cake|cakes|pastry|pastries|bakery|bakes|baked|puff|puffs|cookie|cookies|muffin)\b/, ["bakes"], "bakes"]
  ];
  const NEED_WORDS = new Set("dry fry fried crispy crunchy gravy curry curries spicy spice hot mild bland cold chilled warm cool veg vegetarian nonveg jain egg eggless meat chicken mutton keema fish prawn prawns seafood paneer dal lentil cheap cheapest budget affordable expensive costliest premium priciest under below above over less than within upto max rs inr rupees light healthy heavy filling kids kid children child share sharing group south indian tandoor tandoori vegan plant based dairy free mock fake chaap sweetish flavour flavours flavor flavors items kind special specials here bestseller bestsellers popular famous signature special best top must try something anything options dishes dish items item food foods some any which what kind type types do you have there want get give suggest recommend i me for to with without no not and or but a an the is are of in on starter starters appetizer snack snacks bread breads rice pulao biryani biryanis main course mains dessert desserts sweet sweets mithai icecream ice cream drink drinks beverage beverages juice juices tea chai coffee bakery bakes baked".split(" "));
  function parseNeeds(t) {
    const n = {};
    if (/\bvegan\b|plant based|dairy free|\bno dairy\b/.test(t)) { n.vegan = true; n.diet = "veg"; if (/\b(meat|chicken|mutton|mock|fake|chaap)\b/.test(t)) n.mockMeat = true; }
    else if (/\beggless\b|\b(?:without|no|dont eat|dont want|do not eat|not eating|avoid|allergic to|cant eat|cannot eat)\s+eggs?\b/.test(t)) { n.diet = "veg"; n.eggless = true; }
    else if (/\b(?:without|no|dont eat|dont want|do not eat|not eating|avoid|allergic to|cant eat|cannot eat)\s+(meat|chicken|mutton|fish|nonveg)\b|\b(not|zero)\s+(meat|nonveg)\b|\bjain\b/.test(t)) n.diet = "veg";
    else if (/\bnonveg\b|\b(meat|seafood)\b/.test(t)) n.diet = "nonveg";
    else if (/\b(veg|vegetarian|pure veg)\b/.test(t)) n.diet = "veg";
    const pr = [];
    if (/\bchicken\b/.test(t)) pr.push("chicken"); if (/\b(mutton|keema|lamb|goat)\b/.test(t)) pr.push("mutton");
    if (/\b(fish|seafood)\b/.test(t)) pr.push("fish"); if (/\b(prawn|prawns|shrimp|seafood)\b/.test(t)) pr.push("prawn");
    if (/\beggs?\b/.test(t) && !n.eggless) pr.push("egg");
    if (/\bpaneer\b/.test(t)) pr.push("paneer"); if (/\b(dal|daal|lentil|lentils)\b/.test(t)) pr.push("dal"); if (/\bmushroom/.test(t)) pr.push("mushroom");
    if (n.vegan) pr.length = 0;
    if (pr.length) { n.protein = pr; if (!n.diet) n.diet = pr.every((x) => ["paneer", "dal", "mushroom"].includes(x)) ? "veg" : pr.some((x) => ["paneer", "dal", "mushroom"].includes(x)) ? undefined : "nonveg"; if (!n.diet) delete n.diet; }
    const cats = [];
    for (const [re, c, label] of CAT_WORDS) if (re.test(t)) { if (!(label === "rice dishes" && cats.includes("biryani"))) cats.push(...c); n.catLabel = n.catLabel || label; }
    if (/\b(sweet|sweets|dessert|desserts|mithai)\b/.test(t)) n.sweet = true;
    if (/\bsweet(ish)?\b/.test(t) && /\b(gravy|gravies|curry|curries|sabzi|masala)\b/.test(t)) { cats.length = 0; cats.push("gravy"); n.sweet = false; n.sweetGravy = true; n.catLabel = "curries"; }
    if (cats.length) n.cats = [...new Set(cats)];
    const drinkish = /\b(drink|drinks|beverage|juice|tea|chai|coffee|milk|dessert|desserts|sweet|sweets|icecream)\b/.test(t);
    if (/\b(cold|chilled|cool|refreshing)\b/.test(t) && (drinkish || /\bto drink\b/.test(t) || !cats.length)) { n.temp = "cold"; if (!n.cats) { n.cats = ["juices", "icecream", "desserts"]; n.catLabel = "cold treats"; } }
    else if (/\b(hot|warm)\b/.test(t) && drinkish) n.temp = "hot";
    if (/\b(not|no|less|without|non|low|zero)\s+(very\s+|too\s+|so\s+)?(spicy|spice|hot|chilli|teekha)\b|\bmild\b|\bbland\b/.test(t)) n.spiceMax = 1;
    else if (/\b(spicy|fiery|teekha|tikha|chilli|chili)\b/.test(t) || (/\bhot\b/.test(t) && !n.temp)) n.spiceMin = 2;
    if (/\b(kid|kids|child|children|baby)\b/.test(t)) { n.spiceMax = 1; n.kids = true; }
    if (/fried rice/.test(t)) { /* a dish name, not a texture */ }
    else if (/\b(dry|fry|fried|crispy|crunchy)\b/.test(t)) n.texture = "dry";
    else if (/\b(gravy|curry|curries)\b/.test(t)) n.texture = "gravy";
    let m = /(?:under|below|less than|within|upto|up to|max|maximum|budget of|budget)\s*(?:rs|inr|rupees)?\s*(\d{2,4})/.exec(t); if (m) n.priceMax = +m[1];
    m = /(?:above|over|more than|minimum)\s*(?:rs|inr|rupees)?\s*(\d{2,4})/.exec(t); if (m) n.priceMin = +m[1];
    if (/\b(cheap|cheapest|budget|affordable|economical|low cost|lowest price|inexpensive)\b/.test(t)) n.sort = "asc";
    if (/\b(expensive|costliest|premium|priciest|most expensive|luxury)\b/.test(t)) n.sort = "desc";
    if (/\b(popular|bestseller|bestsellers|best seller|famous|signature|special|specials|must try|best|top)\b/.test(t)) n.popular = true;
    if (/\b(light|not heavy|not too heavy|low calorie)\b/.test(t)) n.light = true;
    if (/\b(healthy|diet|nutritious)\b/.test(t)) n.healthy = true;
    if (/\b(heavy|filling|hearty)\b/.test(t) && !n.light) n.heavy = true;
    if (/\b(share|sharing|group|party|friends|family)\b/.test(t)) n.share = true;
    if (/south indian|\b(chettinad|kerala|tamil)\b/.test(t)) n.south = true;
    if (/\btandoor|tandoori\b/.test(t)) n.tandoor = true;
    n.residual = toks(t).filter((w) => !NEED_WORDS.has(w) && w.length > 2 && !/^\d+$/.test(w));
    n.has = Object.keys(n).some((k) => !["residual", "catLabel", "kids", "eggless"].includes(k));
    return n;
  }
  function strongDish(t, min) {
    const ms = matchItems(t); if (!ms.length) return null;
    // a dish word that names exactly one dish ("chole"), not a describing word ("sweet", "dry")
    if (ms.length === 1 && !min && toks(t).some((w) => nameToks(ms[0].i).includes(w) && !NEED_WORDS.has(w) && !["sweet", "fresh", "plain", "classic", "royal", "hot", "special", "mix"].includes(w))) return ms[0].i;
    const b = ms[0], cover = b.ov / nameToks(b.i).length;
    const ties = ms.filter((r) => Math.abs(r.s - b.s) < 0.01);
    return ties.length === 1 && cover >= (min || 0.66) && (nameToks(b.i).length > 1 || cover === 1) && b.ov >= Math.min(2, nameToks(b.i).length) ? b.i : null;
  }
  function filterMenu(n, relax) {
    const r = relax || new Set();
    return MENU.filter((i) =>
      (!n.diet || r.has("diet") || (n.diet === "veg" ? i.veg : !i.veg)) &&
      (!n.cats || r.has("cats") || n.cats.includes(i.cat)) &&
      (!n.protein || r.has("protein") || n.protein.includes(i.protein)) &&
      (!n.texture || r.has("texture") || (n.texture === "dry" ? i.texture === "dry" || i.texture === "semi-dry" : i.texture === n.texture)) &&
      (n.spiceMax == null || r.has("spice") || i.spice <= n.spiceMax) &&
      (n.spiceMin == null || r.has("spice") || i.spice >= n.spiceMin) &&
      (n.priceMax == null || r.has("price") || i.price <= n.priceMax) &&
      (n.priceMin == null || r.has("price") || i.price >= n.priceMin) &&
      (!n.temp || r.has("temp") || i.temp === n.temp) &&
      (!n.sweet || /sweet/.test(i.tags)) &&
      (!n.vegan || i.vegan) && (!n.sweetGravy || i.sweetish) &&
      (!n.light || (/light|healthy|soothing/.test(i.tags) && !/filling|hearty|rich/.test(i.tags))) &&
      (!n.healthy || (/healthy|light/.test(i.tags) && !/filling|hearty|rich/.test(i.tags))) &&
      (!n.heavy || /filling|hearty/.test(i.tags)) &&
      (!n.south || i.south) && (!n.tandoor || i.tandoor) &&
      (!n.popular || n.cats || n.protein || n.diet || n.texture || n.temp || i.popular));
  }
  function phraseOf(n) {
    const w = [];
    if (n.spiceMin) w.push("spicy"); if (n.spiceMax != null) w.push(n.kids ? "kid-friendly" : "mild");
    if (n.temp && !(n.catLabel || "").includes(n.temp)) w.push(n.temp === "cold" ? "cold" : "hot");
    if (n.texture && !n.sweetGravy) w.push(n.texture); if (n.sweetGravy) w.push("mildly sweet, creamy"); if (n.light) w.push("light"); if (n.healthy) w.push("healthy");
    if (n.south) w.push("South Indian"); if (n.tandoor) w.push("tandoori");
    if (n.diet) w.push(n.vegan ? "vegan" : n.eggless ? "eggless" : n.diet === "veg" ? "veg" : "non-veg");
    if (n.protein) w.push(n.protein.join(" and "));
    w.push(n.catLabel || (n.sweet ? "sweets" : n.popular && !n.diet && !n.protein ? "house specials" : "dishes"));
    let s = w.join(" ");
    if (n.priceMax) s += ` under ₹${n.priceMax}`; if (n.priceMin) s += ` above ₹${n.priceMin}`;
    return s;
  }
  const RELAX = [["price", (n) => n.priceMax || n.priceMin], ["spice", (n) => n.spiceMax != null || n.spiceMin], ["temp", (n) => n.temp], ["texture", (n) => n.texture], ["protein", (n) => n.protein], ["cats", (n) => n.cats], ["diet", (n) => n.diet]];
  function waiter(S, t, n, say) {
    // house questions (timings, Jain food, GST...) come from the info pages
    const info = retrieve(t, { k: 1, kind: "info" })[0];
    if (info && info.score >= 0.3 && !(n.cats || n.protein || n.texture || n.temp || n.south || n.tandoor || n.priceMax || n.sort)) { say(info.d.ref.text, { source: info.d.ref.title }); return; }
    let list = filterMenu(n), relaxed = null;
    if (!list.length) for (const [k, on] of RELAX) { if (!on(n)) continue; const l = filterMenu(n, new Set([k])); if (l.length) { list = l; relaxed = k; break; } }
    // narrow by any dish words left in the question ("lassi", "kebab"...)
    if (n.residual.length) { const named = list.filter((i) => n.residual.some((w) => toks(i.name).includes(w))); if (named.length) list = named; }
    if (!list.length) { notOnMenu(S, t, say); return; }
    const sim = n.residual.length ? Object.fromEntries(retrieve(n.residual.join(" "), { k: 80, kind: "item" }).map((r) => [r.d.ref.id, r.score])) : {};
    const POP_RANK = [...POPULAR];
    const score = (i) => (i.popular ? 0.5 + (n.popular ? (POP_RANK.length - POP_RANK.indexOf(i.id)) * 0.02 : 0) : 0) + (sim[i.id] || 0) + (n.spiceMin ? i.spice * 0.12 : 0) + (n.spiceMax != null ? (1 - i.spice) * 0.1 : 0) - (i.texture === "semi-dry" ? 0.3 : 0) + (n.share && /share/.test(i.tags) ? 0.3 : 0);
    list.sort((a, b) => n.sort === "asc" ? a.price - b.price : n.sort === "desc" ? b.price - a.price : score(b) - score(a) || a.price - b.price);
    const askHave = /^(do you have|do u have|you have|have you got|is there|are there|any)\b/.test(t);
    const shown = list.slice(0, askHave ? 5 : 4), top = shown[0], phrase = phraseOf(n);
    let intro;
    if (n.mockMeat) intro = "We don't have plant-based or mock meat, sorry. These dishes are fully vegan (no dairy, egg or meat):";
    else if (n.popular && !n.cats && !n.protein && !n.diet && !n.texture) intro = "Our house specials, the dishes guests order most:";
    else if (n.sweetGravy && !relaxed) intro = "For a mildly sweet, creamy gravy, try our makhani-style curries:";
    else if (relaxed) intro = `We don't have ${phrase} right now. The closest options are:`;
    else if (askHave) intro = `Yes, we do! Here ${list.length === 1 ? "is our" : "are our"} ${phrase}:`;
    else if (n.sort === "asc") intro = `Our most affordable ${phrase}:`;
    else if (n.sort === "desc") intro = `Our premium ${phrase}:`;
    else intro = `Sure! For ${phrase}, here's what I'd suggest:`;
    const why = top.popular ? "It's one of our bestsellers." : n.sort === "asc" ? `It's the lightest on your pocket at ${rs(top.price)}.` : n.sort === "desc" ? "It's our most premium choice." : top.spice >= 3 ? "It's properly fiery." : n.spiceMax != null ? (top.spice === 0 ? "No spice at all." : "Only lightly spiced.") : "";
    say(intro, { items: shown.map((i) => itemRef(i, { add: true })), source: "Menu" });
    say(`My pick: **${top.name}**. ${top.desc}${why ? " " + why : ""}${n.vegan ? " For fully vegan, add a chef note: “cook in oil, no ghee or butter”." : ""}`);
    offer(S, shown, say);
  }
  function notOnMenu(S, t, say) {
    const what = t.replace(/^(do you have|do u have|you have|have you got|is there|are there|any|can i get|i want)\s+/, "").replace(/\b(please|pls|here|today)\b/g, "").trim();
    say(`Sorry, we don't have ${what || "that"} on our menu. We're a dhaba and bakery, so you'll find tandoor breads, curries, biryani, starters, drinks, desserts and bakes.`, { chips: ["Direct me to menu", "What is your bestseller?", "Something spicy"] });
  }
  function itemFacts(S, i, t, say, catLabel) {
    const bits = [];
    if (PAIR_CUE.test(t)) {
      const pairs = pairsFor(i);
      say(`${catLabel ? "Our " + catLabel : "**" + i.name + "**"} ${catLabel ? "go" : "goes"} best with these:`, { items: pairs.map((p) => itemRef(p, { add: true })), source: "Menu" });
      offer(S, pairs, say); return;
    }
    const spiceQ = /\b(spicy|spice|teekha|mild)\b/.test(t) || (/\bhot\b/.test(t) && !i.temp);
    if (spiceQ) bits.push(["isn't spicy at all", "is mild, only lightly spiced", "is medium spicy", "is hot and spicy"][i.spice].replace(/^/, `**${i.name}** `) + "." + (i.spice >= 2 ? " Want it milder? Add a chef note like “less spicy”." : ""));
    if (/\bsweet(ish)?\b/.test(t)) bits.push(i.sweetish ? `**${i.name}** is mildly sweet and creamy, from the tomato-butter makhani gravy.` : /sweet/.test(i.tags) ? `**${i.name}** is sweet.` : `**${i.name}** isn't sweet; it's a savoury dish.`);
    if (/\b(veg|vegetarian|nonveg|meat)\b/.test(t)) bits.push(`**${i.name}** is ${i.veg ? "vegetarian" : "non-veg"}${i.egg ? " (it has egg)" : ""}.`);
    if (/\b(egg|eggs|eggless)\b/.test(t)) bits.push(i.egg ? `**${i.name}** contains egg.` : `**${i.name}** is eggless.`);
    if (/\b(price|cost|how much|rate|rs|rupees)\b/.test(t)) bits.push(`**${i.name}** is ${rs(i.price)}.`);
    if (/\b(how many|pieces|piece|pcs|portion|quantity|plate|serves|size)\b/.test(t)) bits.push(i.portion ? `It comes as ${i.portion}, for ${rs(i.price)}.` : `It's one regular portion, ${rs(i.price)}.`);
    if (/\b(cold|chilled|cool|warm)\b/.test(t) || (/\bhot\b/.test(t) && i.temp)) bits.push(i.temp === "cold" ? `**${i.name}** is served chilled.` : i.temp === "hot" ? `**${i.name}** is served hot.` : `**${i.name}** is served fresh off the kitchen.`);
    const desc = `${i.desc}${i.portion && !bits.some((b) => b.includes(i.portion)) ? " (" + i.portion + ")" : ""}`;
    if (!bits.length) bits.push(`**${i.name}**: ${desc} It's ${i.veg ? "veg" : "non-veg"}, ${i.spice ? SPICE[i.spice].toLowerCase() + " spicy" : "not spicy"}, ${rs(i.price)}.${i.popular ? " One of our bestsellers!" : ""}`);
    else bits.push(desc);
    say(bits.join(" "), { items: [itemRef(i, { add: true })], source: "Menu: " + i.name });
    offer(S, [i], say);
  }
  function pairsFor(i) {
    const pick = (ids) => ids.map((x) => ITEM[x]).filter(Boolean);
    if (i.cat === "gravy") return pick(["butter-naan", "garlic-naan", "lachha-paratha", "jeera-rice"]);
    if (i.cat === "biryani") return pick(["masala-chaas", "sweet-lassi", "mango-lassi"]);
    if (i.cat === "bread") return pick(i.veg ? ["dal-makhani", "paneer-butter-masala", "chole-masala"] : ["butter-chicken", "mutton-rogan-josh", "dal-makhani"]);
    if (i.cat === "rice") return pick(i.veg ? ["dal-tadka", "dal-makhani", "palak-paneer"] : ["chicken-chettinad", "egg-curry", "dal-tadka"]);
    if (i.cat === "starters") return pick(["fresh-lime-soda", "masala-chaas", "mango-lassi"]);
    if (i.cat === "icecream") return pick(["chocolate-truffle-pastry", "butter-cookies-200-g"]);
    if (i.cat === "chai") return pick(["veg-puff", "butter-cookies-200-g", "banana-walnut-muffin"]);
    if (i.cat === "desserts" || i.cat === "bakes") return pick(["masala-chai", "filter-coffee"]);
    return pick(["veg-puff", "crispy-corn"]);
  }

  function recommend(S, t, say) {
    const q = t.replace(/\b(suggest|recommend|recommendation|best|special|popular|famous|signature|what should i|what to eat|surprise|me|something|eat|dish|dishes|have|item|items)\b/g, " ").trim();
    let r = retrieve(q || "classic celebrate rich", { k: 12, kind: "item", diet: S.diet });
    if (!r.length) r = retrieve("classic celebrate rich", { k: 12, kind: "item", diet: S.diet });
    const items = q ? r.slice(0, 3).map((x) => x.d.ref) : pickDiverse(r, 3);
    say(q ? "Here's what fits from our menu:" : "Our house favourites:", { items: items.map((i) => itemRef(i, { add: true })), source: "Menu" });
    offer(S, items, say);
  }
  function answer(S, t, say) {
    const diet = /\bnonveg\b/.test(t) ? "nonveg" : /\b(veg|vegetarian)\b/.test(t) ? "veg" : null;
    const r = retrieve(t, { k: 6, diet });
    if ((!r.length || r[0].score < 0.06) && /^(do you have|do u have|you have|have you got|is there|are there|any)\b/.test(t)) { notOnMenu(S, t, say); return; }
    const gibberish = !t.trim() || /[^aeiou\s\d]{5,}/.test(t) || !/[aeiouy]/.test(t);
    if ((!r.length || r[0].score < 0.06) && gibberish) { say("Sorry, I didn't catch that. You can ask me things like “dry non veg”, “something sweet” or “is paneer tikka spicy?”, or tap Direct me to menu.", { chips: ["Direct me to menu", "What is your bestseller?", "Something spicy"] }); return; }
    if ((!r.length || r[0].score < 0.06) && t.split(" ").length <= 3 && !/\b(what|how|why|when|where|who)\b/.test(t)) { notOnMenu(S, t, say); return; }
    if (!r.length || r[0].score < 0.06) { say("I couldn't find that in our menu or house info. Try asking about a dish (like “paneer” or “chicken biryani”), our timings, payment, or tell me your mood.", { chips: ["What are your timings?", "Veg biryani", "Something sweet"] }); return; }
    const top = r[0];
    if (top.d.kind === "info" && (top.score >= 0.12 || r.filter((x) => x.d.kind === "item").length === 0)) { say(top.d.ref.text, { source: top.d.ref.title }); return; }
    const items = r.filter((x) => x.d.kind === "item").slice(0, 4).map((x) => x.d.ref);
    const ask = /\b(price|cost|how much|rate)\b/.test(t);
    const question = /^(is|are|does|has|kya)\b/.test(t) || /\b(eggless|contain|contains)\b/.test(t);
    if (question && r[0].d.kind === "item") {
      const i = r[0].d.ref;
      say(`**${i.name}**: ${i.desc} It is ${i.veg ? "veg" : "non-veg"}, ${i.spice ? SPICE[i.spice].toLowerCase() + " spicy" : "not spicy"}, ${rs(i.price)}.`, { items: [itemRef(i, { add: true })], source: "Menu: " + i.name });
      offer(S, [i], say);
      return;
    }
    say(ask ? "Prices from our menu:" : "From our menu:", { items: items.map((i) => itemRef(i, { add: true })), source: "Menu" });
    if (items.length) offer(S, items.slice(0, 1), say);
  }

  /* ------------------------------------------------------------------ */
  /* Order lifecycle (the chat narrates every stage)                    */
  /* ------------------------------------------------------------------ */
  const STAGES = ["Placed", "Sent to chef", "Cooking", "Ready", "Bill", "Paid", "Feedback"];
  const STAGE_AT = [0, 2000, 5000, 10000, 12500]; // ms after placing; stages 5-6 follow payment and feedback

  function placeOrder(S, details, now) {
    if (!cartCount(S)) throw new Error("EMPTY_CART");
    details = details || {};
    if (details.name && String(details.name).trim()) S.name = String(details.name).trim().split(/\s+/).slice(0, 2).map(cap).join(" ");
    const items = Object.entries(S.cart).filter(([id]) => ITEM[id]).map(([id, c]) => ({ id, name: ITEM[id].name, cat: ITEM[id].cat, veg: ITEM[id].veg, price: ITEM[id].price, qty: c.qty, amount: ITEM[id].price * c.qty, note: c.note || "", voice: c.voice || null }));
    const sub = items.reduce((a, x) => a + x.amount, 0);
    const order = {
      no: "NDB-" + (1000 + Math.floor(Math.random() * 9000)),
      customer: S.name || "", mode: details.mode === "take" ? "take" : "dine", table: details.mode === "take" ? "" : String(details.table || "").slice(0, 6),
      items, bill: bill(sub), note: S.orderNote || "", voice: S.orderVoice || null,
      placedAt: now || Date.now(), stage: 0, paid: false, payment: null, feedback: null
    };
    S.order = order; S.cart = {}; S.orderNote = ""; S.orderVoice = null; S.pending = null; S.awaiting = null;
    const n = items.reduce((a, x) => a + x.qty, 0);
    return {
      order,
      messages: [{ role: "bot", text: `Order **${order.no}** placed${comma(S)}! ${n} item${n > 1 ? "s" : ""}, ${order.mode === "dine" ? "dine-in at table " + (order.table || "-") : "takeaway"}.`, items: items.map((x) => itemRef(ITEM[x.id], { qty: x.qty, price: x.amount })) }]
    };
  }

  function stageMessages(S, o, stage) {
    const m = [];
    const say = (text, x) => m.push(Object.assign({ role: "bot", text }, x || {}));
    if (stage === 1) {
      const notes = o.items.filter((x) => x.note || x.voice);
      if (notes.length || o.note || o.voice) {
        const lines = notes.map((x) => `• ${x.name}: ${x.note ? "“" + x.note + "”" : ""}${x.voice ? (x.note ? " + " : "") + "voice note" : ""}`);
        if (o.note || o.voice) lines.push(`• Whole order: ${o.note ? "“" + o.note + "”" : ""}${o.voice ? (o.note ? " + " : "") + "voice note" : ""}`);
        say("Your order has been sent to the chef. The chef received these notes:\n" + lines.join("\n"));
      } else say("Your order has been sent to the chef. No special notes, so it will be cooked the house way.");
    }
    if (stage === 2) {
      const cats = new Set(o.items.map((x) => x.cat)), bits = [];
      if (cats.has("biryani")) bits.push("your biryani is on dum");
      if (cats.has("bread") || cats.has("starters")) bits.push("the tandoor is fired up");
      if (cats.has("gravy")) bits.push("the kadai is on the flame");
      if (cats.has("juices") || cats.has("chai")) bits.push("drinks are being made fresh");
      if (cats.has("desserts") || cats.has("icecream") || cats.has("bakes")) bits.push("sweets will be plated last so they're served at the right temperature");
      say(`Your order is getting ready: ${bits.length ? bits.join(", ") : "the chef is on it"}. About 15–25 minutes in the kitchen.`);
    }
    if (stage === 3) say(o.mode === "dine" ? `Your order is ready and on its way to table ${o.table || "-"}. Enjoy your meal!` : "Your takeaway order is ready and packed at the counter. Enjoy!");
    if (stage === 4) {
      say("Here is your bill:", { bill: { no: o.no, at: o.placedAt, mode: o.mode, table: o.table, customer: o.customer, lines: o.items.map((x) => ({ name: x.name, qty: x.qty, amount: x.amount })), ...o.bill } });
      S.awaiting = "payment";
      say(`How would you like to pay **${rs(o.bill.total)}**?`, { chips: ["UPI", "Card", "Cash"] });
    }
    return m;
  }

  /** Move the active order forward in time. Returns new bot messages. */
  function advanceOrder(S, now) {
    const o = S.order; if (!o || o.paid) return [];
    const elapsed = (now || Date.now()) - o.placedAt;
    let target = 0; STAGE_AT.forEach((t, i) => { if (elapsed >= t) target = i; });
    const out = [];
    while (o.stage < target) { o.stage++; out.push(...stageMessages(S, o, o.stage)); }
    return out;
  }
  function askPay(S, say) { S.awaiting = "payment"; say(`How would you like to pay **${rs(S.order.bill.total)}**?`, { chips: ["UPI", "Card", "Cash"] }); }
  function pay(S, method, say) {
    const o = S.order; S.awaiting = null;
    o.paid = true; o.stage = 5;
    o.payment = { method, ref: (method === "Cash" ? "CSH" : "TXN") + String(Date.now()).slice(-8), at: Date.now() };
    say(`Payment of **${rs(o.bill.total)}** by **${method}** received. Reference **${o.payment.ref}**. Thank you!`, { source: "Demo payment: no real money is charged" });
    o.stage = 6; S.awaiting = "feedback";
    say(`How was the food${comma(S)}? Rate it or tell me in your own words.`, { chips: ["★★★★★ Loved it", "★★★★ Good", "★★★ Okay", "★★ Not great", "★ Bad"] });
  }
  function feedback(S, text, t, say) {
    S.awaiting = null;
    let stars = (text.match(/★/g) || []).length;
    const n = t.match(/\b([1-5])\b/); if (!stars && n) stars = +n[1];
    const neg = /\b(bad|cold|salty|oily|bland|late|slow|worst|poor|not good|not great|awful|terrible|too spicy|bekar|bakwas|kharab|thanda)\b/.test(t) || /\b(accha|achha|acha|badiya|badhiya|theek)\s+(nahi|nai|nhi)\b/.test(t);
    const pos = !neg && /\b(good|great|tasty|yummy|delicious|awesome|amazing|loved|love|excellent|nice|superb|perfect|best|fantastic|wonderful|badiya|badhiya|mast|swadisht|zabardast|shandaar|accha|achha|acha|lajawab)\b/.test(t) && !/\bnot\b/.test(t);
    const praise = /\b(good|great|tasty|yummy|delicious|awesome|amazing|loved|excellent|nice|superb|perfect|best|fantastic|wonderful|badiya|badhiya|mast|swadisht)\b/.test(t);
    if (praise && neg && /\b(but|though|however|lekin|par)\b/.test(t)) {
      if (!stars) stars = 3;
      if (S.order) { S.order.feedback = { stars, text, at: Date.now() }; S.order.stage = 7; }
      say(`Glad you enjoyed the food${comma(S)}, and sorry about what went wrong. I've passed both to the chef and the manager so we can fix it.\nVisit NASH Dhabha & Bakes again soon!`, { chips: ["Start a new order"] });
      return;
    }
    if (!stars) stars = neg ? 2 : pos ? 5 : 3;
    const reply = stars >= 4 ? `Thank you${comma(S)}! So happy you enjoyed it. I've passed your ${stars}-star review to the chef.`
      : stars === 3 ? "Thanks for the honest feedback. I've shared it with the kitchen so we can do better next time."
      : "Sorry the food didn't meet your expectations. I've sent your feedback to the chef and the manager so they can fix it.";
    if (S.order) { S.order.feedback = { stars, text, at: Date.now() }; S.order.stage = 7; }
    say(reply + "\nVisit NASH Dhabha & Bakes again soon!", { chips: ["Start a new order"] });
  }

  /* ------------------------------------------------------------------ */
  /* Retrieval context for an AI model, and strict checks on what it says */
  const LLM_ROUTES = new Set(["waiter", "facts", "answer", "recommend", "menu"]);
  function dishFact(i) {
    return { id: i.id, name: i.name, category: CATNAME[i.cat], veg: i.veg, vegan: i.vegan, egg: i.egg, price: i.price, spice: SPICE[i.spice] || "not spicy",
      texture: i.texture, main: i.protein, served: i.temp, portion: i.portion, bestseller: i.popular, south_indian: i.south, tandoori: i.tandoor, mildly_sweet_gravy: i.sweetish, description: i.desc,
      goes_with: pairsFor(i).map((p) => p.name) };
  }
  function contextFor(S, text, ruleMsgs) {
    const t = fixWords(norm(text)), n = parseNeeds(t);
    const ids = new Set();
    (ruleMsgs || []).forEach((m) => (m.items || []).forEach((r) => ids.add(r.id)));
    const filtered = n.has ? filterMenu(n) : [];
    if (filtered.length) filtered.slice(0, 14).forEach((i) => ids.add(i.id));   // precise: only dishes that meet the request
    else {
      matchItems(t).slice(0, 6).forEach((r) => ids.add(r.i.id));
      retrieve(t, { k: 10, kind: "item" }).forEach((r) => ids.add(r.d.ref.id));
    }
    if (!filtered.length && ids.size < 6) MENU.filter((i) => i.popular).slice(0, 6).forEach((i) => ids.add(i.id));
    const items = [...ids].slice(0, 24).map((id) => dishFact(ITEM[id]));
    const info = retrieve(t, { k: 3, kind: "info" }).map((r) => ({ title: r.d.ref.title, text: r.d.ref.text }));
    return {
      customer: { name: S.name || null, diet_preference: S.diet || null, cart: cartView(S).lines.map((l) => `${l.qty} x ${l.name}`), active_order: S.order ? { no: S.order.no, stage: STAGES[Math.min(S.order.stage, 6)] } : null },
      categories: CATS.map((c) => c.label), items, info,
      draft: { reply: (ruleMsgs || []).map((m) => m.text.replace(/\*\*/g, "")).join(" "), dish_ids: (ruleMsgs || []).flatMap((m) => (m.items || []).map((r) => r.id)) },
      message: text
    };
  }
  /** Turn an AI answer into chat messages, or return null if it breaks the rules (unknown dish, wrong price). */
  function llmApply(S, ans, ctx) {
    if (!ans || typeof ans.reply !== "string" || !ans.reply.trim()) return null;
    const allowed = new Set(ctx.items.map((i) => i.id));
    const ids = [...new Set((ans.dish_ids || []).filter((id) => ITEM[id] && allowed.has(id)))].slice(0, 5);
    if ((ans.dish_ids || []).some((id) => !ITEM[id])) return null;            // invented a dish
    const prices = new Set(MENU.map((i) => i.price));
    const quoted = (ans.reply.match(/(?:₹|rs\.?\s?|inr\s?)(\d{2,4})/gi) || []).map((x) => +x.replace(/\D/g, ""));
    if (quoted.some((p) => !prices.has(p) && p !== cartView(S).bill.total && p !== cartView(S).bill.sub)) return null;   // invented a price
    const named = MENU.filter((i) => new RegExp("\\b" + i.name.replace(/[()]/g, "").replace(/[-/\\^$*+?.|[\]{}]/g, "\\$&") + "\\b", "i").test(ans.reply.replace(/[()]/g, "")));
    if (named.some((i) => !allowed.has(i.id) && !ids.includes(i.id))) return null;   // talked about a dish outside the retrieved context
    const out = [{ role: "bot", text: ans.reply.trim().slice(0, 700), items: ids.map((id) => itemRef(ITEM[id], { add: true })), source: "Gemini · grounded in our menu", ai: true }];
    S.pending = null;
    const offerId = ans.offer_id && ITEM[ans.offer_id] && allowed.has(ans.offer_id) ? ans.offer_id : null;
    if (offerId) { S.pending = { list: [offerId].concat(ids.filter((x) => x !== offerId)), idx: 0 }; out.push({ role: "bot", text: `Can I add **${ITEM[offerId].name}** (${rs(ITEM[offerId].price)}) to your cart?`, chips: ["Yes, add it", "No, show another", "Direct me to menu"] }); }
    return out;
  }

  function welcome() {
    return [{ role: "bot", text: `Namaste! I'm **${BOT_NAME}**, your table-side friend at NASH Dhabha & Bakes.\nSay **hi** to start. I'll ask your mood and suggest dishes from our menu. You can type or tap the mic to speak.`, chips: ["Hi", "What are your timings?", "Veg biryani"] }];
  }

  return {
    BOT_NAME, CATS, MENU, ITEM, CATNAME, INFO, SPICE, STAGES, STAGE_AT, MOOD_CHIPS,
    createState, chat, welcome, retrieve, matchItems, norm, contextFor, llmApply, LLM_ROUTES,
    addToCart, setQty, setNote, cartView, bill, placeOrder, advanceOrder
  };
});
