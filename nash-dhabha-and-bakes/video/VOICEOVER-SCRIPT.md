# Voiceover script

Voice: Kokoro TTS (open source, runs locally), Indian male voice `hm_omega`, speed 1.02. British-style English phonemes with pronunciation fixes: "A-I" (not "eye"), "Nash" (rhymes with cash), "Raa-kesh". Music is ducked under the voice (video/mix.py).

| Time | Line |
|---|---|
| 0.3–2.7 s | What if your dhaba had an A.I. waiter? |
| 3.1–6.2 s | Meet Masala Mitra, from Nash Dhaaba and Bakes. |
| 6.6–9.5 s | Just say hi. It greets you, and asks your name. |
| 10.7–14.1 s | Tell it your mood, by voice. It listens, and types it for you. |
| 14.5–16.9 s | Then it picks dishes from the real menu. |
| 17.3–20.1 s | Seventy-eight dishes. Veg, and non-veg. |
| 20.5–23.1 s | Want it your way? Send the chef a voice note. |
| 24.1–25.7 s | Check out in one tap, |
| 26.1–27.9 s | and track your order, live. |
| 29.1–31.2 s | The bill arrives right in the chat. |
| 31.6–33.2 s | Pay, and rate your food. |
| 34.1–41.6 s | Under the hood, it's RAG. It searches the real menu first, so every answer uses real dishes, and real prices. |
| 41.9–51.0 s | I tested it like a real product. Eighty-four test steps: security attacks, a server crash, even Hinglish. Nineteen failures, all fixed. |
| 51.4–58.5 s | Built by N. Mailesh, for Introduction to Gen A.I., guided by Professor Rakesh Kumar. |

## Rebuild

```bash
pip install kokoro-onnx soundfile
```

Download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx GitHub release `model-files-v1.0` into a folder, then:

```bash
python video/voiceover.py <model-folder> hm_omega
```

```bash
python video/mix.py
```

```bash
node video/render.js 30
```
