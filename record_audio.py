import sys
import threading
import soundcard as sc
import soundfile as sf
import numpy as np

sys.stderr.reconfigure(encoding='utf-8')

if len(sys.argv) < 2:
    print("Usage: record_audio.py <output_path>", file=sys.stderr)
    sys.exit(1)

output_path = sys.argv[1]
SAMPLE_RATE = 16000
CHUNK = 4096

stop_event = threading.Event()
all_frames = []

def record_loopback():
    try:
        speaker = sc.default_speaker()
        print(f"Recording loopback from: {speaker.name}", file=sys.stderr)
        with sc.get_microphone(id=str(speaker.name), include_loopback=True).recorder(
            samplerate=SAMPLE_RATE, channels=1
        ) as recorder:
            while not stop_event.is_set():
                data = recorder.record(numframes=CHUNK)
                all_frames.append(data)
    except Exception as e:
        print(f"Loopback error: {e}", file=sys.stderr)
        stop_event.set()

def wait_for_stop():
    try:
        sys.stdin.readline()
    except Exception:
        pass
    stop_event.set()

t_stop = threading.Thread(target=wait_for_stop, daemon=True)
t_record = threading.Thread(target=record_loopback)

t_stop.start()
t_record.start()
t_record.join()

if all_frames:
    audio = np.concatenate(all_frames, axis=0)
    sf.write(output_path, audio, SAMPLE_RATE)
    duration = len(audio) / SAMPLE_RATE
    print(f"Saved {duration:.1f}s of audio to {output_path}", file=sys.stderr)
else:
    print("No audio captured.", file=sys.stderr)
    sys.exit(1)
