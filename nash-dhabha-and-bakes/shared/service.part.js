  /* ================================================================== */
  /* Waiter service: staff hand-off, order care, assistance, languages   */
  /* ================================================================== */

  // Today's special rotates by weekday (restaurant data — edit here)
  const SPECIALS = { 0: ["chicken-dum-biryani", "veg-dum-biryani"], 1: ["hyderabadi-mutton-biryani", "paneer-tikka-biryani"], 2: ["kerala-fish-curry", "palak-paneer"],
    3: ["chicken-chettinad", "mix-veg-kolhapuri"], 4: ["butter-chicken", "paneer-butter-masala"], 5: ["mutton-rogan-josh", "kadai-paneer"], 6: ["tandoori-chicken-half", "paneer-tikka"] };
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Allergens, only where the menu text states them; anything else must be confirmed by staff
  const ALLERGEN = {
    peanuts: { label: "peanuts", re: /peanut/i },
    nuts: { label: "nuts", re: /peanut|\bnuts?\b|pista|almond|badam|walnut|praline|cashew/i },
    dairy: { label: "dairy", re: /paneer|butter|cream|curd|yoghurt|milk|malai|khoya|ghee|lassi|kulfi|rabri|chenna|cheese|chaas|ice cream|sundae|falooda/i },
    gluten: { label: "gluten (wheat)", re: /naan|roti|paratha|kulcha|bread|cake|pastry|cookies|muffin|puff|wheat/i },
    egg: { label: "egg", re: /\begg\b|contains egg/i }
  };

  function staffRequest(S, type, detail, priority) {
    const r = { id: "REQ-" + (1000 + Math.floor(Math.random() * 9000)), type, text: detail, priority: priority || "normal", at: Date.now(),
      table: (S.order && S.order.table) || S.table || "", customer: S.name || "", orderNo: S.order ? S.order.no : null, status: "open" };
    (S.requests = S.requests || []).push(r);
    if (!r.table && (!S.awaiting || S.awaiting === "mood") && type !== "seating") S.awaiting = "staffTable";   // a table number in the next message is attached to the request
    return r;
  }
  const where = (S) => ((S.order && S.order.table) || S.table ? ` to table ${(S.order && S.order.table) || S.table}` : "");
  const askTableHint = (S) => ((S.order && S.order.table) || S.table ? "" : " Tell me your table number so they can find you quickly.");

  const ITEM_REQ = /\b(water|chair|chairs|spoon|spoons|fork|forks|plate|plates|napkin|napkins|tissue|tissues|glass|glasses|knife|bowl|straw|straws|ice|high chair|baby chair|salt|pepper|ketchup|sauce|pickle|onion slices|lemon)\b/;

  function orderStatusText(o) {
    if (o.cancelled) return `Order **${o.no}** was cancelled.`;
    const st = ["has been placed", "is with the chef", "is being cooked", "is ready and on its way", "is served; your bill is ready", "is paid", "is complete"][Math.min(o.stage, 6)];
    return `Your order **${o.no}** ${st}.`;
  }
  function etaText(o) {
    if (o.stage <= 1) return "about 20 minutes";
    if (o.stage === 2) return "about 10 to 15 minutes";
    return "it's ready now";
  }
  function moveOrderBackToCart(S) {
    const o = S.order;
    o.items.forEach((x) => { const c = addToCart(S, x.id, x.qty); if (x.note) c.note = x.note; if (x.voice) c.voice = x.voice; });
    if (o.note) S.orderNote = o.note;
    o.cancelled = true; o.cancelledAt = Date.now();
  }
  function numberIn(t) {
    const m = t.match(/\b(\d{1,2})\b/); if (m) return +m[1];
    const w = t.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\b/); return w ? NUM[w[1]] : null;
  }
  function sendToKitchen(S, details, say) {
    try {
      const r = placeOrder(S, details);
      r.messages.forEach((m) => say(m.text, { items: m.items }));
      say(`Great! Your order has been sent to the kitchen. I'll keep you updated here. Thank you!`);
    } catch (e) { say("Your cart is empty, so there's nothing to send yet. Tell me a dish to add.", { chips: ["Direct me to menu"] }); }
  }
  function placeFlow(S, say) {
    if (!cartCount(S)) { say("Your cart is empty right now. Tell me what you'd like, and I'll add it.", { chips: ["Direct me to menu", "What is your bestseller?"] }); return; }
    if (S.table) { sendToKitchen(S, { mode: "dine", table: S.table }, say); return; }
    S.awaiting = "table";
    say("Which table are you at? Or say **takeaway**.", { chips: ["Takeaway"] });
  }

  /** Waiter-service intents. Returns true when the message was handled. */
  function serviceIntent(S, text, t, say, out) {
    const o = S.order && !S.order.cancelled ? S.order : null;
    const prio = /\b(urgent|urgently|emergency|asap|immediately|right now)\b/.test(t);
    const tm = t.match(/\btable (?:no\.? |num |number |#)?(\d{1,3})\b/); if (tm && S.awaiting !== "table") S.table = tm[1];
    // ── waiter to the table
    if (/\b(waiter|server|staff|someone|somebody|anyone|any one|a person|attendant|steward)\b.*\b(come|coming|send|visit|over here|here|to (my|our|the) table|attend)\b|\b(send|need|want|get|call)\b.*\b(waiter|server|attendant|steward|somebody|someone)\b.*\b(table|here|over)\b|\bcome to (my|our) table\b|^(hey |hello |excuse me )?(waiter|bhaiya|anna|server)( please| come| here)*$|^excuse me$|\b(waiter|server|bhaiya)\b,? (please|pls|plz)\b|\bwaiter (ko )?(bulao|bulaiye|bula do|bhejo|bhejiye)\b|\b(idhar|yahan|yaha) (aao|aaiye|aana|aaye)\b|\b(waiter|anna|thambi|sir)?\s?(inga|ingae|ingey) (vaanga|vanga|vango|vaa|va)\b|\bwaiter(a)? (kooptu|koopdunga|anuppunga|vara sollunga)\b|वेटर|बुलाओ|बुलाइए|यहाँ आइए|वेயிட்டர்|வெயிட்டர்|இங்கே வாங்க|இங்க வாங்க/.test(t + " " + text) && !/\b(speak|talk)\b/.test(t)) {
      staffRequest(S, "waiter", "Waiter requested at the table", "normal");
      say(`Sure! I've asked a waiter to come${where(S)}. They'll be with you in a minute.${askTableHint(S)}`, { staffAlert: true }); return true;
    }

    // ── E: urgent help, complaints, human hand-off (before anything that reads "cold", "slow"...)
    if (prio && /\b(help|assist|assistance|someone|staff|need)\b/.test(t)) {
      staffRequest(S, "urgent", "Customer needs assistance urgently", "urgent");
      say(`I've alerted a staff member right away. Someone is coming${where(S)} now.${askTableHint(S)}`, { staffAlert: true }); return true;
    }
    if (/\b(speak|talk|chat)\b.*\b(human|person|staff|manager|waiter|someone|owner)\b|\breal person\b|\bcall (a |the )?(waiter|staff|manager|someone|person)\b|\bhuman please\b|\bneed a (human|person|waiter)\b|^call staff$|^yes call staff$/.test(t)) {
      staffRequest(S, "human", "Customer would like to speak to a staff member", "high");
      say(`Of course. I've asked a team member to come over${where(S)}. They'll be with you shortly.${askTableHint(S)}`, { staffAlert: true }); return true;
    }
    const complaint =
      /\b(food|dish|it|curry|biryani|naan|order|meal|everything)\b.*\b(cold|not hot|stale|raw|undercooked|burnt|too salty|salty|bland|smells|spoiled|bad)\b/.test(t) ? ["Food quality: " + text, "high"] :
      /\b(order|dish|food|item|bill)\b.*\b(incorrect|wrong|missing|not right|mixed up)\b|\bwrong (order|dish|item|food)\b|\bnot what i ordered\b|\bi didnt order\b/.test(t) ? ["Order incorrect: " + text, "high"] :
      /\bservice\b.*\b(slow|bad|poor|late)\b|\b(slow|late) service\b|\btaking (too|so|very) long\b|\bwaiting (for )?(too|so|very) long\b|\bstill waiting\b/.test(t) ? ["Slow service: " + text, "normal"] :
      /\b(hair|insect|fly|bug|cockroach|stone|plastic)\b.*\b(in|on)\b/.test(t) ? ["Food safety: " + text, "urgent"] : null;
    if (complaint) {
      staffRequest(S, "complaint", complaint[0], complaint[1]);
      const kind = complaint[0].split(":")[0];
      const msg = kind === "Slow service" ? `I apologise for the delay${comma(S)}. I've checked with the kitchen and alerted the staff.${o ? " " + orderStatusText(o) + " Estimated time: " + etaText(o) + "." : ""}`
        : kind === "Order incorrect" ? "Sorry for the inconvenience. I've notified the restaurant staff, and someone will come to fix your order right away."
        : kind === "Food safety" ? "I'm very sorry. I've alerted the manager immediately; please don't eat it. Someone is coming to your table now."
        : "I'm sorry about that. I've informed our staff immediately, and they'll replace or reheat it for you.";
      say(msg + askTableHint(S), { staffAlert: true }); return true;
    }

    // ── A: general interaction
    if (/^how (are|r) (you|u)\b/.test(t)) { say(`I'm doing great, thanks for asking! How can I assist you today${comma(S)}?`, { chips: ["What can you do?", "What is today's special?", "Show me the menu"] }); return true; }
    if (/\bwhat (can|do) you do\b|\bhow (can|do) you help\b|\bwho are you\b|\bwhat are you\b/.test(t)) {
      say("I'm Masala Mitra, your AI waiter. I can:\n• show the menu and recommend dishes for your mood, diet, spice level and budget\n• answer questions about any dish (price, spice, veg or not)\n• take your order and send it to the kitchen, with notes for the chef\n• tell you where your order is and bring the bill\n• share restaurant information (timings, washroom, payment)\n• call a staff member whenever you need one", { chips: ["Show me the menu", "Recommend something", "Call staff"] }); return true;
    }
    if (/^(can|could|will) you (please )?help( me)?\b|^help( me)?( please)?$|^i need (some )?help$/.test(t)) { say("Of course! What do you need help with? I can suggest dishes, take your order, answer questions about the food, or call a staff member.", { chips: ["Suggest a dish", "Show me the menu", "Call staff"] }); return true; }
    if (/\bwhere (should|can|do|shall) (i|we) sit\b|\b(find|get|need|want|book|reserve)( me| us)? (a )?table\b|\btable for (\d+|two|three|four|five|six|eight)\b|\bany (free|empty|available) table\b/.test(t)) {
      const n = numberIn(t);
      staffRequest(S, "seating", `Seating needed${n ? " for " + n : ""}`, "normal");
      say(`I can help with that. I've asked our staff to find you an available table${n ? " for " + n : ""}; someone will guide you in a moment.`, { staffAlert: true }); return true;
    }

    // ── D: facilities (verified house info) and table requests
    const facility = /\b(washroom|restroom|toilet|bathroom|loo|lavatory)\b/.test(t) ? "washroom" : /\bwhere\b.*\b(drinking )?water\b|\bdrinking water\b/.test(t) ? "water" : /\b(reception|front desk|counter|billing counter|cashier)\b/.test(t) && /\bwhere\b/.test(t) ? "reception" : null;
    if (facility) { const d = INFO.find((x) => x.id === facility); say(d.text + " Need someone to show you? Just say \"call staff\".", { source: d.title }); return true; }
    if (/\b(can|could|may) (i|we) (get|have|please get)\b|\b(bring|need|want)( me| us)?\b|\b(extra|another|one more|more)\b/.test(t) && ITEM_REQ.test(t) && !/\b(juice|lassi|soda|chaas|biryani|naan|rice)\b/.test(t)) {
      const what = t.match(ITEM_REQ)[1]; const thing = (/\b(extra|another|one more|more)\b/.test(t) ? "extra " : "") + what;
      staffRequest(S, "table-request", `Please bring ${thing}`, "normal");
      say(`Certainly! I've sent your request for ${thing} to our service staff. It'll be with you shortly${where(S)}.${askTableHint(S)}`, { staffAlert: true }); return true;
    }

    // ── E: allergies and dietary limits
    if (/\ballerg(y|ic|ies)\b|\bintoleran(t|ce)\b|\bcant (have|eat) (peanut|nut|dairy|milk|gluten|wheat|egg)/.test(t)) {
      const key = /peanut/.test(t) ? "peanuts" : /\bnuts?\b|almond|cashew|pista|walnut/.test(t) ? "nuts" : /dairy|milk|lactose/.test(t) ? "dairy" : /gluten|wheat/.test(t) ? "gluten" : /\beggs?\b/.test(t) ? "egg" : null;
      if (!key) { staffRequest(S, "allergy", "Customer has an allergy: " + text, "high"); say("Thank you for telling me. Allergies are important, so I've asked a staff member to confirm with the chef which dishes are safe for you. Please tell me what you're allergic to, too.", { staffAlert: true }); return true; }
      const A = ALLERGEN[key];
      const listed = MENU.filter((i) => A.re.test(i.name + " " + i.desc) || (key === "egg" && i.egg));
      S.allergy = A.label;
      S.orderNote = (S.orderNote ? S.orderNote + "; " : "") + `ALLERGY: ${A.label}`;
      staffRequest(S, "allergy", `Allergy (${A.label}): please confirm safe dishes with the chef`, "high");
      say(`Thank you for telling me. These dishes list ${A.label} on our menu, so please avoid them:`, { items: listed.slice(0, 8).map((i) => itemRef(i)), source: "Menu descriptions" });
      say(`I've added "ALLERGY: ${A.label}" to your order for the chef and asked a staff member to confirm. Not every ingredient is listed on the menu and kitchens share equipment, so please wait for their confirmation before ordering.`, { staffAlert: true, chips: ["Call staff", "Show me the menu"] });
      return true;
    }
    if (/\bjain\b/.test(t) && !/\b(add|order)\b/.test(t)) {
      const d = INFO.find((x) => x.id === "jain");
      staffRequest(S, "dietary", "Jain preparation requested: please confirm suitable dishes", "normal");
      say(d.text + " I've also asked a staff member to confirm which dishes the chef can make Jain today.", { source: d.title, staffAlert: true, chips: ["Show veg dishes", "Add a chef note"] }); return true;
    }

    // ── B: today's special
    if (/\btoday'?s? special|todays special|special (for )?today|daily special|chef'?s special|special of the day|dish of the day|special today\b/.test(t)) {
      const d = new Date(), [nv, v] = SPECIALS[d.getDay()].map((id) => ITEM[id]);
      say(`Today's (${DAYS[d.getDay()]}) special is **${nv.name}** (${rs(nv.price)}). For vegetarians, it's **${v.name}** (${rs(v.price)}). Would you like to know more?`, { items: [itemRef(nv, { add: true }), itemRef(v, { add: true })], source: "Today's specials" });
      S.lastDish = nv.id; S.pending = { list: [nv.id, v.id], idx: 0 }; return true;
    }

    // ── C: orders: status, time, cancel, change, place from chat
    if (/\bwhere is my (order|food)\b|\border status\b|\bstatus of my order\b|\bis my (order|food) ready\b|\bhas my (order|food)\b/.test(t)) {
      if (!S.order) { say(cartCount(S) ? "You haven't placed an order yet; your dishes are still in the cart. Shall I send them to the kitchen?" : "You haven't placed an order yet. What would you like to eat?", { chips: cartCount(S) ? ["Send it to the kitchen"] : ["Show me the menu"] }); return true; }
      say(orderStatusText(S.order) + (S.order.cancelled || S.order.stage >= 3 ? "" : ` Estimated time: ${etaText(S.order)}.`)); return true;
    }
    if (o && /\bhow long\b|\bhow much (more )?time\b|\bwhen will (my |the )?(food|order)\b|\bwaiting time\b|\bhow many minutes\b/.test(t)) { say(`${orderStatusText(o)} Estimated waiting time: ${etaText(o)}.`); return true; }
    if (/\bcancel (my |the |this )?order\b/.test(t)) {
      if (!o) { say(cartCount(S) ? "You haven't placed an order yet. Do you want me to clear your cart instead?" : "There's no active order to cancel.", { chips: cartCount(S) ? ["Clear my cart", "Keep it"] : [] }); return true; }
      if (o.stage <= 1) { o.cancelled = true; o.cancelledAt = Date.now(); S.awaiting = null; staffRequest(S, "order", `Order ${o.no} cancelled by customer`, "normal"); say(`Done. Your order **${o.no}** hadn't started cooking yet, so I've cancelled it and told the kitchen. Nothing will be charged.`, { cartChanged: true, staffAlert: true }); return true; }
      staffRequest(S, "order", `Customer wants to cancel ${o.no}, but it is already ${STAGES[o.stage].toLowerCase()}`, "high");
      say(`Your order **${o.no}** is already ${o.stage === 2 ? "being cooked" : "ready"}, so I can't cancel it myself. I've asked a staff member to come and help you with it.`, { staffAlert: true }); return true;
    }
    if (/\b(change|modify|edit|update|alter) (my |the |this )?order\b/.test(t)) {
      if (!o) { say(cartCount(S) ? "Of course! Your order hasn't been sent yet, so just tell me what to change, for example \"remove the naan\" or \"make it 2\"." : "You don't have an order yet. Tell me what you'd like!", { chips: ["Show my cart"] }); return true; }
      if (o.stage <= 1) { moveOrderBackToCart(S); staffRequest(S, "order", `Order ${o.no} pulled back for changes`, "normal"); say(`Certainly! Your order **${o.no}** hadn't started cooking, so I've taken it back from the kitchen and put the dishes in your cart. Tell me what to change, then say "send it to the kitchen".`, { cartChanged: true, chips: ["Show my cart", "Send it to the kitchen"] }); return true; }
      staffRequest(S, "order", `Customer wants to change ${o.no}, already ${STAGES[o.stage].toLowerCase()}`, "high");
      say(`Your order is already being cooked, so I can't change it myself. I've asked a staff member to check with the kitchen for you.`, { staffAlert: true }); return true;
    }
    if (/^(i want to|i d like to|id like to|i would like to|can i|could i|let me) (order|place an order|eat)( some| the)?( food| something)?( please)?$|^(i am|im) hungry,? (what|can)/.test(t)) {
      say("Sure! What would you like? Tell me a dish, your mood or your budget, or pick from the menu. I'll add it and send it to the kitchen when you're ready.", { chips: ["Show me the menu", "What is today's special?", "Suggest a dish"] }); return true;
    }
    if (/\b(send|place|confirm)\b.*\b(order|it|kitchen)\b|\bsend it\b/.test(t) && !/\bcheckout\b/.test(t) && cartCount(S)) { placeFlow(S, say); return true; }
    if (S.lastDish && /\b(ill|i ll|i will|let me|i want to|id like to|i d like to)?\s*(order|take|have|get)\b.*\b(it|this|that|the same)\b|^(ok|okay|sure|yes)?,? ?(ill|i ll) (order|take|have) it\b/.test(t) && !strongDish(t)) {
      const i = ITEM[S.lastDish]; addToCart(S, i.id, 1); S.pending = null;
      S.awaiting = "confirmSend";
      say(`Great choice! I've added **${i.name}** (${rs(i.price)}) to your cart. Shall I send your order to the kitchen now, or would you like to add more?`, { cartChanged: true, chips: ["Send it to the kitchen", "Add more"] }); return true;
    }

    // ── F: payment questions, bill, split, feedback
    const method = t.match(/\b(upi|gpay|google pay|phonepe|paytm|card|credit card|debit card|cash|bhim)\b/);
    if (method && /\b(can i|can we|do you|is|accept|take|pay (by|with|using|via))\b/.test(t) && !(S.awaiting === "payment")) {
      say(`Yes! You can pay by ${method[1].toUpperCase() === "CASH" ? "cash" : method[1].length <= 4 ? method[1].toUpperCase() : method[1]}. We accept UPI, debit and credit cards, and cash. I'll bring the bill here once your food is ready.`, { source: "Payment" }); return true;
    }
    if (/\bsplit\b/.test(t)) {
      const total = o ? o.bill.total : cartCount(S) ? cartView(S).bill.total : 0;
      if (!total) { say("There's nothing to split yet. Once you order, I can split the bill equally."); return true; }
      const n = numberIn(t);
      if (!n || n < 2) { S.awaiting = "split"; say(`Sure! Your total is **${rs(total)}**. How many people should I split it between?`, { chips: ["2", "3", "4"] }); return true; }
      say(`Your total is **${rs(total)}**. Split ${n} ways, that's **${rs(Math.ceil(total / n))}** each (the last share adjusts by a rupee or two). Each person can pay by UPI, card or cash.`); return true;
    }
    if (/\b(get|need|want|bring|show|see|can i have|may i have)( me| us)? (the |my |our )?(bill|check|cheque)\b|^(the )?bill( please)?$|^check please$/.test(t)) {
      if (!o) { say(cartCount(S) ? "You haven't placed your order yet, so there's no bill. Shall I send your order to the kitchen?" : "There's nothing on your bill yet. What would you like to order?", { chips: cartCount(S) ? ["Send it to the kitchen"] : ["Show me the menu"] }); return true; }
      if (o.paid) { say(`Your bill for **${o.no}** (${rs(o.bill.total)}) is already paid. Thank you!`); return true; }
      if (o.stage < 4) { say(`Your order **${o.no}** is still being prepared, so the bill isn't ready yet. I'll bring it here as soon as your food is served.`); return true; }
      stageMessages(S, o, 4).forEach((m) => say(m.text, m)); return true;
    }
    if (/\b(how|where) (can|do|should) i (give|leave|share|send|write) (a |my |some )?(feedback|review|rating)\b|\bgive (you )?feedback\b|\bwant to (give|share) feedback\b/.test(t)) {
      S.awaiting = "feedback";
      say("You can share your feedback right here! Tap a rating, or type what you liked or what we can improve. The team reads every review.", { chips: ["★★★★★ Loved it", "★★★★ Good", "★★★ Okay", "★★ Not great", "★ Bad"] }); return true;
    }
    return false;
  }

  /** Replies to the follow-up questions the service flows ask. Returns true if handled. */
  function serviceAwaiting(S, text, t, say) {
    if (S.awaiting === "staffTable") {
      S.awaiting = null;
      const m = t.match(/^(?:(?:we are |were |i am |im )?(?:at |on )?table )?(?:no\.? |number |#)?(\d{1,3})$/) || t.match(/\btable (?:no\.? |number |#)?(\d{1,3})\b/);
      if (m) {
        S.table = m[1];
        (S.requests || []).forEach((r) => { if (!r.table && r.status === "open") { r.table = m[1]; r.saved = false; } });
        say(`Thank you! Table ${m[1]} noted. The staff member is on the way.`, { staffAlert: true }); return true;
      }
    }
    if (S.awaiting === "staffOffer") {
      S.awaiting = null;
      if (YES.test(t) || /\b(yes|call|please|ok)\b/.test(t)) { staffRequest(S, "question", "Customer question: " + (S.staffQ || text), "normal"); say(`Okay! I've asked a staff member to help with that. They'll come over shortly.${askTableHint(S)}`, { staffAlert: true }); return true; }
      if (NO.test(t)) { say("No problem. Is there anything else I can help you with?"); return true; }
    }
    if (S.awaiting === "confirmSend") {
      if (/\b(add more|more|not yet|wait)\b/.test(t)) { S.awaiting = null; say("Sure, take your time. Tell me what else you'd like.", { chips: ["Show me the menu"] }); return true; }
      if (YES.test(t) || /\bsend\b|\bplace\b|\bgo ahead\b/.test(t)) { S.awaiting = null; placeFlow(S, say); return true; }
      S.awaiting = null;
    }
    if (S.awaiting === "table") {
      if (/\b(takeaway|take away|parcel|to go|pack)\b/.test(t)) { S.awaiting = null; sendToKitchen(S, { mode: "take" }, say); return true; }
      const m = t.match(/\b(\d{1,3})\b/);
      if (m) { S.awaiting = null; S.table = m[1]; sendToKitchen(S, { mode: "dine", table: m[1] }, say); return true; }
      if (/\b(cancel|no|not now)\b/.test(t)) { S.awaiting = null; say("Okay, I won't send it yet. Your dishes are safe in the cart."); return true; }
      say("Sorry, which table number are you at? Or say takeaway."); return true;
    }
    if (S.awaiting === "split") {
      const n = numberIn(t); S.awaiting = null;
      if (n && n > 1) { const total = S.order && !S.order.cancelled ? S.order.bill.total : cartView(S).bill.total; say(`Split ${n} ways, that's **${rs(Math.ceil(total / n))}** each (total ${rs(total)}). Each person can pay by UPI, card or cash.`); return true; }
    }
    return false;
  }

  /* ---------- languages: Hindi and Tamil for common phrases ---------- */
  const NATIVE = [
    [/नमस्ते|नमस्कार/g, " namaste "], [/हाँ|हां|जी हाँ/g, " haan "], [/नहीं/g, " nahi "], [/धन्यवाद|शुक्रिया/g, " thanks "], [/मेनू/g, " menu "], [/बिल/g, " bill "], [/पानी/g, " water "],
    [/शाकाहारी/g, " veg "], [/मांसाहारी/g, " nonveg "], [/तीखा|मसालेदार/g, " spicy "], [/मीठा/g, " sweet "], [/खाना/g, " food "], [/पनीर/g, " paneer "], [/बिरयानी/g, " biryani "],
    [/चाय/g, " chai "], [/रोटी/g, " roti "], [/नान/g, " naan "], [/दाल/g, " dal "], [/चिकन/g, " chicken "], [/मटन/g, " mutton "], [/ऑर्डर/g, " order "], [/कीमत|दाम/g, " price "],
    [/मदद/g, " help "], [/शौचालय|वॉशरूम|बाथरूम/g, " washroom "], [/स्पेशल/g, " special "], [/आज/g, " today "],
    [/வணக்கம்/g, " vanakkam "], [/ஆமா|ஆம்|சரி/g, " yes "], [/இல்லை|வேண்டாம்/g, " no "], [/நன்றி/g, " thanks "], [/மெனு/g, " menu "], [/பில்/g, " bill "], [/தண்ணீர்/g, " water "],
    [/அசைவம்/g, " nonveg "], [/சைவம்/g, " veg "], [/காரம்/g, " spicy "], [/இனிப்பு/g, " sweet "], [/சாப்பாடு|உணவு/g, " food "], [/பனீர்/g, " paneer "], [/பிரியாணி/g, " biryani "],
    [/டீ/g, " chai "], [/சிக்கன்/g, " chicken "], [/மட்டன்/g, " mutton "], [/உதவி/g, " help "], [/கழிப்பறை/g, " washroom "], [/ஸ்பெஷல்/g, " special "], [/இன்று/g, " today "]
  ];
  function detectLanguageSwitch(S, text, t) {
    if (/\b(speak|talk|reply|answer|respond|chat)\b.*\b(english)\b|^english( please)?$|\bin english\b/.test(t)) return "en";
    if (/[ऀ-ॿ]/.test(text) || /\bhindi\b/.test(t) && /\b(mein|me|main|mai|baat|bolo|bol|speak|talk|reply|please|in)\b/.test(t)) return "hi";
    if (/[஀-௿]/.test(text) || /\btamil\b/.test(t) && /\b(la|le|il|pesu|pesunga|pesungal|speak|talk|reply|please|in)\b/.test(t)) return "ta";
    return null;
  }
  const L10N = {
    hi: [
      [/^Hi! (?:I'm doing great, thanks for asking\. )?Welcome to NASH Dhabha & Bakes\. May I know your name\?$/, "नमस्ते! NASH Dhabha & Bakes में आपका स्वागत है। क्या मैं आपका नाम जान सकता हूँ?"],
      [/^Nice to meet you, (.+?)! What is your mood today\?.*$/s, "आपसे मिलकर खुशी हुई, $1! आज आपका मूड कैसा है?"],
      [/^Hi (.+?), good to see you! What is your mood right now\?.*$/s, "नमस्ते $1, आपको देखकर खुशी हुई! अभी आपका मूड कैसा है?"],
      [/^Can I add (.+?) \((₹[\d,.]+)\) to your cart\?$/, "क्या मैं $1 ($2) आपकी कार्ट में जोड़ दूँ?"],
      [/^Done! (.+?) is in your cart\. Cart total: (.+?)\.[\s\S]*$/, "हो गया! $1 आपकी कार्ट में है। कुल: $2।"],
      [/^Added to your cart: ([\s\S]+?)\. Cart total: (.+?)\.[\s\S]*$/, "आपकी कार्ट में जोड़ा गया: $1। कुल: $2।"],
      [/^Yes, we do! Here (?:is|are) our (.+):$/, "हाँ, हमारे पास है! यहाँ हमारे $1 हैं:"],
      [/^Sure! For (.+), here's what I'd suggest:$/, "ज़रूर! आपके लिए मेरे सुझाव ($1):"],
      [/^Our house specials, the dishes guests order most:$/, "हमारी खास डिश, जो मेहमान सबसे ज़्यादा ऑर्डर करते हैं:"],
      [/^My pick: (.+?)\. [\s\S]*$/, "मेरी पसंद: $1।"],
      [/^Here is your bill:$/, "यह रहा आपका बिल:"],
      [/^How would you like to pay (.+?)\?$/, "आप $1 का भुगतान कैसे करना चाहेंगे? UPI, कार्ड या कैश?"],
      [/^Payment of (.+?) by (.+?) received\.[\s\S]*$/, "$2 से $1 का भुगतान मिल गया। धन्यवाद!"],
      [/^How was the food(?:, (.+?))?\?[\s\S]*$/, "खाना कैसा लगा? रेटिंग दें या अपने शब्दों में बताइए।"],
      [/^You're welcome[\s\S]*$/, "आपका स्वागत है! और कुछ चाहिए तो बताइए।"],
      [/^I'm doing great, thanks for asking![\s\S]*$/, "मैं बहुत अच्छा हूँ, पूछने के लिए धन्यवाद! मैं आपकी क्या मदद कर सकता हूँ?"],
      [/^Great! Your order has been sent to the kitchen\.[\s\S]*$/, "बढ़िया! आपका ऑर्डर किचन भेज दिया गया है। मैं आपको यहीं अपडेट दूँगा। धन्यवाद!"],
      [/^Your order (.+?) (?:has been sent to the chef|is with the chef)[\s\S]*$/, "आपका ऑर्डर शेफ़ को भेज दिया गया है।"],
      [/^I'm not sure about that[\s\S]*$/, "मुझे इसके बारे में पक्का पता नहीं है, और मैं अंदाज़ा नहीं लगाना चाहता। क्या मैं किसी स्टाफ़ सदस्य को बुला दूँ?"],
      [/^Okay! I've asked a staff member[\s\S]*$/, "ठीक है! मैंने स्टाफ़ को बुला दिया है, वे जल्द ही आएँगे।"],
      [/^Sure! I've asked a waiter to come(?: to table (\d+))?\. They'll be with you in a minute\.( Tell me your table number[\s\S]*)?$/, (m, n, ask) => "ज़रूर! मैंने वेटर को " + (n ? "टेबल " + n + " पर " : "") + "बुला दिया है, वे एक मिनट में आएँगे।" + (ask ? " कृपया अपना टेबल नंबर बताइए।" : "")],
      [/^Thank you! Table (\d+) noted\.[\s\S]*$/, "धन्यवाद! टेबल $1 नोट कर लिया। स्टाफ़ आ रहे हैं।"]
    ],
    ta: [
      [/^Hi! (?:I'm doing great, thanks for asking\. )?Welcome to NASH Dhabha & Bakes\. May I know your name\?$/, "வணக்கம்! NASH Dhabha & Bakes-க்கு உங்களை வரவேற்கிறோம். உங்கள் பெயர் என்ன?"],
      [/^Nice to meet you, (.+?)! What is your mood today\?.*$/s, "உங்களைச் சந்தித்ததில் மகிழ்ச்சி, $1! இன்று உங்கள் மனநிலை எப்படி இருக்கிறது?"],
      [/^Hi (.+?), good to see you! What is your mood right now\?.*$/s, "வணக்கம் $1, உங்களைப் பார்த்ததில் மகிழ்ச்சி! இப்போது உங்கள் மனநிலை எப்படி?"],
      [/^Can I add (.+?) \((₹[\d,.]+)\) to your cart\?$/, "$1 ($2) உங்கள் கார்ட்டில் சேர்க்கட்டுமா?"],
      [/^Done! (.+?) is in your cart\. Cart total: (.+?)\.[\s\S]*$/, "சேர்த்துவிட்டேன்! $1 உங்கள் கார்ட்டில் உள்ளது. மொத்தம்: $2."],
      [/^Added to your cart: ([\s\S]+?)\. Cart total: (.+?)\.[\s\S]*$/, "கார்ட்டில் சேர்க்கப்பட்டது: $1. மொத்தம்: $2."],
      [/^Yes, we do! Here (?:is|are) our (.+):$/, "ஆம், எங்களிடம் உள்ளது! இதோ எங்கள் $1:"],
      [/^Sure! For (.+), here's what I'd suggest:$/, "நிச்சயமாக! உங்களுக்கான பரிந்துரைகள் ($1):"],
      [/^Our house specials, the dishes guests order most:$/, "எங்கள் சிறப்பு உணவுகள், விருந்தினர்கள் அதிகம் ஆர்டர் செய்பவை:"],
      [/^My pick: (.+?)\. [\s\S]*$/, "என் பரிந்துரை: $1."],
      [/^Here is your bill:$/, "இதோ உங்கள் பில்:"],
      [/^How would you like to pay (.+?)\?$/, "$1 எப்படி செலுத்த விரும்புகிறீர்கள்? UPI, கார்டு அல்லது பணம்?"],
      [/^Payment of (.+?) by (.+?) received\.[\s\S]*$/, "$2 மூலம் $1 பெறப்பட்டது. நன்றி!"],
      [/^How was the food(?:, (.+?))?\?[\s\S]*$/, "உணவு எப்படி இருந்தது? மதிப்பீடு கொடுங்கள் அல்லது உங்கள் கருத்தை எழுதுங்கள்."],
      [/^You're welcome[\s\S]*$/, "பரவாயில்லை! வேறு ஏதாவது வேண்டுமா?"],
      [/^I'm doing great, thanks for asking![\s\S]*$/, "நான் நன்றாக இருக்கிறேன், கேட்டதற்கு நன்றி! உங்களுக்கு எப்படி உதவலாம்?"],
      [/^Great! Your order has been sent to the kitchen\.[\s\S]*$/, "அருமை! உங்கள் ஆர்டர் சமையலறைக்கு அனுப்பப்பட்டது. இங்கேயே தகவல் தருகிறேன். நன்றி!"],
      [/^Your order (.+?) (?:has been sent to the chef|is with the chef)[\s\S]*$/, "உங்கள் ஆர்டர் சமையல்காரரிடம் அனுப்பப்பட்டது."],
      [/^I'm not sure about that[\s\S]*$/, "இதைப் பற்றி எனக்கு உறுதியாகத் தெரியவில்லை; ஊகிக்க விரும்பவில்லை. ஒரு ஊழியரை அழைக்கட்டுமா?"],
      [/^Okay! I've asked a staff member[\s\S]*$/, "சரி! ஒரு ஊழியரை அழைத்துவிட்டேன்; அவர்கள் விரைவில் வருவார்கள்."],
      [/^Sure! I've asked a waiter to come(?: to table (\d+))?\. They'll be with you in a minute\.( Tell me your table number[\s\S]*)?$/, (m, n, ask) => "நிச்சயமாக! " + (n ? "டேபிள் " + n + "-க்கு " : "") + "வெயிட்டரை அழைத்துவிட்டேன், ஒரு நிமிடத்தில் வருவார்." + (ask ? " உங்கள் டேபிள் எண்ணைச் சொல்லுங்கள்." : "")],
      [/^Thank you! Table (\d+) noted\.[\s\S]*$/, "நன்றி! டேபிள் $1 குறித்துக்கொண்டேன். ஊழியர் வருகிறார்."]
    ]
  };
  const STAFF_ACK = { hi: "मैंने स्टाफ़ को बता दिया है, वे जल्द ही आपकी मदद के लिए आएँगे।", ta: "நான் ஊழியர்களிடம் தெரிவித்துவிட்டேன்; அவர்கள் விரைவில் உதவ வருவார்கள்." };
  const CHIP_L10N = { hi: { "Yes, add it": "Yes, add it · हाँ", "No, show another": "No, show another · नहीं", "Direct me to menu": "Direct me to menu · मेनू", "Call staff": "Call staff · स्टाफ़", "UPI": "UPI", "Send it to the kitchen": "Send it to the kitchen · किचन भेजें" },
                    ta: { "Yes, add it": "Yes, add it · ஆம்", "No, show another": "No, show another · வேண்டாம்", "Direct me to menu": "Direct me to menu · மெனு", "Call staff": "Call staff · ஊழியர்", "UPI": "UPI", "Send it to the kitchen": "Send it to the kitchen · அனுப்பு" } };
  function localize(S, msgs) {
    const lang = S.lang;
    if (!lang || lang === "en" || !L10N[lang]) return msgs;
    msgs.forEach((m) => {
      const plain = m.text.replace(/\*\*/g, "");
      const hit = L10N[lang].find(([re]) => re.test(plain));
      if (hit) m.text = plain.replace(hit[0], hit[1]);
      else if (m.staffAlert) m.text = STAFF_ACK[lang] + "\n" + m.text;
      if (m.chips) m.chips = m.chips.map((c) => (CHIP_L10N[lang][c] || c));
      m.lang = lang;
    });
    return msgs;
  }
