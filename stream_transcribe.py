import sys
import json
import threading
import queue
import numpy as np
import soundcard as sc
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

SAMPLE_RATE = 16000
CHUNK_SECONDS = 3
CHUNK_FRAMES = SAMPLE_RATE * CHUNK_SECONDS
MIN_CHUNK_FRAMES = SAMPLE_RATE  # skip chunks shorter than 1s

stop_event = threading.Event()
audio_queue = queue.Queue()
transcript_parts = []
lock = threading.Lock()

model = None
model_ready = threading.Event()


def load_model():
    global model
    model = WhisperModel("base", device="cpu", compute_type="int8")
    model_ready.set()
    print("Model ready", file=sys.stderr)


def record_loop():
    try:
        speaker = sc.default_speaker()
        print(f"Recording loopback from: {speaker.name}", file=sys.stderr)
        with sc.get_microphone(id=str(speaker.name), include_loopback=True).recorder(
            samplerate=SAMPLE_RATE, channels=1
        ) as recorder:
            buffer = []
            frame_count = 0
            while not stop_event.is_set():
                data = recorder.record(numframes=1024)
                buffer.append(data)
                frame_count += len(data)
                if frame_count >= CHUNK_FRAMES:
                    chunk = np.concatenate(buffer).flatten().astype(np.float32)
                    audio_queue.put(chunk)
                    buffer = []
                    frame_count = 0
            if buffer:
                chunk = np.concatenate(buffer).flatten().astype(np.float32)
                if len(chunk) >= MIN_CHUNK_FRAMES:
                    audio_queue.put(chunk)
    except Exception as e:
        print(f"Record error: {e}", file=sys.stderr)
    audio_queue.put(None)


def transcribe_loop():
    model_ready.wait()
    while True:
        audio = audio_queue.get()
        if audio is None:
            break
        segments, _ = model.transcribe(audio, language="en")
        text = " ".join(seg.text.strip() for seg in segments).strip()
        if text:
            with lock:
                transcript_parts.append(text)
                current = " ".join(transcript_parts)
            print(json.dumps({"type": "partial", "text": current}), flush=True)


def wait_for_stop():
    try:
        sys.stdin.readline()
    except Exception:
        pass
    stop_event.set()


t_model = threading.Thread(target=load_model, daemon=True)
t_stop = threading.Thread(target=wait_for_stop, daemon=True)
t_record = threading.Thread(target=record_loop)
t_transcribe = threading.Thread(target=transcribe_loop)

t_model.start()
t_stop.start()
t_record.start()
t_transcribe.start()

t_record.join()
t_transcribe.join()

with lock:
    final = " ".join(transcript_parts)

print(json.dumps({"type": "final", "text": final}), flush=True)
