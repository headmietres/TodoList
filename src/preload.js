const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('todoAPI', {
  // Tasks
  getTasks: () => ipcRenderer.invoke('storage:getTasks'),
  addTask: (data) => ipcRenderer.invoke('storage:addTask', data),
  updateTask: (id, updates) => ipcRenderer.invoke('storage:updateTask', id, updates),
  deleteTask: (id) => ipcRenderer.invoke('storage:deleteTask', id),
  archiveTask: (id) => ipcRenderer.invoke('storage:archiveTask', id),
  unarchiveTask: (id) => ipcRenderer.invoke('storage:unarchiveTask', id),

  // Tags
  getTags: () => ipcRenderer.invoke('storage:getTags'),
  addTag: (name, color) => ipcRenderer.invoke('storage:addTag', name, color),
  deleteTag: (id) => ipcRenderer.invoke('storage:deleteTag', id),

  // Stats
  getStats: () => ipcRenderer.invoke('storage:getStats'),
  addXp: (amount) => ipcRenderer.invoke('storage:addXp', amount),
  addPerfectDay: (dateStr) => ipcRenderer.invoke('storage:addPerfectDay', dateStr),
  isPerfectDay: (dateStr) => ipcRenderer.invoke('storage:isPerfectDay', dateStr),

  // Settings
  getSettings: () => ipcRenderer.invoke('storage:getSettings'),
  updateSettings: (updates) => ipcRenderer.invoke('storage:updateSettings', updates),

  // Undo/Redo
  undo: () => ipcRenderer.invoke('storage:undo'),
  redo: () => ipcRenderer.invoke('storage:redo'),

  // Window
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  setMiniMode: (flag) => ipcRenderer.invoke('window:setMiniMode', flag),

});
