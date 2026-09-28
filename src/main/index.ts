import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { OfficeRuntime } from './office-runtime';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const runtime = new OfficeRuntime();

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

  runtime.attachWindow(win);

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

function registerIpc(): void {
  ipcMain.handle('office:get-shell-info', () => ({
    productName: 'Cursor Office',
    viewerOnly: true,
    platform: process.platform,
    version: app.getVersion(),
  }));

  ipcMain.handle('office:get-projection', () => runtime.getProjectionPayload());
  ipcMain.handle('office:get-setup-preview', () => runtime.getSetupPreview());
  ipcMain.handle('office:install-hooks', () => runtime.installObserver());
  ipcMain.handle('office:get-health', () => runtime.getHealth());
  ipcMain.handle('office:uninstall', () => runtime.uninstallIntegration());
}

app.whenReady().then(async () => {
  registerIpc();
  await runtime.start();
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

app.on('before-quit', () => {
  void runtime.stop();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
