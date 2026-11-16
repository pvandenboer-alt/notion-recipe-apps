'use strict';
/* The page's only way out: a small, fixed set of calls into main.js. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rb', {
  http: req => ipcRenderer.invoke('http', req),
  info: () => ipcRenderer.invoke('info'),
  keepAwake: on => ipcRenderer.send('keep-awake', !!on),
  badge: text => ipcRenderer.send('badge', text || ''),
  notify: (title, body, recipe) => ipcRenderer.send('notify', { title, body, recipe }),
  open: url => ipcRenderer.send('open', url),
  onMenu: fn => ipcRenderer.on('menu', (_e, ch, arg) => fn(ch, arg)),
  onFullscreen: fn => ipcRenderer.on('fullscreen', (_e, on) => fn(on))
});
