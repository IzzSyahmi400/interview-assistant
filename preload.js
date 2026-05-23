const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onAnswer:      (cb) => ipcRenderer.on('show-answer',     (_e, t) => cb(t)),
  onTranscript:  (cb) => ipcRenderer.on('show-transcript', (_e, t) => cb(t)),
  onStreamStart: (cb) => ipcRenderer.on('stream-start',    () => cb()),
  onStreamChunk: (cb) => ipcRenderer.on('stream-chunk',    (_e, t) => cb(t)),
  onStreamDone:  (cb) => ipcRenderer.on('stream-done',     () => cb()),
  onStreamHide:  (cb) => ipcRenderer.on('stream-hide',     () => cb()),
});
