import fs from 'node:fs';
import path from 'node:path';
import {
  mergeOfficeHooks,
  parseHooksFile,
  removeOfficeHooks,
  RETAINED_FIELDS_FOR_PREVIEW,
  SUBSCRIBED_HOOKS,
  type HooksFile,
} from './hook-config';

export interface InstallPaths {
  hooksJsonPath: string;
  wrapperPath: string;
  userDataDir: string;
}

export interface SetupPreview {
  installed: boolean;
  hooks: string[];
  retainedFields: string[];
  commandPath: string;
  additiveChange: string;
  hooksJsonPath: string;
}

export function stagedWrapperPath(userDataDir: string): string {
  return path.join(userDataDir, 'cursor-hook.sh');
}

/** Copy the packaged/resource wrapper into userData and return that stable command path. */
export function stageWrapper(sourceWrapperPath: string, userDataDir: string): string {
  ensureWrapperExecutable(sourceWrapperPath);
  fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
  const dest = stagedWrapperPath(userDataDir);
  fs.copyFileSync(sourceWrapperPath, dest);
  fs.chmodSync(dest, 0o755);
  return dest;
}

export function previewInstall(paths: InstallPaths): SetupPreview {
  const existingRaw = readOptional(paths.hooksJsonPath);
  const existing = existingRaw ? parseHooksFile(existingRaw) : null;
  const commandPath = stagedWrapperPath(paths.userDataDir);
  const merged = mergeOfficeHooks(existing, commandPath);
  const already = existing !== null && officeEntriesPresent(existing);

  return {
    installed: already,
    hooks: [...SUBSCRIBED_HOOKS],
    retainedFields: [...RETAINED_FIELDS_FOR_PREVIEW],
    commandPath,
    additiveChange: describeAdditiveChange(existing, merged),
    hooksJsonPath: paths.hooksJsonPath,
  };
}

export function installHooks(paths: InstallPaths): { ok: true } | { ok: false; error: string } {
  try {
    const commandPath = stageWrapper(paths.wrapperPath, paths.userDataDir);
    const existingRaw = readOptional(paths.hooksJsonPath);
    // Abort on unknown/invalid JSON — never write.
    const existing = existingRaw ? parseHooksFile(existingRaw) : null;

    if (existingRaw) {
      backupHooks(paths.userDataDir, existingRaw);
    }

    const merged = mergeOfficeHooks(existing, commandPath);
    const dir = path.dirname(paths.hooksJsonPath);
    fs.mkdirSync(dir, { recursive: true });
    atomicWriteJson(paths.hooksJsonPath, merged);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Install failed',
    };
  }
}

export function uninstallHooks(paths: InstallPaths): { ok: true } | { ok: false; error: string } {
  try {
    const existingRaw = readOptional(paths.hooksJsonPath);
    if (!existingRaw) {
      removeStagedWrapper(paths.userDataDir);
      return { ok: true };
    }
    const existing = parseHooksFile(existingRaw);
    const next = removeOfficeHooks(existing);
    atomicWriteJson(paths.hooksJsonPath, next);
    removeStagedWrapper(paths.userDataDir);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Uninstall failed',
    };
  }
}

function removeStagedWrapper(userDataDir: string): void {
  try {
    fs.rmSync(stagedWrapperPath(userDataDir), { force: true });
  } catch {
    // ignore
  }
}

function officeEntriesPresent(file: HooksFile): boolean {
  return Object.values(file.hooks).some((entries) =>
    entries.some((e) => e.command.includes('cursor-office-observer')),
  );
}

function describeAdditiveChange(before: HooksFile | null, after: HooksFile): string {
  const lines: string[] = [];
  for (const name of SUBSCRIBED_HOOKS) {
    const beforeCount = before?.hooks[name]?.length ?? 0;
    const afterCount = after.hooks[name]?.length ?? 0;
    if (afterCount > beforeCount) {
      lines.push(`+ ${name}: append one Office observer command`);
    } else if (before && officeEntriesPresent({ version: 1, hooks: { [name]: before.hooks[name] ?? [] } })) {
      lines.push(`~ ${name}: replace existing Office observer command`);
    } else {
      lines.push(`= ${name}: Office observer already present`);
    }
  }
  return lines.join('\n');
}

function backupHooks(userDataDir: string, raw: string): void {
  fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(userDataDir, 'hooks.json.backup');
  fs.writeFileSync(backupPath, raw, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(backupPath, 0o600);
}

function atomicWriteJson(filePath: string, data: HooksFile): void {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.hooks.${process.pid}.${Date.now()}.tmp`);
  let mode = 0o600;
  try {
    mode = fs.statSync(filePath).mode & 0o777;
  } catch {
    // new file
  }
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // ignore
  }
}

function readOptional(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function ensureWrapperExecutable(wrapperPath: string): void {
  if (!fs.existsSync(wrapperPath)) {
    throw new Error(`Observer wrapper missing at ${wrapperPath}`);
  }
  fs.chmodSync(wrapperPath, 0o755);
}
