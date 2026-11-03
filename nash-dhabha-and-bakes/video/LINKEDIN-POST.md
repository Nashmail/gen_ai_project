What if your dhaba had an AI waiter? 🍛🤖

For my Introduction to Generative AI course, I built Masala Mitra, an AI waiter for NASH Dhabha & Bakes. You can talk to it by voice or text, and it takes you from "hi" all the way to the bill.

🍽️ What it does
• Say hi and tell it your mood. It suggests dishes from the real menu (78 dishes, veg and non-veg) and asks before adding them to your cart.
• Ask it like you'd ask a waiter: "dry non veg", "biryani under 250", "is it very spicy?", even chat-speak like "do u hv parota".
• Leave a typed or voice note for the chef on any dish. It shows up on the kitchen screen.
• Live order tracking, a bill with GST, payment (UPI, card or cash) and feedback, all inside the chat.

🛎️ New: it works like a real waiter on the floor
• "I want the waiter to come to my table" sends a request to the staff with your table number. The same works for water, an extra chair or a spoon.
• Allergies and complaints ("my food is cold") go to the staff as high priority.
• A Staff desk shows every request, its priority and how happy customers are (average rating and reviews).
• It speaks English, Hindi and Tamil, by voice or text.

🧠 How it works (RAG)
Before answering, it retrieves the matching dishes and restaurant info, then answers only from that data. It never invents ingredients, allergens, prices or order status. If it doesn't know something, like "do you have parking?", it says so and calls a staff member instead of guessing. Google Gemini can optionally write the replies, and every answer is checked against the menu before it's shown.

🧪 How I tested it
• 347 automated checks, all passing
• Every question from the AI-waiter brief is a test. It went from 9 of 44 answered right to 47 of 47.
• New questions written after the changes: 15 of 17 right on the first try
• Real-browser tests with voice, XSS and prompt-injection attempts, a server crash mid-order and Hinglish input

🛠️ Built with: Node.js + Express, TF-IDF retrieval, Google Gemini (optional), Web Speech API for voice, Playwright for testing. The whole app also runs as a single HTML file in the browser.

Thank you, Prof. Rakesh Kumar, for the guidance.

Code: github.com/Nashmail/gen_ai_project

N Mailesh · CB.EN.U4ARE23025

#GenerativeAI #RAG #VoiceAI #Chatbot #AIWaiter #StudentProject
