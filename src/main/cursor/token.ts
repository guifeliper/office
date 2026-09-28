import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const TOKEN_FILENAME = 'ingest.token';
export const PORT_FILENAME = 'ingest.port';

export function writeTokenFile(userDataDir: string, token: string): string {
  fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
  const filePath = path.join(userDataDir, TOKEN_FILENAME);
  fs.writeFileSync(filePath, token, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
  return filePath;
}

export function ensureInstallToken(userDataDir: string): string {
  fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
  const filePath = path.join(userDataDir, TOKEN_FILENAME);
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8').trim();
    if (existing.length >= 32) {
      fs.chmodSync(filePath, 0o600);
      return existing;
    }
  }
  const token = crypto.randomBytes(32).toString('base64url');
  writeTokenFile(userDataDir, token);
  return token;
}

export function writePortFile(userDataDir: string, port: number): string {
  const portPath = path.join(userDataDir, PORT_FILENAME);
  fs.writeFileSync(portPath, String(port), { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(portPath, 0o600);
  return portPath;
}

export function tokenPath(userDataDir: string): string {
  return path.join(userDataDir, TOKEN_FILENAME);
}

export function portPath(userDataDir: string): string {
  return path.join(userDataDir, PORT_FILENAME);
}

export function deleteSecrets(userDataDir: string): void {
  for (const name of [TOKEN_FILENAME, PORT_FILENAME, 'hooks.json.backup']) {
    try {
      fs.rmSync(path.join(userDataDir, name), { force: true });
    } catch {
      // ignore
    }
  }
}
