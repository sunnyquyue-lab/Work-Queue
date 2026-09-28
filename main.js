const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog, shell, screen, globalShortcut, Notification } = require('electron');
// Automatic updates (installed app only). Loaded defensively so a development
// copy without the dependency still runs.
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { autoUpdater = null; }
const path = require('path');
const fs = require('fs');

// Pin ONE stable data folder so `npm start` (dev) and a built/installed app
// always read and write the exact same place. Without this, Electron derives
// the folder from the app name, which differs between dev and packaged builds —
// a classic cause of "my tasks changed depending on how I launched it".
try { app.setPath('userData', path.join(app.getPath('appData'), 'WorkQueue')); } catch (e) {}

// Durable data file in the OS user-data folder — survives everything the
// browser can't guarantee. Written atomically (temp file + rename).
function dataFile() { return path.join(app.getPath('userData'), 'work-queue-data.json'); }

// ---- Automatic daily backups ----
// The first time the data is touched each day (at launch, or the first save
// after midnight while the app sits in the tray), the current data file is
// copied to backups/work-queue-data-YYYY-MM-DD.json. The newest 14 are kept.
const KEEP_DAILY = 14;
const KEEP_PRE_RESTORE = 5;
// ---- Remembered window state (mode, widget layer, size and position) ----
function stateFile() { return path.join(app.getPath('userData'), 'window-state.json'); }
function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (['normal', 'float', 'desktop', 'widget'].includes(s.mode)) mode = s.mode;
    if (s.widgetLayer === 'front' || s.widgetLayer === 'back') widgetLayer = s.widgetLayer;
    if (s.bounds && boundsOnScreen(s.bounds)) savedBounds = s.bounds;
  } catch (e) {}
}
// Only reuse a saved position if it's still on a connected screen
function boundsOnScreen(b) {
  try {
    return screen.getAllDisplays().some(d => {
      const a = d.workArea;
      const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
      const h = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
      return w >= 120 && h >= 80;
    });
  } catch (e) { return false; }
}
let stateTimer = null;
function saveWindowState() {
  if (stateTimer) clearTimeout(stateTimer);
  stateTimer = setTimeout(() => {
    try {
      const bounds = (win && !win.isMinimized() && !win.isMaximized()) ? win.getBounds() : savedBounds;
      if (bounds) savedBounds = bounds;
      fs.writeFileSync(stateFile(), JSON.stringify({ mode, widgetLayer, bounds: savedBounds }));
    } catch (e) {}
  }, 400);
}

