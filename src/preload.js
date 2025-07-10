const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startHeavyTask: () => ipcRenderer.invoke('start-heavy-task'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  forceQuit: () => ipcRenderer.invoke('force-quit')
}); 