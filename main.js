require('dotenv').config();

const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const PYTHON_EXE = 'C:\\Users\\user\\AppData\\Local\\Programs\\Python\\Python314\\python.exe';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ANSWER_VISIBLE_MS = 90000;

app.disableHardwareAcceleration();

function buildSystemPrompt() {
  const contextPath = path.join(__dirname, 'context.txt');
  try {
    const context = fs.readFileSync(contextPath, 'utf8').trim();
    return `You are a real-time interview assistant with vision. The user is in a job interview. Answer AS the candidate in first person, naturally and confidently.

Here is information about the candidate:
${context}

Rules:
- Answer in first person as if you are the candidate
- Keep answers under 150 words
- If a screen image is provided, analyse it first: read any code, problem statements, diagrams, or job description visible
- Combine what you see on screen with what was spoken to give the most accurate, specific answer
- Use bullet points only when listing multiple items
- Sound human, not robotic
- If the question is technical, be specific and reference the candidate's actual skills and projects
- If asked to introduce yourself, give a natural 30-second elevator pitch based on the candidate's info`;
  } catch {
    console.warn('context.txt not found — using generic prompt.');
    return "You are a real-time interview assistant with vision. You can see the user's screen. Analyse any code, problem statements, or text visible, then combine with what was said to give a concise, confident answer. Under 150 words.";
  }
}

const SYSTEM_PROMPT = buildSystemPrompt();

let overlayWindow = null;
let streamProcess = null;
let isRecording = false;
let useScreenCapture = false;
let overlayHideTimer = null;
let sessionId = 0;

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

async function captureScreen() {
  try {
    const { desktopCapturer } = require('electron');
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    if (!sources.length) return null;
    const png = sources[0].thumbnail.toPNG();
    console.log('Screen captured:', Math.round(png.length / 1024), 'KB');
    return png.toString('base64');
  } catch (err) {
    console.warn('Screen capture failed:', err.message);
    return null;
  }
}

async function streamToClaude(question, screenshotBase64) {
  overlayWindow.webContents.send('stream-start');
  overlayWindow.setIgnoreMouseEvents(false);

  if (overlayHideTimer) {
    clearTimeout(overlayHideTimer);
    overlayHideTimer = null;
  }

  try {
    const userContent = [];

    if (screenshotBase64) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshotBase64 },
      });
    }

    userContent.push({
      type: 'text',
      text: screenshotBase64 ? `[Screen captured above]\n\nQuestion heard: ${question}` : question,
    });

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    stream.on('text', (text) => {
      overlayWindow.webContents.send('stream-chunk', text);
    });

    await stream.finalMessage();
    overlayWindow.webContents.send('stream-done');

    overlayHideTimer = setTimeout(() => {
      overlayWindow.webContents.send('stream-hide');
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      overlayHideTimer = null;
    }, ANSWER_VISIBLE_MS);
  } catch (err) {
    console.error('Claude error:', err.message);
    overlayWindow.webContents.send('stream-hide');
  }
}

app.whenReady().then(() => {
  createOverlay();

  function startRecording(withScreen) {
    if (isRecording) return;
    isRecording = true;
    useScreenCapture = withScreen;
    const mySessionId = ++sessionId;

    console.log(`Recording started (${withScreen ? 'audio + screen' : 'audio only'})...`);
    overlayWindow.webContents.send('show-transcript', withScreen ? '🖥 Listening + screen...' : '🎧 Listening...');

    streamProcess = spawn(PYTHON_EXE, [path.join(__dirname, 'stream_transcribe.py')]);
    streamProcess.stderr.on('data', (d) => console.log('STT:', d.toString().trim()));
    streamProcess.on('error', (e) => console.error('Spawn error:', e.message));

    const rl = readline.createInterface({ input: streamProcess.stdout });

    rl.on('line', async (line) => {
      if (!line.trim() || mySessionId !== sessionId) return;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'partial') {
          overlayWindow.webContents.send('show-transcript', msg.text);
        } else if (msg.type === 'final') {
          if (msg.text) {
            console.log('Transcript:', msg.text);
            const screenshot = useScreenCapture ? await captureScreen() : null;
            await streamToClaude(msg.text, screenshot);
          }
        }
      } catch (e) {
        console.error('Parse error:', e.message, '— line:', line);
      }
    });
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    console.log('Stopping recording...');

    try {
      streamProcess.stdin.write('\n');
      streamProcess.stdin.end();
    } catch {
      if (streamProcess) streamProcess.kill();
    }
    streamProcess = null;
    overlayWindow.webContents.send('show-transcript', '');
  }

  // Ctrl+Shift+Space — audio only
  const reg1 = globalShortcut.register('Ctrl+Shift+Space', () => {
    isRecording ? stopRecording() : startRecording(false);
  });

  // Ctrl+Shift+S — audio + screen capture
  const reg2 = globalShortcut.register('Ctrl+Shift+S', () => {
    isRecording ? stopRecording() : startRecording(true);
  });

  console.log('Ctrl+Shift+Space (audio only):', reg1 ? '✓' : '✗ FAILED');
  console.log('Ctrl+Shift+S    (audio+screen):', reg2 ? '✓' : '✗ FAILED');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (streamProcess) streamProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
