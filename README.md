# Interview Assistant

A real-time AI interview assistant that runs as a transparent overlay on your Windows desktop. It captures your meeting audio, transcribes what the interviewer says, and displays a concise AI-generated answer — all without leaving your interview screen.

---

## How It Works

1. Press **Ctrl+Shift+R** to start capturing your meeting audio (system output / speaker loopback)
2. Let the interviewer finish their question
3. Press **Ctrl+Shift+R** again to stop
4. The app transcribes the audio using Whisper, sends it to Claude AI, and displays a confident answer in a transparent overlay in the bottom-right corner of your screen
5. The answer disappears automatically after 30 seconds

---

## Features

- Captures system audio output (no microphone needed — works with Zoom, Teams, Google Meet, etc.)
- Local speech-to-text using [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (runs on your machine)
- AI answers powered by Claude (Anthropic)
- Transparent, always-on-top overlay — invisible to screen share
- Personalised answers based on your own CV and background via `context.txt`
- Auto-clears after 90 seconds

---

## Requirements

- Windows 10 / 11
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.10+](https://www.python.org/)
- An [Anthropic API key](https://console.anthropic.com/)

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/IzzSyahmi400/interview-assistant.git
cd interview-assistant
```

### 2. Install Node dependencies

```bash
npm install
```

### 3. Install Python dependencies

```bash
pip install faster-whisper soundcard soundfile
```

### 4. Set up your API key

Copy `.env.example` to `.env` and add your Anthropic API key:

```bash
copy .env.example .env
```

Then open `.env` and replace the placeholder:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 5. Fill in your personal context

Create a `context.txt` file in the project root. This file is gitignored — it stays on your machine only. Fill it with your real information so the AI can answer as you:

```
Name: Your Full Name

Role: Your Job Title / Target Role

Experience: X years in [field], specializing in [specialization]

Current Company: Company Name

Skills:
skill1, skill2, skill3

Education:
Degree, Institution, Year

Strengths:
- Fast learner and highly adaptable
- Strong attention to detail
- ...

Weaknesses:
I tend to [honest weakness framed positively, e.g. "over-prepare, but I've learned to timeblock"]

Notable Projects:
- Project 1: one-line description
- Project 2: one-line description

Target Role:
What kind of job you are interviewing for

Salary Expectation:
Your expected range

Why This Role:
One or two sentences about your motivation
```

---

## Running the App

```bash
npm start
```

Or double-click the **Interview Assistant** shortcut on your desktop (if you created one).

---

## Usage

| Action | Hotkey |
|--------|--------|
| Start recording meeting audio | **Ctrl+Shift+R** |
| Stop recording and get answer | **Ctrl+Shift+R** |

- The overlay appears in the **bottom-right corner** of your screen
- It is **invisible to screen share** (transparent, frameless window)
- Scroll through long answers with your **mouse wheel**
- Answer auto-dismisses after **30 seconds**

---

## Project Structure

```
interview-assistant/
├── main.js              # Electron main process
├── overlay.html         # Transparent answer overlay UI
├── preload.js           # Overlay IPC bridge
├── input.html           # (Optional) manual text input UI
├── input-preload.js     # Input window IPC bridge
├── record_audio.py      # Loopback audio capture (soundcard)
├── transcribe.py        # Speech-to-text via faster-whisper
├── context.txt          # Your personal CV/background info
├── .env.example         # API key template (copy to .env)
└── package.json
```

---

## Security

- `.env` is listed in `.gitignore` and will **never be committed**
- `context.txt` is listed in `.gitignore` and will **never be committed** — your personal info stays on your machine only
- Your API key and personal details live only on your local machine

---

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop app shell
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — local Whisper transcription
- [soundcard](https://github.com/bastibe/SoundCard) — WASAPI loopback audio capture
- [Claude API](https://docs.anthropic.com/) — AI answer generation
- [dotenv](https://github.com/motdotla/dotenv) — environment variable management

---

## License

MIT
