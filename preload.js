const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onAnswer: (callback) => {
    ipcRenderer.on('show-answer', (_event, text) => callback(text));
  },
});
