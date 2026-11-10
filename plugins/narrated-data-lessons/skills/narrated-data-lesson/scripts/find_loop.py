"""Find where a music track can jump back to an earlier passage without anyone noticing.

    .venv/bin/python scripts/find_loop.py track.wav --cut 92 108 --back 8 70

For every candidate jump (from a time in --cut back to a time in --back) it compares
what the music sounds like around both points: the spectrum (harmony / timbre, 24
log bands) and the onset envelope (rhythm), over the 3 s before and 5 s after.
A splice where both match lands on the same beat and chord, so a short crossfade
is inaudible. Prints the best candidates.
"""
import argparse
import wave

import numpy as np

HOP = 1024


def features(x, sr):
    win = np.hanning(2048)
    n = (len(x) - 2048) // HOP
    frames = np.stack([x[i * HOP: i * HOP + 2048] * win for i in range(n)])
    mag = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(2048, 1 / sr)
    edges = np.geomspace(60, 8000, 25)
    bands = np.stack([mag[:, (freqs >= lo) & (freqs < hi)].mean(axis=1) for lo, hi in zip(edges[:-1], edges[1:])], axis=1)
    bands = np.log1p(bands)
    bands /= np.linalg.norm(bands, axis=1, keepdims=True) + 1e-9
    flux = np.maximum(0, np.diff(np.log1p(mag), axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    return bands, (flux - flux.mean()) / (flux.std() + 1e-9)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav")
    ap.add_argument("--cut", nargs=2, type=float, default=[92, 108])
    ap.add_argument("--back", nargs=2, type=float, default=[8, 70])
    ap.add_argument("--pre", type=float, default=3)
    ap.add_argument("--post", type=float, default=5)
    a = ap.parse_args()
    w = wave.open(a.wav)
    sr, ch = w.getframerate(), w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, ch).mean(axis=1) / 32768
    B, O = features(x, sr)
    fps = sr / HOP
    pre, post = int(a.pre * fps), int(a.post * fps)
    cuts = range(int(a.cut[0] * fps), int(a.cut[1] * fps))
    backs = range(int(a.back[0] * fps), int(a.back[1] * fps))
    res = []
    for c in cuts:
        bc, oc = B[c - pre: c + post], O[c - pre: c + post]
        for b in backs:
            bb, ob = B[b - pre: b + post], O[b - pre: b + post]
            spec = (bc * bb).sum(axis=1).mean()
            rhythm = np.corrcoef(oc, ob)[0, 1]
            res.append((0.6 * spec + 0.4 * rhythm, spec, rhythm, c / fps, b / fps))
    res.sort(reverse=True)
    for r in res[:8]:
        print(f"score {r[0]:.3f}  spectrum {r[1]:.3f}  rhythm {r[2]:.3f}   jump {r[3]:.2f}s -> {r[4]:.2f}s")


if __name__ == "__main__":
    main()