function backupsDir() { return path.join(app.getPath('userData'), 'backups'); }
function localDate(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function pruneBackups() {
  try {
    const files = fs.readdirSync(backupsDir());
    const trim = (re, keep) => files.filter(f => re.test(f)).sort().reverse().slice(keep)
      .forEach(f => { try { fs.unlinkSync(path.join(backupsDir(), f)); } catch (e) {} });
    trim(/^work-queue-data-\d{4}-\d{2}-\d{2}\.json$/, KEEP_DAILY);
    trim(/^pre-restore-.+\.json$/, KEEP_PRE_RESTORE);
  } catch (e) {}
}
let lastBackupDay = null;
function ensureDailyBackup() {
  const today = localDate();
  if (lastBackupDay === today) return; // already handled today, skip the disk check
  try {
    if (!fs.existsSync(dataFile())) return; // nothing to back up yet
    fs.mkdirSync(backupsDir(), { recursive: true });
    const dest = path.join(backupsDir(), 'work-queue-data-' + today + '.json');
    if (!fs.existsSync(dest)) fs.copyFileSync(dataFile(), dest);
    lastBackupDay = today;
    pruneBackups();
  } catch (e) {}
}
// ---- Automatic updates ----
// The installer built by the GitHub workflow knows where its releases live.
// On launch and every 4 hours it checks, downloads new versions in the
// background, and offers "Restart now" (or installs on the next quit).
let updateState = { status: 'idle' };
function sendUpdate(s) {
  updateState = Object.assign({}, s);
  if (win && !win.isDestroyed()) win.webContents.send('update-state', updateState);
  buildTrayMenu();
}
function setupAutoUpdates() {
  if (!app.isPackaged) { updateState = { status: 'dev' }; return; }
  if (!autoUpdater) { updateState = { status: 'unavailable' }; return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate({ status: 'checking' }));
  autoUpdater.on('update-available', i => sendUpdate({ status: 'downloading', version: i && i.version, percent: 0 }));
  autoUpdater.on('update-not-available', () => sendUpdate({ status: 'current', checkedAt: Date.now() }));
  autoUpdater.on('download-progress', p => sendUpdate({ status: 'downloading', version: updateState.version, percent: Math.round((p && p.percent) || 0) }));
  autoUpdater.on('update-downloaded', i => {
    sendUpdate({ status: 'ready', version: i && i.version });
    try {
      const n = new Notification({ title: 'Work Queue ' + (i && i.version) + ' is ready', body: 'Restart Work Queue to finish updating. It will also install the next time you quit.' });
      n.on('click', () => { if (win) { win.show(); win.focus(); } });
      n.show();
    } catch (e) {}
  });
  autoUpdater.on('error', e => {
    const msg = String((e && e.message) || e || '');
    // a copy built without release info (e.g. npm run dist) can't auto-update
    sendUpdate(/app-update\.yml|ENOENT/i.test(msg) ? { status: 'unavailable' } : { status: 'error', message: msg.slice(0, 200) });
  });
  setTimeout(checkForUpdatesNow, 8000);
  setInterval(checkForUpdatesNow, 4 * 60 * 60 * 1000);
}
function checkForUpdatesNow() {
  if (!autoUpdater || !app.isPackaged) return;
  if (updateState.status === 'downloading' || updateState.status === 'ready') return;
  try { autoUpdater.checkForUpdates().catch(() => {}); } catch (e) {}
}
function installUpdateNow() {
  if (!autoUpdater || updateState.status !== 'ready') return;
  quitting = true;
  try { globalShortcut.unregisterAll(); } catch (e) {}
  autoUpdater.quitAndInstall(false, true); // install, then reopen Work Queue
}

function openBackupsFolder() {
  try { fs.mkdirSync(backupsDir(), { recursive: true }); } catch (e) {}
  return shell.openPath(backupsDir());
}
function looksLikeAppData(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).some(k => k.startsWith('wq:') || k.startsWith('work-queue'));
}
async function restoreFromBackup() {
  const parent = (win && win.isVisible() && mode !== 'desktop') ? win : null;
  const ask = (opts) => parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts);
  try { fs.mkdirSync(backupsDir(), { recursive: true }); } catch (e) {}
  const pickOpts = {
    title: 'Restore Work Queue from a daily backup',
    defaultPath: backupsDir(),
    filters: [{ name: 'Work Queue backup', extensions: ['json'] }],
    properties: ['openFile']
  };
  const picked = parent ? await dialog.showOpenDialog(parent, pickOpts) : await dialog.showOpenDialog(pickOpts);
  if (picked.canceled || !picked.filePaths.length) return { ok: false, canceled: true };
  const file = picked.filePaths[0];

  let text, obj;
  try { text = fs.readFileSync(file, 'utf8'); obj = JSON.parse(text); } catch (e) { obj = null; }
  if (!looksLikeAppData(obj)) {
    const isExport = obj && obj.app === 'work-queue';
    await ask({ type: 'warning', buttons: ['OK'], title: 'Not a daily backup',
      message: isExport ? 'That file is an exported backup.' : 'That file isn\'t a Work Queue backup.',
      detail: isExport ? 'Use "Import backup" at the bottom of the app to load exported files.'
                       : 'Pick a file from the backups folder named work-queue-data-YYYY-MM-DD.json.' });
    return { ok: false };
  }

  const confirm = await ask({ type: 'question', buttons: ['Restore', 'Cancel'], defaultId: 0, cancelId: 1,
    title: 'Restore backup?',
    message: 'Replace all current profiles and tasks with ' + path.basename(file) + '?',
    detail: 'Your current data is saved first as a pre-restore backup, so this can be reversed.' });
  if (confirm.response !== 0) return { ok: false, canceled: true };

  try {
    if (fs.existsSync(dataFile())) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(dataFile(), path.join(backupsDir(), 'pre-restore-' + stamp + '.json'));
    }
    const tmp = dataFile() + '.tmp';
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, dataFile());
    pruneBackups();
  } catch (e) {
    await ask({ type: 'error', buttons: ['OK'], title: 'Restore failed', message: 'Could not restore that backup.', detail: String(e && e.message || e) });
    return { ok: false };
  }
  if (win) { win.webContents.reload(); if (!win.isVisible()) win.show(); }
  return { ok: true };
}

