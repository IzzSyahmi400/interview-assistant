require('dotenv').config();

const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const PYTHON_EXE = 'C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python314\\python.exe';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FALLBACK_SYSTEM_PROMPT = 'You are a real-time interview assistant. The user is in a job interview. Give a concise, confident, well-structured answer. Under 150 words. Use bullet points if listing multiple things.';

function buildSystemPrompt() {
  const contextPath = path.join(__dirname, 'context.txt');
  try {
    const context = fs.readFileSync(contextPath, 'utf8').trim();
    return `You are a real-time interview assistant. The user is in a job interview. Answer AS the candidate in first person, naturally and confidently.

Here is information about the candidate:
${context}

Rules:
- Answer in first person as if you are the candidate
- Keep answers under 150 words
- Use bullet points only when listing multiple items
- Sound human, not robotic
- If the question is technical, be specific and reference the candidate's actual skills and projects
- If asked to introduce yourself, give a natural 30-second elevator pitch based on the candidate's info`;
  } catch {
    console.warn('Warning: context.txt not found — using generic system prompt.');
    return FALLBACK_SYSTEM_PROMPT;
  }
}

const SYSTEM_PROMPT = buildSystemPrompt();

const ANSWER_DELAY_MS = 2000;
const ANSWER_VISIBLE_MS = 30000;

let overlayWindow = null;
let recordingProcess = null;
let isRecording = false;
let overlayHideTimer = null;

function createOverlay() {
  const { screen } = require('electron');
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 400,
    x: width - 440,
    y: height - 420,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile('overlay.html');
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
}

function startRecording() {
  const audioPath = path.join(__dirname, 'temp_audio.wav');
  recordingProcess = spawn(PYTHON_EXE, [
    path.join(__dirname, 'record_audio.py'),
    audioPath,
  ]);
  recordingProcess.stderr.on('data', (d) => console.log('Recorder:', d.toString().trim()));
  recordingProcess.on('error', (e) => console.error('Recorder spawn error:', e.message));
  console.log('Recording meeting audio...');
}

function stopRecording() {
  return new Promise((resolve) => {
    if (!recordingProcess) { resolve(); return; }
    recordingProcess.once('close', resolve);
    try {
      recordingProcess.stdin.write('\n');
      recordingProcess.stdin.end();
    } catch {
      recordingProcess.kill();
    }
    setTimeout(resolve, 5000);
  });
}

async function transcribe(audioPath) {
  return new Promise((resolve, reject) => {
    const py = spawn(PYTHON_EXE, [path.join(__dirname, 'transcribe.py'), audioPath]);
    let out = '';
    let err = '';
    py.stdout.on('data', (d) => { out += d.toString('utf8'); });
    py.stderr.on('data', (d) => { err += d.toString(); });
    py.on('close', (code) => {
      if (code !== 0) reject(new Error(`Transcription failed: ${err}`));
      else resolve(out.trim());
    });
  });
}

async function sendToClaude(question) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
  });
  return message.content[0].text;
}

app.whenReady().then(() => {
  createOverlay();

  const registered = globalShortcut.register('Ctrl+Shift+R', async () => {
    if (!isRecording) {
      isRecording = true;
      startRecording();
    } else {
      isRecording = false;
      console.log('Stopping recording...');
      await stopRecording();
      recordingProcess = null;

      try {
        const audioPath = path.join(__dirname, 'temp_audio.wav');
        const transcript = await transcribe(audioPath);
        console.log('Transcript:', transcript);

        if (!transcript) {
          console.log('No speech detected.');
          return;
        }

        const answer = await sendToClaude(transcript);
        console.log('Answer:', answer);

        setTimeout(() => {
          overlayWindow.webContents.send('show-answer', answer);
          overlayWindow.setIgnoreMouseEvents(false);

          if (overlayHideTimer) clearTimeout(overlayHideTimer);
          overlayHideTimer = setTimeout(() => {
            overlayWindow.setIgnoreMouseEvents(true, { forward: true });
            overlayHideTimer = null;
          }, ANSWER_VISIBLE_MS);
        }, ANSWER_DELAY_MS);
      } catch (err) {
        console.error('Pipeline error:', err.message);
      }
    }
  });

  console.log('Shortcut registered:', registered);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
