const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inputAPI', {
  submit: (question) => ipcRenderer.send('submit-question', question),
  close: () => ipcRenderer.send('close-input'),
});
