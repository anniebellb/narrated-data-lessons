"""Make a music bed longer than its source by crossfading back to an earlier point.

    .venv/bin/python scripts/extend_music.py source.wav out.wav --cut 108 --back 20 --xfade 6

The source track's own ending (it fades to silence) would otherwise land under the
narration. This keeps source[0 : cut], then crossfades (equal power, `xfade` s) into the
matching earlier passage and continues from source[back : end], so the bed continues seamlessly and keeps its natural ending
far past where the video's own music fade-out happens.
"""
import argparse
import wave

import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--cut", type=float, default=108)
    ap.add_argument("--back", type=float, default=20)
    ap.add_argument("--xfade", type=float, default=6)
    a = ap.parse_args()

    w = wave.open(a.src)
    sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, ch).astype(np.float64)

    cut, back, xf = int(a.cut * sr), int(a.back * sr), int(a.xfade * sr)
    # Blend the SAME musical moment from both passes: x[cut-xf:cut] with x[back-xf:back]
    # (use scripts/find_loop.py to pick cut/back that land on the same beat and chord).
    head = x[: cut - xf]
    tail_a = x[cut - xf: cut]                      # first pass, fading out
    tail_b = x[back - xf: back]                    # matching earlier passage, fading in
    t = np.linspace(0, np.pi / 2, xf)[:, None]
    mix = tail_a * np.cos(t) + tail_b * np.sin(t)  # equal-power crossfade
    rest = x[back:]
    y = np.clip(np.concatenate([head, mix, rest]), -32768, 32767).astype("<i2")

    o = wave.open(a.out, "wb")
    o.setnchannels(ch); o.setsampwidth(sw); o.setframerate(sr)
    o.writeframes(y.tobytes()); o.close()
    print(f"{len(x) / sr:.1f}s -> {len(y) / sr:.1f}s (crossfade at {a.cut - a.xfade:.0f}-{a.cut:.0f}s back to {a.back:.0f}s) -> {a.out}")


if __name__ == "__main__":
    main()
