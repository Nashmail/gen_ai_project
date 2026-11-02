"""Mixes voiceover + music with ducking. Music sits ~6 dB under the voice in pauses
and drops a further 12 dB while the narrator speaks (smooth attack/release).
Output: video/build/mix.wav"""
import wave, os, json
import numpy as np

B = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build")
def read(p):
    w = wave.open(p); sr = w.getframerate(); ch = w.getnchannels()
    a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a.reshape(-1, ch), sr
voice, sr = read(os.path.join(B, "voiceover.wav"))
music, sr2 = read(os.path.join(B, "music.wav"))
assert sr == sr2
n = max(len(voice), len(music))
voice = np.pad(voice, ((0, n - len(voice)), (0, 0))); music = np.pad(music, ((0, n - len(music)), (0, 0)))
rms = lambda a: np.sqrt(np.mean(a ** 2)) + 1e-9
db = lambda a: 20 * np.log10(rms(a))

# where is the narrator speaking? use the placed line times (exact) with padding
lines = json.load(open(os.path.join(B, "voiceover.json")))["lines"]
talk = np.zeros(n)
for l in lines:
    talk[int(max(0, l["start"] - 0.12) * sr): int((l["end"] + 0.15) * sr)] = 1.0
# smooth the gate: 120 ms attack, 450 ms release (one-pole, both directions handled by asymmetric smoothing)
g = np.empty(n); acc = 0.0
a_up, a_dn = 1 - np.exp(-1 / (0.12 * sr)), 1 - np.exp(-1 / (0.45 * sr))
for i in range(n):
    x = talk[i]; acc += (a_up if x > acc else a_dn) * (x - acc); g[i] = acc

speech = np.concatenate([voice[int(l["start"] * sr): int(l["end"] * sr)] for l in lines])
gaps = np.concatenate([music[int(a["end"] * sr): int(b["start"] * sr)] for a, b in zip(lines, lines[1:])] + [music[: int(lines[0]["start"] * sr)]])
music_gain = 10 ** ((db(speech) - 6 - db(gaps)) / 20)          # pauses: 6 dB under the voice
duck = 10 ** (-12 * g / 20)                                      # speaking: another 12 dB down
mix = voice + music * music_gain * duck[:, None]

# report
sp_mask = talk > 0.5
print(f"voice while speaking {db(voice[sp_mask]):.1f} dB | music under voice {db((music * music_gain * duck[:, None])[sp_mask]):.1f} dB | music in pauses {db((music * music_gain)[~sp_mask]):.1f} dB")
mix /= np.max(np.abs(mix)) / 0.89
with wave.open(os.path.join(B, "mix.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", os.path.join(B, "mix.wav"))
