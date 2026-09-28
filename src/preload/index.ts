import { contextBridge, ipcRenderer } from 'electron';

/**
 * Narrow, viewer-only bridge. Never expose Cursor control surfaces
 * (prompts, approvals, follow-ups, or arbitrary IPC invoke).
 */
const officeApi = {
  getShellInfo: () => ipcRenderer.invoke('office:get-shell-info'),
  getProjection: () => ipcRenderer.invoke('office:get-projection'),
  getSetupPreview: () => ipcRenderer.invoke('office:get-setup-preview'),
  installHooks: () => ipcRenderer.invoke('office:install-hooks'),
  getHealth: () => ipcRenderer.invoke('office:get-health'),
  uninstall: () => ipcRenderer.invoke('office:uninstall'),
  onProjection: (listener: (projection: unknown) => void) => {
    const channel = 'office:projection-updated';
    const handler = (_event: Electron.IpcRendererEvent, projection: unknown) => {
      listener(projection);
    };
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
};

contextBridge.exposeInMainWorld('office', officeApi);

export type OfficeApi = typeof officeApi;