let win = null;
let tray = null;
let quitting = false;
let mode = 'normal'; // 'normal' | 'float' | 'desktop' | 'widget'
let widgetLayer = 'front'; // 'front' | 'back' — only used in widget mode
let savedBounds = null;

const isFrameless = m => m === 'desktop' || m === 'widget';

function windowOptions() {
  const base = {
    width: 520,
    height: 760,
    minWidth: 400,
    minHeight: 500,
    title: 'Work Queue',
    backgroundColor: '#FAF6F2',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  };
  if (mode === 'desktop') {
    // Glued-to-desktop widget: frameless, no taskbar entry, never activates
    Object.assign(base, {
      frame: false,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false
    });
    // True desktop (wallpaper) layer where the OS supports it
    if (process.platform === 'linux' || process.platform === 'darwin') {
      base.type = 'desktop';
    }
  } else if (mode === 'widget') {
    // Desktop widget: frameless & no taskbar entry, but fully interactive and
    // freely layered — can be pushed in front of or behind other windows.
    Object.assign(base, {
      frame: false,
      skipTaskbar: true,
      focusable: true,
      hasShadow: true
    });
  }
  return base;
}

function createWindow(startHidden) {
  const opts = windowOptions();
  opts.show = false; // appear only once the page is drawn: no blank flash
  win = new BrowserWindow(opts);
  if (savedBounds) win.setBounds(savedBounds);
  win.loadFile('index.html');
  const thisWin = win;
  win.once('ready-to-show', () => {
    if (win !== thisWin) return;
    if (!startHidden) { win.show(); if (mode !== 'desktop') win.focus(); }
  });
  win.on('move', saveWindowState);
  win.on('resize', saveWindowState);
  win.on('close', e => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('mode-state', { mode, widgetLayer });
  });
  applyMode();
}

function applyMode() {
  if (!win) return;
  const onTop = mode === 'float' || (mode === 'widget' && widgetLayer === 'front');
  win.setAlwaysOnTop(onTop, mode === 'float' ? 'floating' : 'screen-saver');
  win.setVisibleOnAllWorkspaces(mode !== 'normal', { visibleOnFullScreen: false });
  if (mode === 'desktop') { try { win.blur(); } catch (e) {} }
  // Widget "back": drop behind whatever is focused right now
  if (mode === 'widget' && widgetLayer === 'back') { try { win.blur(); } catch (e) {} }
}

function setWidgetLayer(layer) {
  if (layer !== 'front' && layer !== 'back') return;
  widgetLayer = layer;
  if (mode === 'widget') {
    applyMode();
    if (layer === 'front') { try { win.show(); win.focus(); win.moveTop && win.moveTop(); } catch (e) {} }
    if (win) win.webContents.send('mode-state', { mode, widgetLayer });
  }
  saveWindowState();
  buildTrayMenu();
}

