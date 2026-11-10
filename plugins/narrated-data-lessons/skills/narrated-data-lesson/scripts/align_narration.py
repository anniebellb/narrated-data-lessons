"""Time every word of a narration recording (Whisper, locally) for the video storyboard.

    <venv-with-faster-whisper>/bin/python scripts/align_narration.py narration.mp3 --out narration.words.json [--prompt "script"]

Same output as Hardware Learning/how-things-work/scripts/align_narration.py
({"duration": s, "words": [{"w", "start", "end"}]}), with one change: it doesn't
carry context from one segment to the next. Expressive takes with long pauses
(ElevenLabs v4) made the long-form pass silently skip 20 seconds of speech;
condition_on_previous_text=False keeps every segment.
"""
import argparse
import json
import pathlib

from faster_whisper import WhisperModel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="base.en")
    ap.add_argument("--prompt")
    a = ap.parse_args()
    model = WhisperModel(a.model, device="cpu", compute_type="int8")
    segments, info = model.transcribe(a.audio, word_timestamps=True, beam_size=5, vad_filter=False,
                                      condition_on_previous_text=False, initial_prompt=a.prompt)
    words = [{"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
             for seg in segments for w in seg.words]
    pathlib.Path(a.out).write_text(json.dumps({"duration": round(info.duration, 3), "words": words}, indent=1))
    print(f"{len(words)} words, {info.duration:.1f} s -> {a.out}")


if __name__ == "__main__":
    main()
