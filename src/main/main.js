const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, screen } = require('electron');
const path = require('path');
const { Storage } = require('./storage.js');

// Keep references
let mainWindow = null;
let tray = null;
let storage = null;
let isQuitting = false;

function createWindow() {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 500,
    minHeight: 400,
    x: Math.round((screenWidth - 800) / 2),
    y: 40,
    frame: true,

    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false,
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('TodoList');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '\u663e\u793a', click: () => mainWindow && mainWindow.show() },
    { label: '\u9690\u85cf', click: () => mainWindow && mainWindow.hide() },
    { type: 'separator' },
    { label: '\u9000\u51fa', click: () => { isQuitting = true; app.quit(); } }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// ---- IPC Handlers ----

// Storage bridge
ipcMain.handle('storage:getTasks', () => storage.getTasks());
ipcMain.handle('storage:addTask', (e, data) => storage.addTask(data));
ipcMain.handle('storage:updateTask', (e, id, updates) => storage.updateTask(id, updates));
ipcMain.handle('storage:deleteTask', (e, id) => storage.deleteTask(id));
ipcMain.handle('storage:archiveTask', (e, id) => storage.archiveTask(id));
ipcMain.handle('storage:unarchiveTask', (e, id) => storage.unarchiveTask(id));

ipcMain.handle('storage:getTags', () => storage.getTags());
ipcMain.handle('storage:addTag', (e, name, color) => storage.addTag(name, color));
ipcMain.handle('storage:updateTag', (e, id, updates) => storage.updateTag(id, updates));
ipcMain.handle('storage:deleteTag', (e, id) => storage.deleteTag(id));

ipcMain.handle('storage:getStats', () => storage.getStats());
ipcMain.handle('storage:addXp', (e, amount) => storage.addXp(amount));
ipcMain.handle('storage:addPerfectDay', (e, dateStr) => storage.addPerfectDay(dateStr));
ipcMain.handle('storage:isPerfectDay', (e, dateStr) => storage.isPerfectDay(dateStr));

ipcMain.handle('storage:getSettings', () => storage.getSettings());
ipcMain.handle('storage:updateSettings', (e, updates) => storage.updateSettings(updates));

ipcMain.handle('storage:undo', () => storage.undo());
ipcMain.handle('storage:redo', () => storage.redo());

// Window controls
ipcMain.handle('window:setAlwaysOnTop', (e, flag) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(flag);
});
ipcMain.handle('window:setMiniMode', (e, flag) => {
  if (mainWindow) {
    if (flag) {
      mainWindow.setSize(320, 400);
      mainWindow.setResizable(false);
    } else {
      mainWindow.setSize(800, 600);
      mainWindow.setResizable(true);
    }
  }
});

// ---- App Lifecycle ----
app.whenReady().then(() => {
  storage = new Storage();
  createWindow();
  createTray();
  registerShortcuts();
  
  // Apply saved settings
  const settings = storage.getSettings();
  if (settings.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) mainWindow.show();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
