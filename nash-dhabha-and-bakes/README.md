<p align="center"><img src="frontend/assets/logo-1200.png" alt="NASH Dhabha & Bakes" width="420"></p>

# NASH Dhabha & Bakes: Masala Mitra

A restaurant ordering website with **Masala Mitra**, a voice-enabled, retrieval-augmented (RAG) chatbot that answers like a waiter.

**Student:** N Mailesh (CB.EN.U4ARE23025) · **Course:** Introduction to Gen AI · **Professor:** Rakesh Kumar Siddarantan

## What it does

- **Chat with Masala Mitra:** say hi, tell it your name and mood (typed or by voice), and it suggests dishes from the real menu and asks "Can I add it to your cart?"
- **Ask like you'd ask a waiter:** "dry non veg", "biryani under 250", "is butter chicken spicy?", "what goes with biryani?", "do u hv parota". It understands chat-speak, Hinglish and typos.
- **Menu:** 78 dishes across breads, rice, curries, biryani, starters, juices, chai, desserts, ice cream and bakes, all marked veg or non-veg.
- **Chef notes:** type, dictate or record a voice note for any dish or the whole order, from the menu or straight from the chat.
- **Order flow:** checkout (dine-in or takeaway), live order tracking, a bill with GST in the chat, UPI, card or cash (demo payment), and feedback.
- **Kitchen display:** every order with its notes and playable voice notes.

## How the RAG works

1. **Retrieve:** the customer's message is understood (veg or non-veg, dry or gravy, spice, price, course, temperature…) and matched against the menu knowledge base. Each dish has structured facts, and a TF-IDF search covers the menu and house info.
2. **Generate:** with a Google Gemini key, Gemini writes the reply using **only** the retrieved dishes. Without a key, a rule-based writer answers.
3. **Check:** Gemini's answer is rejected if it names a dish or price that isn't on the menu. Cart, orders and payment are never left to the model.

## Project layout

| Folder | What's inside |
|---|---|
| `frontend/` | The website (HTML, CSS, vanilla JS, no build step) |
| `backend/` | Node.js + Express API: sessions, chat, cart, chef notes, voice uploads, orders, kitchen |
| `shared/` | `engine.js` (retrieval, dialogue, orders) and `llm.js` (Gemini), shared by backend and browser |
| `scenarios/` | Test runners, all stored results and `REPORT.md` |
| `video/` | The LinkedIn video and how it was made |
| `standalone-app/` | The whole app as one HTML file: open it in Chrome, no server needed |
| `archive-v1-single-file/` | The first single-file version, kept for comparison |

## Run it locally

```bash
cd backend
```

```bash
npm install
```

```bash
npm start
```

Open http://localhost:4000. To turn on Gemini, copy `backend/.env.example` to `backend/.env` and add your free key from https://aistudio.google.com/apikey.

Voice input needs Chrome or Edge, and a microphone permission.

## Deploy

- **Backend and website together:** on [Render](https://render.com), choose New → Blueprint and pick this repo (it uses `render.yaml`). Add `GEMINI_API_KEY` in the service's Environment settings.
- **Website only (GitHub Pages):** Settings → Pages → Source: GitHub Actions. Without a backend, it runs the same engine in the browser. Set `frontend/js/config.js` to your backend URL to use it.

## Tests

```bash
cd backend && npm test
```

```bash
node scenarios/run-waiter-eval.js latest
```

The browser suites (`run-scenarios.js`, `run-tough.js`, `run-voice-tests.js`, `run-chefnote-chat-test.js`, `run-gemini-browser-test.js`) need Playwright and a running backend. See `scenarios/REPORT.md` for every result, what failed and what was fixed.
