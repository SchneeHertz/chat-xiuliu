const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ipcRenderer', {
  'send-message': (func)=>ipcRenderer.on('send-message', func),
  'send-status': (func)=>ipcRenderer.on('send-status', func),
  'send-prompt': (param)=>ipcRenderer.invoke('send-prompt', param),
  'switch-speech-talk': ()=>ipcRenderer.invoke('switch-speech-talk'),
  'get-admin-name': ()=>ipcRenderer.invoke('get-admin-name'),
  'open-config': ()=>ipcRenderer.invoke('open-config'),
})