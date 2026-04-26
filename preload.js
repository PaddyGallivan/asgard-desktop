const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asgardDesktop', {
  // App info
  getVersion:  () => ipcRenderer.invoke('get-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Native notifications (triggers OS-level notification, not in-app)
  notify: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),

  // Open URL in system browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Listen for deep links (asgard:// URLs)
  onDeepLink: (cb) => ipcRenderer.on('deep-link', (_, url) => cb(url)),
});