function setMode(next) {
  if (!['normal', 'float', 'desktop', 'widget'].includes(next) || next === mode) {
    buildTrayMenu();
    return;
  }
  // Changing frameless-ness (desktop/widget vs normal/float), or swapping
  // between the two frameless modes, requires rebuilding the window.
  const needsRebuild = isFrameless(next) !== isFrameless(mode) ||
    (isFrameless(next) && isFrameless(mode) && next !== mode);
  mode = next;
  if (needsRebuild && win) {
    savedBounds = win.getBounds();
    const old = win;
    win = null;
    old.removeAllListeners('close');
    old.destroy();
    createWindow(); // shows itself once drawn
  } else if (win) {
    applyMode();
    win.webContents.send('mode-state', { mode, widgetLayer });
    if (!win.isVisible()) win.show();
  }
  saveWindowState();
  buildTrayMenu();
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else { win.show(); if (mode !== 'desktop') win.focus(); }
}
// Hotkey: hidden or behind other windows -> bring it up; already in front -> hide
const HOTKEY = 'CommandOrControl+Shift+Space';
function hotkeyToggle() {
  if (!win) { createWindow(); return; }
  if (win.isVisible() && win.isFocused()) { win.hide(); return; }
  win.show();
  try { win.moveTop && win.moveTop(); } catch (e) {}
  if (mode !== 'desktop') win.focus();
}

// --- Run on startup (OS login item) ---
// The get and set calls MUST use the same path/args, or Windows reports the
// item as "off" right after you turn it on (which is why the toggle looked
// broken — it kept snapping back).
function loginOptions(enabled) {
  const o = { openAtLogin: !!enabled };
  if (!app.isPackaged) {
    // Running via `npm start`: the executable is Electron, so we must tell it
    // which app to open. A packaged/built app needs none of this.
    o.path = process.execPath;
    o.args = [app.getAppPath()];
  }
  return o;
}
function startupEnabled() {
  try {
    const q = {};
    if (!app.isPackaged) { q.path = process.execPath; q.args = [app.getAppPath()]; }
    return app.getLoginItemSettings(q).openAtLogin === true;
  } catch (e) { return false; }
}
function setStartup(enabled) {
  try { app.setLoginItemSettings(loginOptions(enabled)); } catch (e) {}
  buildTrayMenu();
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide Work Queue', accelerator: HOTKEY, registerAccelerator: false, click: toggleWindow },
    { type: 'separator' },
    { label: 'Normal window', type: 'radio', checked: mode === 'normal', click: () => setMode('normal') },
    { label: 'Float on top', type: 'radio', checked: mode === 'float', click: () => setMode('float') },
    { label: 'Desktop widget (front/back)', type: 'radio', checked: mode === 'widget', click: () => setMode('widget') },
    { label: 'Glued to desktop', type: 'radio', checked: mode === 'desktop', click: () => setMode('desktop') },
    ...(mode === 'widget' ? [
      { type: 'separator' },
      { label: '   Bring to front', type: 'radio', checked: widgetLayer === 'front', click: () => setWidgetLayer('front') },
      { label: '   Send behind windows', type: 'radio', checked: widgetLayer === 'back', click: () => setWidgetLayer('back') }
    ] : []),
    { type: 'separator' },
    { label: 'Open at login', type: 'checkbox', checked: startupEnabled(), click: (mi) => setStartup(mi.checked) },
    { type: 'separator' },
    updateState.status === 'ready'
      ? { label: 'Restart to update to ' + updateState.version, click: () => installUpdateNow() }
      : { label: updateState.status === 'checking' ? 'Checking for updates\u2026'
                : updateState.status === 'downloading' ? 'Downloading update\u2026'
                : 'Check for updates', enabled: app.isPackaged && !!autoUpdater && updateState.status !== 'checking' && updateState.status !== 'downloading',
          click: () => checkForUpdatesNow() },
    { label: 'Open backups folder', click: () => openBackupsFolder() },
    { label: 'Restore from backup…', click: () => restoreFromBackup() },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } }
  ]));
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png'))
    .resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip('Work Queue ' + app.getVersion());
  buildTrayMenu();
  tray.on('click', toggleWindow);
}

