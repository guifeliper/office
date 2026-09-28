import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const ALLOWED_CHANNELS = new Set([
  'office:get-shell-info',
  'office:get-projection',
  'office:subscribe-projection',
  'office:get-setup-preview',
  'office:install-hooks',
  'office:get-health',
  'office:uninstall',
]);

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Cursor Office',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return win;
}

function registerShellIpc(): void {
  ipcMain.handle('office:get-shell-info', () => ({
    productName: 'Cursor Office',
    viewerOnly: true,
    platform: process.platform,
    version: app.getVersion(),
  }));

  // Placeholder handlers reserved for later units — return safe defaults.
  ipcMain.handle('office:get-projection', () => ({
    consultants: [],
    collaborators: [],
    connected: false,
    waitingForActivity: true,
  }));

  ipcMain.handle('office:get-setup-preview', () => ({
    installed: false,
    hooks: [],
    retainedFields: [],
    commandPath: '',
  }));

  ipcMain.handle('office:install-hooks', () => ({
    ok: false,
    error: 'Not implemented yet',
  }));

  ipcMain.handle('office:get-health', () => ({
    status: 'disconnected' as const,
    detail: 'Observer not configured',
  }));

  ipcMain.handle('office:uninstall', () => ({
    ok: false,
    error: 'Not implemented yet',
  }));
}

app.whenReady().then(() => {
  registerShellIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Harden: reject unapproved channels at the main-process boundary.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

export { ALLOWED_CHANNELS };
