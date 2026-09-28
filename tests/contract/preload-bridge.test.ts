import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const preloadSource = readFileSync(
  path.resolve(__dirname, '../../src/preload/index.ts'),
  'utf8',
);
const mainSource = readFileSync(
  path.resolve(__dirname, '../../src/main/index.ts'),
  'utf8',
);

describe('secure shell bridge', () => {
  it('exposes only the narrow office API surface', () => {
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld('office'");
    expect(preloadSource).toContain('getShellInfo');
    expect(preloadSource).toContain('getProjection');
    expect(preloadSource).not.toContain('sendPrompt');
    expect(preloadSource).not.toContain('approveTool');
    expect(preloadSource).not.toContain('followup');
  });

  it('keeps Electron security defaults for the renderer', () => {
    expect(mainSource).toContain('contextIsolation: true');
    expect(mainSource).toContain('nodeIntegration: false');
    expect(mainSource).toContain('sandbox: true');
  });

  it('does not wire arbitrary ipcRenderer.invoke passthrough', () => {
    expect(preloadSource).not.toMatch(/invoke:\s*\(/);
    expect(preloadSource).not.toContain('ipcRenderer.invoke(channel');
  });
});