ipcMain.handle('set-mode', (_e, m) => { setMode(m); return { mode, widgetLayer }; });
ipcMain.handle('get-mode', () => ({ mode, widgetLayer }));
ipcMain.handle('set-widget-layer', (_e, layer) => { setWidgetLayer(layer); return { mode, widgetLayer }; });

// Run-on-startup, controllable from the in-app checkbox
ipcMain.handle('get-startup', () => startupEnabled());
ipcMain.handle('set-startup', (_e, enabled) => { setStartup(!!enabled); return startupEnabled(); });

// Version and updates
ipcMain.handle('app-info', () => ({ version: app.getVersion(), packaged: app.isPackaged }));
ipcMain.handle('update-state', () => updateState);
ipcMain.handle('update-check', () => { checkForUpdatesNow(); return updateState; });
ipcMain.handle('update-install', () => { installUpdateNow(); return true; });

// Links and files on tasks. Only web/mail links go to the browser, and only
// files that exist are opened, with whatever program Windows uses for them.
ipcMain.handle('open-link', async (_e, url) => {
  if (typeof url !== 'string' || !/^(https?:|mailto:)/i.test(url)) return false;
  try { await shell.openExternal(url); return true; } catch (e) { return false; }
});
ipcMain.handle('open-file', async (_e, p) => {
  if (typeof p !== 'string' || !p || !fs.existsSync(p)) return false;
  try { return (await shell.openPath(p)) === ''; } catch (e) { return false; }
});
ipcMain.handle('pick-files', async () => {
  const opts = { title: 'Attach files to this task', properties: ['openFile', 'multiSelections'] };
  const parent = (win && win.isVisible() && mode !== 'desktop') ? win : null;
  const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
  return r.canceled ? [] : r.filePaths;
});

// Daily backups: open the folder, or restore one
ipcMain.handle('open-backups', () => openBackupsFolder());
ipcMain.handle('restore-backup', () => restoreFromBackup());

// Durable storage: read/write a real JSON file in userData
ipcMain.handle('wq-read', () => {
  try { return fs.readFileSync(dataFile(), 'utf8'); }
  catch (e) { return null; }
});
ipcMain.handle('wq-write', (_e, data) => {
  ensureDailyBackup(); // snapshot yesterday's state before today's first change
  try {
    const tmp = dataFile() + '.tmp';
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, dataFile()); // atomic swap — never a half-written file
    return true;
  } catch (e) { return false; }
});

// ---- Single instance lock ----
// Ensures only ONE Work Queue ever runs. If you launch it again while a copy is
// hidden in the tray, that second launch quits immediately and simply reveals
// the existing window — no duplicate processes, and no cold-start lag.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to open a second copy — surface the one we already have.
    if (win) {
      if (!win.isVisible()) win.show();
      try { win.moveTop && win.moveTop(); } catch (e) {}
      if (mode !== 'desktop') win.focus();
    } else {
      createWindow();
    }
  });

  app.whenReady().then(() => {
    ensureDailyBackup(); // today's snapshot, taken before anything changes
    loadWindowState();   // reopen in the same mode, size and place as last time
    setupAutoUpdates();
    try { globalShortcut.register(HOTKEY, hotkeyToggle); } catch (e) {} // skipped if another app owns it
    // A login launch passes --hidden: start quietly in the tray.
    const launchedAtLogin = process.argv.includes('--hidden');
    createWindow(launchedAtLogin);
    createTray();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else if (win) { win.show(); if (mode !== 'desktop') win.focus(); }
    });
  });
}

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch (e) {} });

// Keep running in the tray when the window is closed
app.on('window-all-closed', () => { /* stay alive in tray */ });
