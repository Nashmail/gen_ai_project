"""Generates the male voiceover with Kokoro (open-source TTS, runs locally) and
places each line on the video timeline. Output: video/build/voiceover.wav + voiceover.json
Usage: python voiceover.py <kokoro_model_dir> [voice]"""
import sys, os, json, re
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

MODEL_DIR = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "hm_omega"   # Indian male voice
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
SR_OUT = 44100

# (stage time where the line belongs, text). Scenes are stretched to fit the voice.
LINES = [
    (0.25, "What if your dhaba had an A.I. waiter?"),
    (3.0, "Meet Masala Mitra, from Nash Dhaaba and Bakes."),
    (5.7, "Just say hi. It greets you, and asks your name."),
    (9.8, "Tell it your mood, by voice. It listens, and types it for you."),
    (13.3, "Then it picks dishes from the real menu."),
    (15.9, "Seventy-eight dishes. Veg, and non-veg."),
    (18.9, "Want it your way? Send the chef a voice note."),
    (22.5, "Check out in one tap,"),
    (24.3, "and track your order, live."),
    (27.3, "The bill arrives right in the chat."),
    (29.3, "Pay, and rate your food."),
    (31.6, "Need help? Ask it to call the waiter to your table."),
    (34.6, "Not sure about something? It never guesses. It asks the staff."),
    (37.4, "It speaks Hindi, and Tamil, too."),
    (40.8, "Every request lands on the staff desk, with customer ratings, live."),
    (44.4, "Under the hood, it's RAG. It searches the real menu first, so every answer uses real dishes, and real prices."),
    (50.8, "I tested it like a real product. Three hundred and forty-seven automated checks: security attacks, a server crash, Hindi, Tamil and Hinglish. All passing."),
    (57.4, "Built by N. Mailesh, for Introduction to Gen A.I., guided by Professor Rakesh Kumar."),
]
STAGE_END = 63.6
SPEED = 1.02
GAP = 0.35
k = Kokoro(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"), os.path.join(MODEL_DIR, "voices-v1.0.bin"))

# Pronunciation fixes, applied to the phonemes (British-style English suits an Indian accent best)
FIXES = [
    (r"ˈeɪ\.\s?ˈaɪ\.?", "ˌeɪˈaɪ"),   # "A.I." -> "A-I" (the dots made it sound like "eye")
    (r"nˈaʃ|nˈæʃ|nˈɑːʃ", "nˈæʃ"),     # "Nash" rhymes with "cash", not "nosh"
    (r"ɹˈeɪkəʃ", "ɹˈɑːkeɪʃ"),          # "Rakesh" as Raa-kesh
]
def phonemes(text):
    p = k.tokenizer.phonemize(text, "en-gb")
    for a, b in FIXES: p = re.sub(a, b, p)
    return p

def synth(text, speed):
    audio, sr = k.create(phonemes(text), voice=VOICE, speed=speed, is_phonemes=True)
    audio = np.asarray(audio, dtype=np.float32)
    # trim silence at both ends
    idx = np.where(np.abs(audio) > 0.01)[0]
    if len(idx): audio = audio[max(0, idx[0] - int(0.03 * sr)): idx[-1] + int(0.08 * sr)]
    # resample to 44.1 kHz (linear is fine for speech at this ratio)
    n = int(len(audio) * SR_OUT / sr)
    return np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio).astype(np.float32)

# warp: stage time -> video time. Each stretch between two line starts lasts
# at least as long as the original, and long enough for the line plus a gap.
clips = [synth(text, SPEED) for _, text in LINES]
durs = [len(c) / SR_OUT for c in clips]
warp = [(0.0, 0.0), (LINES[0][0], LINES[0][0])]
placed = []
for i, (s0, text) in enumerate(LINES):
    v0 = warp[-1][1]
    s1 = LINES[i + 1][0] if i + 1 < len(LINES) else STAGE_END
    need = max(s1 - s0, durs[i] + (GAP if i + 1 < len(LINES) else 1.4))
    warp.append((s1, round(v0 + need, 3)))
    placed.append({"text": text, "start": round(v0, 2), "end": round(v0 + durs[i], 2), "speed": SPEED})
    print(f"{v0:6.2f}-{v0+durs[i]:6.2f}  stage {s0:5.2f}->{s1:5.2f} stretched x{need/(s1-s0):.2f}  {text}")
total = warp[-1][1]
track = np.zeros(int(total * SR_OUT) + SR_OUT, dtype=np.float32)
for p, c in zip(placed, clips):
    i = int(p["start"] * SR_OUT); track[i:i + len(c)] += c
track /= max(1e-6, np.max(np.abs(track))) / 0.9
sf.write(os.path.join(OUT, "voiceover.wav"), np.stack([track, track], 1), SR_OUT, subtype="PCM_16")
json.dump({"phonemes": [phonemes(t) for _, t in LINES], "voice": VOICE, "speed": SPEED, "duration": total, "warp": warp, "lines": placed}, open(os.path.join(OUT, "voiceover.json"), "w"), indent=2)
print("total", round(total, 2), "s")
