const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ziphayDesktop', {
  isDesktop: true,
  platform: process.platform,

  // Initial payload when launched via Explorer context menu or command line
  getInitialPayload: () => ipcRenderer.invoke('desktop:get-initial-payload'),

  // Listener for files dropped/sent while already running
  onFilesReceived: (callback) => {
    ipcRenderer.on('desktop:files-received', (_event, payload) => callback(payload));
  },

  // File system I/O
  readFile: (filePath) => ipcRenderer.invoke('desktop:read-file', filePath),
  saveProcessedFile: (params) => ipcRenderer.invoke('desktop:save-file', params),
  showInFolder: (filePath) => ipcRenderer.invoke('desktop:show-in-folder', filePath),

  // Context Menu Management
  registerContextMenu: () => ipcRenderer.invoke('desktop:register-context-menu'),
  unregisterContextMenu: () => ipcRenderer.invoke('desktop:unregister-context-menu'),
  isContextMenuRegistered: () => ipcRenderer.invoke('desktop:is-context-menu-registered'),

  // Desktop Settings
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('desktop:save-settings', settings),

  // Window Controls
  minimize: () => ipcRenderer.send('desktop:window-minimize'),
  maximize: () => ipcRenderer.send('desktop:window-maximize'),
  close: () => ipcRenderer.send('desktop:window-close')
});
