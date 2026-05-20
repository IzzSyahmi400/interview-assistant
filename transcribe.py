import sys
sys.stdout.reconfigure(encoding='utf-8')
from faster_whisper import WhisperModel

def transcribe(audio_path):
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path)
    return " ".join(segment.text.strip() for segment in segments)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    print(transcribe(sys.argv[1]))
