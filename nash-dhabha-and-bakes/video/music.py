"""Synthesizes an original upbeat lo-fi track for the video (no samples, no copyright).
Output: video/build/music.wav (44.1 kHz stereo)."""
import numpy as np, wave, sys, os

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 51.0
BPM = 100
beat = 60 / BPM
N = int(DUR * SR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def note(m):  # midi -> Hz
    return 440 * 2 ** ((m - 69) / 12)

def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    L[i:i + len(sig)] += sig * gain * (1 - pan) / 1.0
    R[i:i + len(sig)] += sig * gain * (1 + pan) / 1.0

def lowpass(x, a):
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc); y[i] = acc
    return y

def env(n, a=0.01, d=0.2, s=0.6, r=0.3, length=None):
    length = length or n / SR
    tt = np.arange(n) / SR
    e = np.where(tt < a, tt / a, np.where(tt < a + d, 1 - (1 - s) * (tt - a) / d, s))
    rel = np.clip((length - tt) / r, 0, 1)
    return e * rel

# A minor -> F -> C -> G  (vi-IV-I-V in C), one bar each
prog = [(57, [57, 60, 64]), (53, [53, 57, 60]), (48, [52, 55, 60]), (55, [55, 59, 62])]
bar = 4 * beat
intro = 2.8  # drums start after the hook

nbars = int(DUR / bar) + 1
for b in range(nbars):
    root, chord = prog[b % 4]
    st = b * bar
    n = int(bar * SR)
    tt = np.arange(n) / SR
    # warm pad: detuned saw-ish (few harmonics) per chord tone
    pad = np.zeros(n)
    for m in chord:
        for det in (-0.12, 0.12):
            f = note(m + 12) * (1 + det / 100)
            for h in range(1, 6):
                pad += np.sin(2 * np.pi * f * h * tt) / h * 0.06
    pad *= env(n, a=0.4, d=0.5, s=0.8, r=0.5)
    add(pad, st, 0.55, -0.15)
    add(pad, st + 0.01, 0.45, 0.15)
    # bass on beats 1 and 3
    for k in (0, 2, 2.5):
        if st + k * beat < intro: continue
        bn = int(beat * 0.9 * SR); bt = np.arange(bn) / SR
        bass = np.sin(2 * np.pi * note(root - 12) * bt) * env(bn, a=0.005, d=0.15, s=0.7, r=0.15) * 0.5
        add(bass, st + k * beat, 0.9)
    # pluck arpeggio in 8ths (from the demo onward)
    for k in range(8):
        tm = st + k * beat / 2
        if tm < 5.5 or tm > DUR - 2: continue
        m = chord[[0, 1, 2, 1, 0, 2, 1, 2][k]] + 24
        pn = int(0.35 * SR); pt = np.arange(pn) / SR
        tri = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * note(m) * pt))
        add(tri * np.exp(-pt * 9) * 0.16, tm, 1.0, 0.3 if k % 2 else -0.3)

# drums
nb = int(DUR / beat) + 1
for i in range(nb):
    tm = i * beat
    if tm < intro: continue
    if i % 2 == 0:  # kick
        kn = int(0.3 * SR); kt = np.arange(kn) / SR
        f = 55 + 90 * np.exp(-kt * 30)
        kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-kt * 9) * 0.9
        add(kick, tm, 1.0)
    else:  # soft clap
        cn = int(0.18 * SR); ct = np.arange(cn) / SR
        clap = rng.standard_normal(cn) * np.exp(-ct * 22) * 0.25
        add(np.convolve(clap, np.ones(6) / 6, "same"), tm, 1.0)
    for h in (0, 0.5):  # hats
        hn = int(0.05 * SR)
        hat = np.diff(rng.standard_normal(hn + 1)) * np.exp(-np.arange(hn) / SR * 70) * 0.07
        add(hat, tm + h * beat, 1.0, 0.4)

# whooshes at scene changes
WH = [float(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [2.8, 5.5, 31.5, 38.0, 44.5]
for s in WH:
    if s >= DUR: continue
    wn = int(0.6 * SR); wt = np.arange(wn) / SR
    w = rng.standard_normal(wn) * np.sin(np.pi * wt / 0.6) ** 2 * 0.18
    w = lowpass(w, 0.08)
    add(w, s - 0.45, 1.0)

mix = np.stack([L, R], 1)
fade = np.ones(N); fi = int(0.6 * SR); fo = int(2.0 * SR)
fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
mix *= fade[:, None]
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) / 0.8
os.makedirs(os.path.join(os.path.dirname(__file__), "build"), exist_ok=True)
out = os.path.join(os.path.dirname(__file__), "build", "music.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print(out, DUR, "s")
