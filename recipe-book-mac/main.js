'use strict';
/* Recipe book for Mac: the window, the menu and the few things a web page can't do on its own
   (Notion requests without CORS, keeping the screen on, notifications, the Dock). */
const { app, BrowserWindow, Menu, ipcMain, net, shell, Notification, powerSaveBlocker, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const REPO = (require('./package.json').repository || '').replace(/^github:/, '');
const ALLOWED = [/^https:\/\/api\.notion\.com\/v1\//, new RegExp('^https://api\\.github\\.com/repos/' + REPO.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '/releases/')];

let win = null;
let quitting = false;
let awakeId = null;

if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

/* ---------- window size and position survive restarts ---------- */
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadBounds() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return null; } }
function saveBounds() { try { if (win && !win.isDestroyed() && !win.isFullScreen()) fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds())); } catch { } }

function createWindow() {
  const b = loadBounds() || {};
  win = new BrowserWindow({
    width: b.width || 1320, height: b.height || 860, x: b.x, y: b.y,
    minWidth: 860, minHeight: 600,
    title: 'Recipe book',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required'   // timer alarms must sound without a click
    }
  });
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('resize', saveBounds);
  win.on('move', saveBounds);
  // Closing the window hides it, so running cooking timers keep going. Quit with ⌘Q.
  win.on('close', e => { if (!quitting) { e.preventDefault(); if (win.isFullScreen()) { win.once('leave-full-screen', () => win.hide()); win.setFullScreen(false); } else win.hide(); } });
  win.on('enter-full-screen', () => send('fullscreen', true));
  win.on('leave-full-screen', () => send('fullscreen', false));

  // Links open in the browser; the app never navigates away from its own page.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https?:\/\//i.test(url)) shell.openExternal(url); } });
}

const send = (ch, ...args) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...args); };
const show = () => { if (win) { win.show(); win.focus(); } };

/* ---------- menu ---------- */
function buildMenu() {
  const item = (label, accelerator, ch, arg) => ({ label, accelerator, click: () => { show(); send('menu', ch, arg); } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu', submenu: [
      { role: 'about' }, { type: 'separator' },
      item('Settings…', 'Cmd+,', 'settings'), { type: 'separator' },
      { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }
    ] },
    { label: 'File', submenu: [
      item('Sync with Notion', 'Cmd+R', 'sync'),
      item('Open in Notion', 'Cmd+Shift+O', 'notion'),
      { type: 'separator' }, { role: 'close' }
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [
      item('Back to library', 'Cmd+[', 'back'),
      item('Find a recipe', 'Cmd+F', 'find'),
      item('Show or hide sidebar', 'Ctrl+Cmd+S', 'sidebar'),
      { type: 'separator' },
      { role: 'resetZoom', label: 'Actual text size' }, { role: 'zoomIn', label: 'Bigger text' }, { role: 'zoomOut', label: 'Smaller text' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' }])
    ] },
    { label: 'Cooking', submenu: [
      // Shown for reference only: the page handles the arrow keys, so they still work in text fields.
      { ...item('Next step', 'Right', 'next'), registerAccelerator: false },
      { ...item('Previous step', 'Left', 'prev'), registerAccelerator: false },
      item('Start or pause this step’s timer', 'Cmd+T', 'timer'),
      { type: 'separator' },
      item('Start over', 'Cmd+Shift+Backspace', 'reset')
    ] },
    { role: 'windowMenu' },
    { role: 'help', submenu: [{ label: 'Recipe book on GitHub', click: () => shell.openExternal('https://github.com/' + REPO + '#readme') }] }
  ]));
}

/* ---------- bridge ---------- */
ipcMain.handle('http', async (_e, req) => {
  const url = String(req && req.url || '');
  if (!ALLOWED.some(re => re.test(url))) return { error: 'blocked' };
  try {
    const res = await net.fetch(url, { method: req.method || 'GET', headers: req.headers || {}, body: req.body || undefined });
    return { status: res.status, retryAfter: res.headers.get('retry-after'), text: await res.text() };
  } catch (err) { return { error: String(err && err.message || err) }; }
});
ipcMain.on('keep-awake', (_e, on) => {
  if (on && awakeId === null) awakeId = powerSaveBlocker.start('prevent-display-sleep');
  else if (!on && awakeId !== null) { powerSaveBlocker.stop(awakeId); awakeId = null; }
});
ipcMain.on('badge', (_e, text) => { if (app.dock) app.dock.setBadge(text ? String(text) : ''); });
ipcMain.on('notify', (_e, { title, body, recipe }) => {
  if (app.dock) app.dock.bounce('critical');
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: String(title || ''), body: String(body || ''), silent: false });
  n.on('click', () => { show(); if (recipe) send('menu', 'open', recipe); });
  n.show();
});
ipcMain.on('open', (_e, url) => { if (/^https:\/\//i.test(String(url))) shell.openExternal(String(url)); });
ipcMain.handle('info', () => ({ version: app.getVersion(), repo: REPO, dark: nativeTheme.shouldUseDarkColors }));

/* ---------- lifecycle ---------- */
app.setAboutPanelOptions({ applicationName: 'Recipe book', copyright: 'Your recipes, from your own Notion.' });
app.whenReady().then(() => { buildMenu(); createWindow(); });
app.on('activate', () => { if (win) show(); else createWindow(); });
app.on('before-quit', () => { quitting = true; saveBounds(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
