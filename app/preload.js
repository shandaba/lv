const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('xlx', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  getKey: (name) => ipcRenderer.invoke('key:get', name),
  setKey: (name, value) => ipcRenderer.invoke('key:set', name, value),
  plan: (payload) => ipcRenderer.invoke('ai:plan', payload),
  monitor: (payload) => ipcRenderer.invoke('monitor:run', payload),
  openPath: (p) => ipcRenderer.invoke('path:open', p)
});
