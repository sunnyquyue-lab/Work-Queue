const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('workqueue', {
  setMode: (m) => ipcRenderer.invoke('set-mode', m),
  getMode: () => ipcRenderer.invoke('get-mode'),
  setWidgetLayer: (layer) => ipcRenderer.invoke('set-widget-layer', layer),
  onModeState: (cb) => ipcRenderer.on('mode-state', (_e, s) => cb(s)),
  getStartup: () => ipcRenderer.invoke('get-startup'),
  setStartup: (enabled) => ipcRenderer.invoke('set-startup', enabled),
  openBackups: () => ipcRenderer.invoke('open-backups'),
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),
  // version + automatic updates
  appInfo: () => ipcRenderer.invoke('app-info'),
  getUpdateState: () => ipcRenderer.invoke('update-state'),
  checkForUpdates: () => ipcRenderer.invoke('update-check'),
  installUpdate: () => ipcRenderer.invoke('update-install'),
  onUpdateState: (cb) => ipcRenderer.on('update-state', (_e, s) => cb(s)),
  onFlushBeforeUpdate: (cb) => ipcRenderer.on('flush-before-update', () => cb()),
  // links and files on tasks
  openLink: (url) => ipcRenderer.invoke('open-link', url),
  openFile: (p) => ipcRenderer.invoke('open-file', p),
  pickFiles: () => ipcRenderer.invoke('pick-files')
});

// Turns a dropped file into its path on disk (for attaching files to tasks)
contextBridge.exposeInMainWorld('wqFiles', {
  pathFor: (file) => { try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; } }
});

// Durable storage bridge — the app uses this as its primary store in Electron
contextBridge.exposeInMainWorld('wqFile', {
  read: () => ipcRenderer.invoke('wq-read'),
  write: (data) => ipcRenderer.invoke('wq-write', data)
});
