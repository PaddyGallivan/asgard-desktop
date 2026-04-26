const {
  app, BrowserWindow, Tray, Menu, nativeImage,
  shell, ipcMain, Notification, globalShortcut, dialog
} = require('electron');
const { autoUpdater } = require('electron-updater');
const Store  = require('electron-store');
const path   = require('path');

const ASGARD_URL = 'https://asgard.pgallivan.workers.dev';
const APP_NAME   = 'Asgard';
const store      = new Store();

let mainWindow = null;
let tray        = null;
let isQuitting  = false;

function setupAutoUpdater() {
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('update-available', (info) => {
    showNativeNotification('Asgard update available', 'v' + info.version + ' is downloading…');
  });
  autoUpdater.on('update-downloaded', (info) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'info', buttons: ['Restart now', 'Later'],
      title: 'Update ready', message: 'Asgard v' + info.version + ' is ready.',
      detail: 'Restart to apply the update.',
    });
    if (choice === 0) { isQuitting = true; autoUpdater.quitAndInstall(); }
  });
  autoUpdater.on('error', (err) => { console.warn('[updater]', err.message); });
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}

function createWindow() {
  const savedBounds = store.get('windowBounds', { width: 1280, height: 860 });
  mainWindow = new BrowserWindow({
    ...savedBounds,
    minWidth: 900, minHeight: 600,
    title: APP_NAME,
    icon: path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: true,
    },
    show: false,
    backgroundColor: '#0a0a1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
  });
  mainWindow.loadURL(ASGARD_URL).catch(() => loadOffline());
  mainWindow.webContents.on('did-fail-load', () => loadOffline());
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV === 'development') mainWindow.webContents.openDevTools();
  });
  const saveBounds = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen())
      store.set('windowBounds', mainWindow.getBounds());
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', (e) => {
    if (!isQuitting) { e.preventDefault(); mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide(); }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(ASGARD_URL)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('before-input-event', (_, input) => {
    const cmd = process.platform === 'darwin' ? input.meta : input.control;
    if (cmd && input.key === 'r' && input.type === 'keyDown') mainWindow.webContents.reload();
  });
}

function loadOffline() { mainWindow?.loadFile(path.join(__dirname, 'offline.html')); }

function createTray() {
  const iconFile = process.platform === 'darwin' ? 'icon-tray.png' :
                   process.platform === 'win32'   ? 'icon.ico' : 'icon.png';
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', iconFile));
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip(APP_NAME);
  const menu = Menu.buildFromTemplate([
    { label: 'Open Asgard',      click: showWindow },
    { label: 'Reload',           click: () => mainWindow?.webContents.reload() },
    { type: 'separator' },
    { label: 'Open in Browser',  click: () => shell.openExternal(ASGARD_URL) },
    { label: 'Check for Update', click: () => autoUpdater.checkForUpdatesAndNotify() },
    { type: 'separator' },
    { label: 'v' + app.getVersion(), enabled: false },
    { type: 'separator' },
    { label: 'Quit Asgard', click: quitApp },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      { label: 'Check for Updates…', click: () => autoUpdater.checkForUpdatesAndNotify() },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' },
    ]}] : []),
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { label: 'Reload',      accelerator: 'CmdOrCtrl+R',       click: () => mainWindow?.webContents.reload() },
      { label: 'Hard Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.toggleDevTools() },
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' },
      ...(isMac ? [{ role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
    ]},
    { label: 'Help', submenu: [
      { label: 'Open Asgard in Browser', click: () => shell.openExternal(ASGARD_URL) },
      { label: 'Asgard Status',          click: () => shell.openExternal(ASGARD_URL + '/api/health') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showNativeNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body, icon: path.join(__dirname, 'assets', 'icon.png') }).show();
}

function handleDeepLink(url) {
  showWindow();
  if (mainWindow) mainWindow.webContents.send('deep-link', url);
}

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
  if (process.platform === 'darwin') app.dock.show();
}

function quitApp() { isQuitting = true; app.quit(); }

ipcMain.handle('get-version',       () => app.getVersion());
ipcMain.handle('get-platform',      () => process.platform);
ipcMain.handle('show-notification', (_, { title, body }) => showNativeNotification(title, body));
ipcMain.handle('open-external',     (_, url) => shell.openExternal(url));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_, argv) => {
    const url = argv.find(a => a.startsWith('asgard://'));
    if (url) handleDeepLink(url);
    showWindow();
  });
}

app.setAsDefaultProtocolClient('asgard');

app.whenReady().then(() => {
  buildAppMenu(); createWindow(); createTray();
  setTimeout(setupAutoUpdater, 5000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
  app.on('open-url', (_, url) => handleDeepLink(url));
});

app.on('before-quit',        () => { isQuitting = true; });
app.on('window-all-closed',  () => { /* stay in tray */ });